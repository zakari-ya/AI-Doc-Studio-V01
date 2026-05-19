export const RECONSTRUCTION_MODELS = [
  "z-ai/glm-4.5-air:free",
  "openrouter/owl-alpha",
] as const;

export function buildReconstructionPrompt(rawText: string): string {
  return `
You are a document reconstruction expert.
Below is raw text extracted from a PDF.
Your task is to reconstruct the original document structure into clean, professional Markdown.

RULES:
1. Identify headings and use appropriate # levels.
2. Format lists (numbered or bulleted) correctly.
3. Reconstruct tables if data looks tabular.
4. Fix common OCR/extraction issues (broken words, missing spaces).
5. Maintain the logical flow of the document.
6. Do NOT include any meta-talk or introductory remarks. Just the Markdown.
7. Use standard Markdown syntax only.
8. Do NOT emit raw HTML blocks.

RAW TEXT:
${rawText}
  `.trim();
}
