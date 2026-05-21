import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./config";

export type DocumentStatus =
  | "uploading"
  | "uploaded"
  | "processing"
  | "completed"
  | "failed"
  | "expired";

export type DocumentRow = {
  id: string;
  auth_user_id: string;
  original_file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  extracted_text: string | null;
  reconstructed_markdown: string | null;
  error_message: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export function getSupabaseAdmin() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
