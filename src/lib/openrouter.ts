import { AIReconstructionSchema, AIOutputSchema } from "./schemas";
import { secureMarkdown } from "./sanitizer";

export async function reconstructDocument(rawText: string) {
  // 1. INPUT VALIDATION (MANDATORY)
  const validation = AIReconstructionSchema.safeParse({ rawText });
  if (!validation.success) {
    throw new Error(`Input Validation Error: ${validation.error.issues[0].message}`);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouter API key is required. Please set OPENROUTER_API_KEY in your environment.");
  }

  const model = "z-ai/glm-4.5-air:free";
  
  const prompt = `
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
    7. Use standard Markdown syntax.
    
    RAW TEXT:
    ${rawText}
  `;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "AI Document Reconstruction Studio",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rawOutput = data.choices[0].message.content || "";

    // 2. OUTPUT VALIDATION (ZOD)
    const outputValidation = AIOutputSchema.safeParse({ content: rawOutput });
    if (!outputValidation.success) {
      throw new Error(`Output Security Error: ${outputValidation.error.issues[0].message}`);
    }

    // 3. SANITIZATION (DOMPurify)
    return secureMarkdown(outputValidation.data.content);
  } catch (error) {
    console.error("OpenRouter Reconstruction Error:", error);
    throw error;
  }
}
