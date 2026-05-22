import { fileTypeFromBuffer } from "file-type";
import {
  MAX_PDF_FILE_SIZE_BYTES,
  MAX_PDF_PAGE_COUNT,
  MAX_RAW_TEXT_CHARS,
} from "./config.js";
import { HttpError } from "./http.js";

let pdfJsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null =
  null;
let nodeCanvasPolyfillsPromise: Promise<void> | null = null;

async function ensurePdfJsNodeGlobals() {
  nodeCanvasPolyfillsPromise ??= (async () => {
    if (globalThis.DOMMatrix && globalThis.ImageData && globalThis.Path2D) {
      return;
    }

    try {
      const canvas = await import("@napi-rs/canvas");
      globalThis.DOMMatrix ??=
        canvas.DOMMatrix as unknown as typeof globalThis.DOMMatrix;
      globalThis.ImageData ??=
        canvas.ImageData as unknown as typeof globalThis.ImageData;
      globalThis.Path2D ??=
        canvas.Path2D as unknown as typeof globalThis.Path2D;
    } catch (error) {
      throw new Error(
        `Failed to load required PDF canvas polyfills: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (!globalThis.DOMMatrix || !globalThis.ImageData || !globalThis.Path2D) {
      throw new Error(
        "PDF canvas polyfills could not be initialized for DOMMatrix, ImageData, or Path2D.",
      );
    }
  })();

  return nodeCanvasPolyfillsPromise;
}

async function loadPdfJs() {
  pdfJsPromise ??= (async () => {
    await ensurePdfJsNodeGlobals();
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  })();
  return pdfJsPromise;
}

export async function validatePdfBuffer(buffer: Buffer) {
  if (buffer.length > MAX_PDF_FILE_SIZE_BYTES) {
    throw new HttpError(413, "PDF file exceeds the configured size limit.");
  }

  const fileType = await fileTypeFromBuffer(buffer.subarray(0, 4100));
  if (!fileType || fileType.mime !== "application/pdf") {
    throw new HttpError(400, "Stored file is not a valid PDF.");
  }
}

export async function extractTextFromPdfBuffer(buffer: Buffer) {
  await validatePdfBuffer(buffer);
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
  });
  const pdf = await loadingTask.promise;

  if (pdf.numPages > MAX_PDF_PAGE_COUNT) {
    throw new HttpError(
      413,
      `PDF exceeds the ${MAX_PDF_PAGE_COUNT}-page processing limit.`,
    );
  }

  let fullText = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    fullText += `--- Page ${pageNumber} ---\n${pageText}\n\n`;

    if (fullText.length > MAX_RAW_TEXT_CHARS) {
      throw new HttpError(
        413,
        `Extracted text exceeded ${MAX_RAW_TEXT_CHARS.toLocaleString()} characters.`,
      );
    }
  }

  const trimmed = fullText.trim();
  if (!trimmed) {
    throw new HttpError(422, "No extractable text was found in this PDF.");
  }

  return trimmed;
}
