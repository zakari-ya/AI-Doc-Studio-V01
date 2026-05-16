import { AIReconstructionSchema, AIOutputSchema } from "./schemas";
import { secureMarkdown } from "./sanitizer";

export async function reconstructDocument(rawText: string) {
  try {
    const response = await fetch("/api/reconstruct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rawText })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Server error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error("AI Proxy Error:", error);
    throw error;
  }
}
