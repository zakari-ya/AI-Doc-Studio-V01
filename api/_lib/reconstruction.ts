import { z } from "zod";
import { MAX_OUTPUT_CHARS } from "./config";
import { HttpError } from "./http";

const PROVIDER_TIMEOUT_MS = 150_000;
const DEFAULT_CHUNK_MAX_CHARS = 45_000;
const PAGE_MARKER_PATTERN = /(?=^--- Page \d+ ---$)/m;

const AIOutputSchema = z.object({
  content: z
    .string()
    .min(1, "AI output is empty")
    .max(MAX_OUTPUT_CHARS, "AI output is excessively large."),
});

const RECONSTRUCTION_MODELS = [
  "z-ai/glm-4.5-air:free",
  "openrouter/owl-alpha",
] as const;

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

function buildReconstructionPrompt(
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

async function callOpenRouterSegment(
  rawText: string,
  segmentIndex: number,
  segmentCount: number,
  providerReferer?: string,
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new HttpError(500, "OPENROUTER_API_KEY is not configured.");
  }

  const prompt = buildReconstructionPrompt(rawText, {
    segmentIndex,
    segmentCount,
  });
  let lastError: HttpError | null = null;

  for (const model of RECONSTRUCTION_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "AI-Doc-Studio",
          ...(providerReferer ? { "HTTP-Referer": providerReferer } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const providerBody = await response.text().catch(() => "");

        if (response.status === 401 || response.status === 403) {
          throw new HttpError(
            500,
            "OpenRouter rejected the server API key.",
          );
        }

        if (response.status === 429) {
          throw new HttpError(
            503,
            "Reconstruction provider is temporarily unavailable.",
          );
        }

        throw new HttpError(
          502,
          `OpenRouter returned HTTP ${response.status}. ${providerBody.slice(0, 500)}`,
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawOutput = data.choices?.[0]?.message?.content ?? "";
      const outputValidation = AIOutputSchema.safeParse({ content: rawOutput });

      if (!outputValidation.success) {
        throw new HttpError(502, "OpenRouter returned invalid output.");
      }

      return outputValidation.data.content;
    } catch (error) {
      if (error instanceof HttpError) {
        lastError = error;
      } else if (error instanceof Error && error.name === "AbortError") {
        lastError = new HttpError(504, "Reconstruction provider timed out.");
      } else {
        lastError = new HttpError(502, "Failed to contact reconstruction provider.");
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new HttpError(502, "Failed to reconstruct document.");
}

export async function reconstructText(rawText: string, providerReferer?: string) {
  const segments = splitReconstructionText(rawText);
  const reconstructedSegments: string[] = [];

  for (const [segmentIndex, segmentText] of segments.entries()) {
    const content = await callOpenRouterSegment(
      segmentText,
      segmentIndex,
      segments.length,
      providerReferer,
    );
    reconstructedSegments.push(content.trim());
  }

  return reconstructedSegments.filter(Boolean).join("\n\n").trim();
}
