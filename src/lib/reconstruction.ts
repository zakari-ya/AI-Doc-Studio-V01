export const RECONSTRUCTION_MODELS = [
  "z-ai/glm-4.5-air:free",
  "openrouter/owl-alpha",
] as const;

const DEFAULT_CHUNK_MAX_CHARS = 45_000;
const PAGE_MARKER_PATTERN = /(?=^--- Page \d+ ---$)/m;

type ReconstructionPromptOptions = {
  segmentCount?: number;
  segmentIndex?: number;
};

function splitOversizedSection(text: string, maxChars: number) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    const slices: string[] = [];
    for (let index = 0; index < text.length; index += maxChars) {
      slices.push(text.slice(index, index + maxChars).trim());
    }
    return slices.filter(Boolean);
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const candidate = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    if (paragraph.length > maxChars) {
      chunks.push(...splitOversizedSection(paragraph, maxChars));
      currentChunk = "";
      continue;
    }

    currentChunk = paragraph;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function splitReconstructionText(
  rawText: string,
  maxChars = DEFAULT_CHUNK_MAX_CHARS,
) {
  const normalizedText = rawText.trim();
  if (normalizedText.length <= maxChars) {
    return [normalizedText];
  }

  const pageSections = normalizedText
    .split(PAGE_MARKER_PATTERN)
    .map((section) => section.trim())
    .filter(Boolean);

  const sections = pageSections.length > 0 ? pageSections : [normalizedText];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const section of sections) {
    if (section.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      chunks.push(...splitOversizedSection(section, maxChars));
      continue;
    }

    const candidate = currentChunk ? `${currentChunk}\n\n${section}` : section;
    if (candidate.length <= maxChars) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    currentChunk = section;
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(Boolean);
}

export function buildReconstructionPrompt(
  rawText: string,
  options: ReconstructionPromptOptions = {},
): string {
  const hasSegmentation =
    typeof options.segmentCount === "number" && options.segmentCount > 1;
  const segmentInstructions = hasSegmentation
    ? `
SEGMENT CONTEXT:
- This is segment ${Number(options.segmentIndex ?? 0) + 1} of ${options.segmentCount}.
- Reconstruct only this segment into markdown.
- Preserve headings, lists, and tables exactly as they appear in this segment.
- Do not mention missing previous or next segments.
- Do not invent a new global title unless this segment clearly contains one.
`
    : "";

  return `
You are a document reconstruction expert.
Below is raw text extracted from a PDF.
Your task is to reconstruct the original document structure into clean, professional Markdown.
${segmentInstructions}
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
