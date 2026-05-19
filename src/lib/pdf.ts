import {
  MAX_PDF_PAGE_COUNT,
  MAX_RAW_TEXT_CHARS,
} from "./schemas";

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
let pdfWorkerPromise: Promise<string> | null = null;

async function loadPdfJs() {
  pdfJsPromise ??= import("pdfjs-dist");
  pdfWorkerPromise ??= import("pdfjs-dist/build/pdf.worker.min.mjs?url").then(
    (module) => module.default,
  );

  const [pdfjs, workerSrc] = await Promise.all([pdfJsPromise, pdfWorkerPromise]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  return pdfjs;
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  if (pdf.numPages > MAX_PDF_PAGE_COUNT) {
    throw new Error(
      `PDF exceeds the ${MAX_PDF_PAGE_COUNT}-page processing limit. Split the document into smaller parts before uploading.`,
    );
  }

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    fullText += `--- Page ${i} ---
${pageText}

`;

    if (fullText.length > MAX_RAW_TEXT_CHARS) {
      throw new Error(
        `Extracted text exceeded ${MAX_RAW_TEXT_CHARS.toLocaleString()} characters. Use a shorter PDF or split the file before processing.`,
      );
    }
  }

  return fullText.trim();
}
