import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../_lib/auth";
import { SUPABASE_STORAGE_BUCKET } from "../_lib/config";
import {
  createBaseHeaders,
  enforceBodySize,
  enforceJsonRequest,
  enforceMethod,
  enforceOrigin,
  getHeaderValue,
  handleApiError,
  HttpError,
  logApiEvent,
  type ApiRequest,
  readJsonBody,
  sendJson,
} from "../_lib/http";
import { createNodeHandler } from "../_lib/node-adapter";
import { extractTextFromPdfBuffer } from "../_lib/pdf";
import { reconstructText } from "../_lib/reconstruction";
import { enforceUserRateLimit } from "../_lib/rate-limit";
import { type DocumentRow, getSupabaseAdmin } from "../_lib/supabase";

const MAX_BODY_BYTES = 20_000;
const ROUTE = "/api/documents/reconstruct";

const ReconstructDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

function getProviderReferer(req: ApiRequest) {
  const explicitReferer = process.env.OPENROUTER_HTTP_REFERER;
  if (explicitReferer) {
    return explicitReferer;
  }

  const host =
    getHeaderValue(req.headers, "x-forwarded-host") ??
    getHeaderValue(req.headers, "host");
  if (!host) {
    return process.env.APP_BASE_URL;
  }

  const forwardedProto = getHeaderValue(req.headers, "x-forwarded-proto");
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

export async function POST(req: ApiRequest) {
  const requestId = randomUUID();
  let stage = "start";

  try {
    logApiEvent(ROUTE, requestId, stage, {
      method: req.method,
      vercelEnv: process.env.VERCEL_ENV,
      hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasSupabaseDatabaseUrl: Boolean(process.env.SUPABASE_DATABASE_URL),
    });

    stage = "validate-request";
    enforceMethod(req);
    enforceOrigin(req);
    enforceJsonRequest(req);
    enforceBodySize(req, MAX_BODY_BYTES);

    stage = "auth";
    const auth = await requireAuth(req);

    stage = "parse-body";
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    const validation = ReconstructDocumentSchema.safeParse(body);

    if (!validation.success) {
      return sendJson(
        400,
        {
          error:
            validation.error.issues[0]?.message ?? "Invalid reconstruction request.",
        },
        createBaseHeaders(requestId),
      );
    }

    stage = "load-document";
    const supabase = getSupabaseAdmin();
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", validation.data.documentId)
      .eq("auth_user_id", auth.userId)
      .single<DocumentRow>();

    if (documentError || !document) {
      logApiEvent(ROUTE, requestId, "document-load-error", {
        documentId: validation.data.documentId,
        message: documentError?.message,
        code: documentError?.code,
      });
      throw new HttpError(404, "Document not found.");
    }

    if (document.status === "expired") {
      throw new HttpError(410, "Document has expired.");
    }

    stage = "rate-limit";
    await enforceUserRateLimit(auth.userId);

    stage = "mark-processing";
    await supabase
      .from("documents")
      .update({
        status: "processing",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", document.id);

    try {
      stage = "download-pdf";
      const { data: storedFile, error: downloadError } = await supabase.storage
        .from(document.storage_bucket || SUPABASE_STORAGE_BUCKET)
        .download(document.storage_path);

      if (downloadError || !storedFile) {
        throw new HttpError(
          404,
          downloadError?.message ?? "Uploaded PDF was not found in storage.",
        );
      }

      stage = "extract-pdf";
      const fileBuffer = Buffer.from(await storedFile.arrayBuffer());
      const extractedText = await extractTextFromPdfBuffer(fileBuffer);

      stage = "openrouter-reconstruct";
      const reconstructedMarkdown = await reconstructText(
        extractedText,
        getProviderReferer(req),
      );

      stage = "store-result";
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

      stage = "success";
      logApiEvent(ROUTE, requestId, stage, {
        documentId: document.id,
        extractedChars: extractedText.length,
        outputChars: reconstructedMarkdown.length,
      });

      return sendJson(
        200,
        {
          documentId: document.id,
          content: reconstructedMarkdown,
          originalText: extractedText,
        },
        createBaseHeaders(requestId),
      );
    } catch (processingError) {
      const message =
        processingError instanceof Error
          ? processingError.message
          : "Document processing failed.";
      logApiEvent(ROUTE, requestId, "processing-error", {
        documentId: document.id,
        stage,
        message,
      });
      await markFailed(supabase, document.id, message);
      throw processingError;
    }
  } catch (error) {
    return handleApiError(error, requestId, ROUTE, stage);
  }
}

export default createNodeHandler(POST);
