import { HttpError } from "./http.js";

export const MAX_RAW_TEXT_CHARS = 200_000;
export const MAX_OUTPUT_CHARS = 250_000;
export const MAX_PDF_FILE_SIZE_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGE_COUNT = 40;
export const DOCUMENT_RETENTION_HOURS = 24;
export const DAILY_RECONSTRUCTION_LIMIT = 20;
export const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || "documents-temp";

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new HttpError(500, `${name} is not configured.`);
  }
  return value;
}
