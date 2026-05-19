import {
  AIOutputSchema,
  AIReconstructionSchema,
  APIErrorSchema,
} from "./schemas";
import { splitReconstructionText } from "./reconstruction";
import { secureMarkdown } from "./sanitizer";

const CLIENT_REQUEST_TIMEOUT_MS = 240_000;
const CHUNK_RETRY_ATTEMPTS = 2;

async function requestReconstructionSegment(
  rawText: string,
  segmentIndex: number,
  segmentCount: number,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/reconstruct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ rawText, segmentIndex, segmentCount }),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });

    const requestId = response.headers.get("x-request-id");
    const responseText = await response.text().catch(() => "");
    const responseBody: unknown = responseText
      ? (() => {
          try {
            return JSON.parse(responseText) as unknown;
          } catch {
            return null;
          }
        })()
      : null;

    if (!response.ok) {
      const errorValidation = APIErrorSchema.safeParse(responseBody);
      if (errorValidation.success) {
        throw new Error(
          requestId
            ? `${errorValidation.data.error} (request id: ${requestId})`
            : errorValidation.data.error,
        );
      }

      if (response.status === 504) {
        throw new Error(
          requestId
            ? `Reconstruction exceeded the server time limit. Request id: ${requestId}`
            : "Reconstruction exceeded the server time limit.",
        );
      }

      throw new Error(
        requestId
          ? `Document reconstruction failed with HTTP ${response.status}. Request id: ${requestId}`
          : `Document reconstruction failed with HTTP ${response.status}.`,
      );
    }

    const outputValidation = AIOutputSchema.safeParse(responseBody);
    if (!outputValidation.success) {
      throw new Error(`Output Security Error: ${outputValidation.error.issues[0].message}`);
    }

    return outputValidation.data.content;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Reconstruction request timed out before the model responded.");
    }

    throw error instanceof Error
      ? error
      : new Error("Document reconstruction failed. Please try again.");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function reconstructDocument(rawText: string) {
  const validation = AIReconstructionSchema.safeParse({ rawText });
  if (!validation.success) {
    throw new Error(`Input Validation Error: ${validation.error.issues[0].message}`);
  }

  const segments = splitReconstructionText(validation.data.rawText);
  const reconstructedSegments: string[] = [];

  for (const [segmentIndex, segmentText] of segments.entries()) {
    let segmentContent: string | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < CHUNK_RETRY_ATTEMPTS; attempt += 1) {
      try {
        segmentContent = await requestReconstructionSegment(
          segmentText,
          segmentIndex,
          segments.length,
        );
        break;
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error("Document reconstruction failed. Please try again.");
      }
    }

    if (!segmentContent) {
      if (segments.length > 1) {
        throw new Error(
          `Reconstruction stopped on segment ${segmentIndex + 1} of ${segments.length}. ${lastError?.message ?? "The model did not return content."}`,
        );
      }

      throw lastError ?? new Error("Document reconstruction failed. Please try again.");
    }

    reconstructedSegments.push(segmentContent.trim());
  }

  return secureMarkdown(reconstructedSegments.filter(Boolean).join("\n\n").trim());
}
