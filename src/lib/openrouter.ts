import { z } from "zod";
import { secureMarkdown } from "./sanitizer";
import { APIErrorSchema, AIOutputSchema } from "./schemas";
import { getSupabaseBrowserClient, SUPABASE_STORAGE_BUCKET } from "./supabase";

const CLIENT_REQUEST_TIMEOUT_MS = 240_000;

const SignedUploadSchema = z.object({
  path: z.string().min(1),
  token: z.string().min(1),
  signedUrl: z.string().min(1).optional(),
});

const CreateUploadResponseSchema = z.object({
  documentId: z.string().uuid(),
  storagePath: z.string().min(1),
  signedUpload: SignedUploadSchema,
  expiresAt: z.string().min(1),
});

const ReconstructResponseSchema = AIOutputSchema.extend({
  documentId: z.string().uuid(),
  originalText: z.string().min(1),
});

async function readJsonResponse(response: Response) {
  const responseText = await response.text().catch(() => "");
  if (!responseText) {
    return { parsed: null, raw: "" };
  }

  try {
    return { parsed: JSON.parse(responseText) as unknown, raw: responseText };
  } catch {
    return { parsed: null, raw: responseText };
  }
}

function buildApiError(response: Response, body: unknown, rawBody: string) {
  const requestId = response.headers.get("x-request-id");
  const parsed = APIErrorSchema.safeParse(body);
  const responseRequestId = parsed.success ? parsed.data.requestId : undefined;
  const debugRequestId = requestId ?? responseRequestId;
  const fallbackBody = rawBody.trim().slice(0, 500);
  const message = parsed.success
    ? parsed.data.error
    : fallbackBody
      ? `Request failed with HTTP ${response.status}: ${fallbackBody}`
      : `Request failed with HTTP ${response.status}.`;

  console.error("[api] request failed", {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    requestId: debugRequestId,
    route: parsed.success ? parsed.data.route : undefined,
    stage: parsed.success ? parsed.data.stage : undefined,
    body,
    rawBody: fallbackBody || undefined,
  });

  return new Error(
    debugRequestId ? `${message} (request id: ${debugRequestId})` : message,
  );
}

async function fetchJsonWithAuth(
  path: string,
  token: string,
  body: Record<string, unknown>,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });

    const { parsed: responseBody, raw: rawBody } = await readJsonResponse(response);
    if (!response.ok) {
      throw buildApiError(response, responseBody, rawBody);
    }

    return responseBody;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The document request timed out before the server responded.");
    }

    throw error instanceof Error ? error : new Error("Document request failed.");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function getRequiredAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error("Authentication session could not be loaded.");
  }

  const token = session?.access_token;
  if (!token) {
    throw new Error("Authentication required. Sign in with your magic link to continue.");
  }

  return token;
}

export async function processDocumentWithStorage(file: File) {
  const token = await getRequiredAccessToken();
  console.info("[pipeline] creating signed upload", {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/pdf",
  });

  const uploadResponse = await fetchJsonWithAuth("/api/uploads/create", token, {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/pdf",
  });

  const uploadValidation = CreateUploadResponseSchema.safeParse(uploadResponse);
  if (!uploadValidation.success) {
    console.error("[pipeline] invalid create-upload response", {
      issues: uploadValidation.error.issues,
      response: uploadResponse,
    });
    throw new Error("Upload Security Error: invalid signed upload response.");
  }

  const supabase = getSupabaseBrowserClient();
  const { signedUpload } = uploadValidation.data;
  console.info("[pipeline] uploading PDF to Supabase Storage", {
    documentId: uploadValidation.data.documentId,
    storagePath: uploadValidation.data.storagePath,
  });

  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("[pipeline] Supabase signed upload failed", uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  console.info("[pipeline] requesting reconstruction", {
    documentId: uploadValidation.data.documentId,
  });

  const reconstructResponse = await fetchJsonWithAuth(
    "/api/documents/reconstruct",
    token,
    { documentId: uploadValidation.data.documentId },
  );

  const reconstructValidation =
    ReconstructResponseSchema.safeParse(reconstructResponse);
  if (!reconstructValidation.success) {
    console.error("[pipeline] invalid reconstruction response", {
      issues: reconstructValidation.error.issues,
      response: reconstructResponse,
    });
    throw new Error("Output Security Error: invalid reconstruction response.");
  }

  return {
    documentId: reconstructValidation.data.documentId,
    markdown: secureMarkdown(reconstructValidation.data.content),
    originalText: reconstructValidation.data.originalText,
  };
}
