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
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return null;
  }
}

function buildApiError(response: Response, body: unknown) {
  const requestId = response.headers.get("x-request-id");
  const parsed = APIErrorSchema.safeParse(body);
  const message = parsed.success
    ? parsed.data.error
    : `Request failed with HTTP ${response.status}.`;

  return new Error(requestId ? `${message} (request id: ${requestId})` : message);
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

    const responseBody = await readJsonResponse(response);
    if (!response.ok) {
      throw buildApiError(response, responseBody);
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
  const uploadResponse = await fetchJsonWithAuth("/api/uploads/create", token, {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/pdf",
  });

  const uploadValidation = CreateUploadResponseSchema.safeParse(uploadResponse);
  if (!uploadValidation.success) {
    throw new Error("Upload Security Error: invalid signed upload response.");
  }

  const supabase = getSupabaseBrowserClient();
  const { signedUpload } = uploadValidation.data;
  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const reconstructResponse = await fetchJsonWithAuth(
    "/api/documents/reconstruct",
    token,
    { documentId: uploadValidation.data.documentId },
  );

  const reconstructValidation =
    ReconstructResponseSchema.safeParse(reconstructResponse);
  if (!reconstructValidation.success) {
    throw new Error("Output Security Error: invalid reconstruction response.");
  }

  return {
    documentId: reconstructValidation.data.documentId,
    markdown: secureMarkdown(reconstructValidation.data.content),
    originalText: reconstructValidation.data.originalText,
  };
}
