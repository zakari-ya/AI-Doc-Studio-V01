import { z } from "zod";

export const MAX_RAW_TEXT_CHARS = 200_000;
export const MAX_OUTPUT_CHARS = 250_000;
export const MAX_PDF_FILE_SIZE_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGE_COUNT = 40;

/**
 * Schema for AI Reconstruction Requests
 */
export const AIReconstructionSchema = z.object({
  rawText: z
    .string()
    .min(1, "Input text cannot be empty")
    .max(
      MAX_RAW_TEXT_CHARS,
      `Input text is too large. Reduce the document size and keep extracted text below ${MAX_RAW_TEXT_CHARS.toLocaleString()} characters.`,
    ),
  segmentIndex: z.number().int().min(0).optional(),
  segmentCount: z.number().int().min(1).optional(),
});

/**
 * Schema for File Upload Validation
 */
export const FileUploadSchema = z.object({
  name: z.string().min(1, "File name is required"),
  size: z
    .number()
    .max(
      MAX_PDF_FILE_SIZE_BYTES,
      `File size exceeds ${(MAX_PDF_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB limit.`,
    ),
  type: z.literal("application/pdf", {
    message: "Only PDF files are supported",
  }),
});

/**
 * Schema for Document Export
 */
export const ExportSchema = z.object({
  markdown: z.string().min(1, "Export content cannot be empty"),
  fileName: z.string().min(1, "Target filename is required"),
  format: z.enum(["md", "txt", "docx"]),
});

/**
 * Schema for AI Generated Content
 */
export const AIOutputSchema = z.object({
  content: z
    .string()
    .min(1, "AI output is empty")
    .max(
      MAX_OUTPUT_CHARS,
      `AI output is excessively large. Keep output below ${MAX_OUTPUT_CHARS.toLocaleString()} characters.`,
    ),
});

/**
 * Schema for API errors returned to the client
 */
export const APIErrorSchema = z.object({
  error: z.string().min(1, "API error message is required"),
});

export type AIReconstructionRequest = z.infer<typeof AIReconstructionSchema>;
export type FileUploadRequest = z.infer<typeof FileUploadSchema>;
export type ExportRequest = z.infer<typeof ExportSchema>;
export type AIOutputResponse = z.infer<typeof AIOutputSchema>;
export type APIErrorResponse = z.infer<typeof APIErrorSchema>;
