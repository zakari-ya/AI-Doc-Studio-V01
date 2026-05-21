import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../_lib/auth";
import { SUPABASE_STORAGE_BUCKET } from "../_lib/config";
import {
  enforceBodySize,
  enforceJsonRequest,
  enforceMethod,
  enforceOrigin,
  getHeaderValue,
  handleApiError,
  HttpError,
  type ApiRequest,
  type ApiResponse,
  readJsonBody,
  sendJson,
  setBaseHeaders,
} from "../_lib/http";
import { extractTextFromPdfBuffer } from "../_lib/pdf";
import { reconstructText } from "../_lib/reconstruction";
import { enforceUserRateLimit } from "../_lib/rate-limit";
import { type DocumentRow, getSupabaseAdmin } from "../_lib/supabase";

const MAX_BODY_BYTES = 20_000;

const ReconstructDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

function getProviderReferer(req: ApiRequest) {
  const explicitReferer = process.env.OPENROUTER_HTTP_REFERER;
  if (explicitReferer) {
    return explicitReferer;
  }

  const host =
    getHeaderValue(req.headers["x-forwarded-host"]) ??
    getHeaderValue(req.headers.host);
  if (!host) {
    return process.env.APP_BASE_URL;
  }

  const forwardedProto = getHeaderValue(req.headers["x-forwarded-proto"]);
  return `${forwardedProto ?? "https"}://${host}`;
}

async function markFailed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  documentId: string,
  message: string,
) {
  await supabase
    .from("documents")
    .update({
      status: "failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const requestId = randomUUID();
  setBaseHeaders(res, requestId);

  try {
    enforceMethod(req, res);
    enforceOrigin(req);
    enforceJsonRequest(req);
    enforceBodySize(req, MAX_BODY_BYTES);

    const auth = await requireAuth(req);
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    const validation = ReconstructDocumentSchema.safeParse(body);

    if (!validation.success) {
      return sendJson(res, 400, {
        error: validation.error.issues[0]?.message ?? "Invalid reconstruction request.",
      });
    }

    const supabase = getSupabaseAdmin();
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", validation.data.documentId)
      .eq("auth_user_id", auth.userId)
      .single<DocumentRow>();

    if (documentError || !document) {
      throw new HttpError(404, "Document not found.");
    }

    if (document.status === "expired") {
      throw new HttpError(410, "Document has expired.");
    }

    await enforceUserRateLimit(auth.userId);

    await supabase
      .from("documents")
      .update({
        status: "processing",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", document.id);

    try {
      const { data: storedFile, error: downloadError } = await supabase.storage
        .from(document.storage_bucket || SUPABASE_STORAGE_BUCKET)
        .download(document.storage_path);

      if (downloadError || !storedFile) {
        throw new HttpError(
          404,
          downloadError?.message ?? "Uploaded PDF was not found in storage.",
        );
      }

      const fileBuffer = Buffer.from(await storedFile.arrayBuffer());
      const extractedText = await extractTextFromPdfBuffer(fileBuffer);
      const reconstructedMarkdown = await reconstructText(
        extractedText,
        getProviderReferer(req),
      );

      const { error: updateError } = await supabase
        .from("documents")
        .update({
          status: "completed",
          extracted_text: extractedText,
          reconstructed_markdown: reconstructedMarkdown,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", document.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return sendJson(res, 200, {
        documentId: document.id,
        content: reconstructedMarkdown,
        originalText: extractedText,
      });
    } catch (processingError) {
      const message =
        processingError instanceof Error
          ? processingError.message
          : "Document processing failed.";
      await markFailed(supabase, document.id, message);
      throw processingError;
    }
  } catch (error) {
    return handleApiError(error, res, requestId);
  }
}
