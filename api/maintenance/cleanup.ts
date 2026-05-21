import { randomUUID } from "node:crypto";
import {
  createBaseHeaders,
  enforceMethod,
  handleApiError,
  HttpError,
  type ApiRequest,
  sendJson,
  getHeaderValue,
} from "../_lib/http";
import { getSupabaseAdmin, type DocumentRow } from "../_lib/supabase";

function requireCronAuth(req: ApiRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new HttpError(500, "CRON_SECRET is not configured.");
  }

  const authorization = getHeaderValue(req.headers, "authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerSecret = getHeaderValue(req.headers, "x-cron-secret");

  if (token !== secret && headerSecret !== secret) {
    throw new HttpError(401, "Maintenance authorization required.");
  }
}

export async function POST(req: ApiRequest) {
  const requestId = randomUUID();

  try {
    enforceMethod(req);
    requireCronAuth(req);

    const supabase = getSupabaseAdmin();
    const { data: expiredDocuments, error: selectError } = await supabase
      .from("documents")
      .select("*")
      .lt("expires_at", new Date().toISOString())
      .neq("status", "expired")
      .limit(100);

    if (selectError) {
      throw new Error(selectError.message);
    }

    const documents = (expiredDocuments ?? []) as DocumentRow[];
    const groupedPaths = new Map<string, string[]>();

    for (const document of documents) {
      const paths = groupedPaths.get(document.storage_bucket) ?? [];
      paths.push(document.storage_path);
      groupedPaths.set(document.storage_bucket, paths);
    }

    for (const [bucket, paths] of groupedPaths.entries()) {
      if (paths.length > 0) {
        await supabase.storage.from(bucket).remove(paths);
      }
    }

    if (documents.length > 0) {
      const ids = documents.map((document) => document.id);
      const { error: updateError } = await supabase
        .from("documents")
        .update({
          status: "expired",
          extracted_text: null,
          reconstructed_markdown: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    return sendJson(
      200,
      {
        expired: documents.length,
      },
      createBaseHeaders(requestId),
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
