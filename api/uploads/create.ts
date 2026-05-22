import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  DOCUMENT_RETENTION_HOURS,
  MAX_PDF_FILE_SIZE_BYTES,
  SUPABASE_STORAGE_BUCKET,
} from "../_lib/config.js";
import { requireAuth } from "../_lib/auth.js";
import { createNodeHandler } from "../_lib/node-adapter.js";
import {
  createBaseHeaders,
  enforceBodySize,
  enforceJsonRequest,
  enforceMethod,
  enforceOrigin,
  handleApiError,
  HttpError,
  logApiEvent,
  type ApiRequest,
  readJsonBody,
  sendJson,
} from "../_lib/http.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";

const MAX_BODY_BYTES = 20_000;
const ROUTE = "/api/uploads/create";

const CreateUploadSchema = z.object({
  fileName: z.string().min(1).max(180),
  fileSize: z.number().int().positive().max(MAX_PDF_FILE_SIZE_BYTES),
  mimeType: z.literal("application/pdf"),
});

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned.toLowerCase().endsWith(".pdf")
    ? cleaned
    : `${cleaned || "document"}.pdf`;
}

export async function POST(req: ApiRequest) {
  const requestId = randomUUID();
  let stage = "start";

  try {
    logApiEvent(ROUTE, requestId, stage, {
      method: req.method,
      vercelEnv: process.env.VERCEL_ENV,
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      storageBucket: SUPABASE_STORAGE_BUCKET,
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
    const validation = CreateUploadSchema.safeParse(body);

    if (!validation.success) {
      return sendJson(
        400,
        {
          error: validation.error.issues[0]?.message ?? "Invalid upload request.",
        },
        createBaseHeaders(requestId),
      );
    }

    stage = "create-document-row";
    const supabase = getSupabaseAdmin();
    const documentId = randomUUID();
    const safeFileName = sanitizeFileName(validation.data.fileName);
    const storagePath = `${auth.userId}/${documentId}/${safeFileName}`;
    const expiresAt = new Date(
      Date.now() + DOCUMENT_RETENTION_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { error: insertError } = await supabase.from("documents").insert({
      id: documentId,
      auth_user_id: auth.userId,
      original_file_name: validation.data.fileName,
      storage_bucket: SUPABASE_STORAGE_BUCKET,
      storage_path: storagePath,
      mime_type: validation.data.mimeType,
      size_bytes: validation.data.fileSize,
      status: "uploading",
      expires_at: expiresAt,
    });

    if (insertError) {
      logApiEvent(ROUTE, requestId, "supabase-insert-error", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
      });
      throw new HttpError(
        500,
        "Supabase documents table write failed. Check the `documents` table schema and the server-side Supabase key.",
      );
    }

    stage = "create-signed-upload-url";
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (uploadError || !uploadData) {
      logApiEvent(ROUTE, requestId, "supabase-signed-upload-error", {
        message: uploadError?.message,
        name: uploadError?.name,
      });
      throw new HttpError(
        500,
        "Supabase signed upload creation failed. Check the storage bucket name, bucket privacy, and the server-side Supabase key.",
      );
    }

    stage = "success";
    logApiEvent(ROUTE, requestId, stage, {
      documentId,
      sizeBytes: validation.data.fileSize,
    });

    return sendJson(
      200,
      {
        documentId,
        storagePath,
        signedUpload: uploadData,
        expiresAt,
      },
      createBaseHeaders(requestId),
    );
  } catch (error) {
    return handleApiError(error, requestId, ROUTE, stage);
  }
}

export default createNodeHandler(POST);
