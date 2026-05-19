import DOMPurify from "dompurify";

/**
 * Sanitizes raw text or HTML using DOMPurify.
 * This is the first line of defense against XSS in AI-generated content.
 */
export function sanitizeHTML(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      "b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
      "table", "thead", "tbody", "tr", "th", "td", "blockquote", "code", "pre", "hr"
    ],
    ALLOWED_ATTR: ["href", "title", "class"],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}

/**
 * Neutralizes any potential script tags or dangerous patterns in Markdown
 * that DOMPurify might miss if we treat it as plain text.
 */
export function secureMarkdown(md: string): string {
  const sanitized = sanitizeHTML(md);
  return sanitized
    .replace(/javascript\s*:/gi, "disabled:")
    .replace(/data\s*:/gi, "disabled:")
    .replace(/vbscript\s*:/gi, "disabled:");
}
