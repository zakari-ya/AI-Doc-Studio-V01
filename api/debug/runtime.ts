import type { IncomingMessage, ServerResponse } from "node:http";

function getHeader(req: IncomingMessage, name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function isAuthorized(req: IncomingMessage) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authToken = getHeader(req, "authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const debugSecret = getHeader(req, "x-debug-secret");
  return authToken === secret || debugSecret === secret;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Debug authorization required." });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    nodeVersion: process.version,
    runtime: "node",
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelRegion: process.env.VERCEL_REGION ?? null,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasSupabaseDatabaseUrl: Boolean(process.env.SUPABASE_DATABASE_URL),
    hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
    hasCronSecret: Boolean(process.env.CRON_SECRET),
    hasRequestApi: typeof Request !== "undefined",
    hasResponseApi: typeof Response !== "undefined",
    hasHeadersApi: typeof Headers !== "undefined",
  });
}
