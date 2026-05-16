import { z } from "zod";

/**
 * Schema for AI Reconstruction Requests
 */
export const AIReconstructionSchema = z.object({
  rawText: z.string().min(1, "Input text cannot be empty").max(1000000, "Input text is too large"),
});

/**
 * Schema for File Upload Validation
 */
export const FileUploadSchema = z.object({
  name: z.string().min(1, "File name is required"),
  size: z.number().max(50 * 1024 * 1024, "File size exceeds 50MB limit"),
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

export type AIReconstructionRequest = z.infer<typeof AIReconstructionSchema>;
export type FileUploadRequest = z.infer<typeof FileUploadSchema>;
export type ExportRequest = z.infer<typeof ExportSchema>;
