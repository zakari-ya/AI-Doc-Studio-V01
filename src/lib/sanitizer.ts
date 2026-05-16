import DOMPurify from "dompurify";

/**
 * Sanitizes raw text or HTML using DOMPurify.
 * This is the first line of defense against XSS in AI-generated content.
 */
export function sanitizeHTML(content: string): string {
  // If we are in a server environment (e.g. durante SSR), dompurify needs a window.
  // In the current browser-only environment of AI Studio, we can call it directly.
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      "b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
      "table", "thead", "tbody", "tr", "th", "td", "blockquote", "code", "pre", "hr", "img"
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "class"],
  });
}

/**
 * Neutralizes any potential script tags or dangerous patterns in Markdown
 * that DOMPurify might miss if we treat it as plain text.
 */
export function secureMarkdown(md: string): string {
  // 1. First Pass: DOMPurify (strips active HTML)
  const sanitized = sanitizeHTML(md);
  
  // 2. Second Pass: Additional logic if needed (e.g. neutralizing JS protocols)
  return sanitized.replace(/javascript\s*:/gi, "disabled:");
}
