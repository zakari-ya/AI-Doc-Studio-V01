import {
  AIOutputSchema,
  AIReconstructionSchema,
  APIErrorSchema,
} from "./schemas";
import { secureMarkdown } from "./sanitizer";

const CLIENT_REQUEST_TIMEOUT_MS = 180_000;

export async function reconstructDocument(rawText: string) {
  const validation = AIReconstructionSchema.safeParse({ rawText });
  if (!validation.success) {
    throw new Error(`Input Validation Error: ${validation.error.issues[0].message}`);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/reconstruct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(validation.data),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });

    const responseBody: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const errorValidation = APIErrorSchema.safeParse(responseBody);
      if (errorValidation.success) {
        throw new Error(errorValidation.data.error);
      }

      if (response.status === 504) {
        throw new Error("Reconstruction exceeded the server time limit. The extracted text is still available for editing.");
      }

      throw new Error("Document reconstruction failed. Please try again.");
    }

    const outputValidation = AIOutputSchema.safeParse(responseBody);
    if (!outputValidation.success) {
      throw new Error(`Output Security Error: ${outputValidation.error.issues[0].message}`);
    }

    return secureMarkdown(outputValidation.data.content);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Reconstruction is taking longer than expected. The extracted text is still available for editing while the AI step is skipped.",
      );
    }

    throw error instanceof Error
      ? error
      : new Error("Document reconstruction failed. Please try again.");
  } finally {
    window.clearTimeout(timeoutId);
  }
}
