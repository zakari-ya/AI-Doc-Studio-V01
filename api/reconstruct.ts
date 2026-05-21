import { randomUUID } from "node:crypto";
import {
  type ApiRequest,
  createBaseHeaders,
  sendJson,
} from "./_lib/http";

export async function POST(_req: ApiRequest) {
  const requestId = randomUUID();

  return sendJson(
    410,
    {
      error:
        "Legacy raw-text reconstruction endpoint is disabled. Use /api/uploads/create and /api/documents/reconstruct.",
    },
    createBaseHeaders(requestId),
  );
}
