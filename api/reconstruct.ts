import { randomUUID } from "node:crypto";
import {
  type ApiRequest,
  type ApiResponse,
  sendJson,
  setBaseHeaders,
} from "./_lib/http";

export default async function handler(_req: ApiRequest, res: ApiResponse) {
  const requestId = randomUUID();
  setBaseHeaders(res, requestId);

  return sendJson(res, 410, {
    error:
      "Legacy raw-text reconstruction endpoint is disabled. Use /api/uploads/create and /api/documents/reconstruct.",
  });
}
