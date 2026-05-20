import type { IncomingMessage, ServerResponse } from "node:http";

export type ApiRequest = IncomingMessage & {
  body?: unknown;
};

export type ApiResponse = ServerResponse;

export class HttpError extends Error {
  statusCode: number;
  headers: Record<string, string>;

  constructor(
    statusCode: number,
    message: string,
    headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.headers = headers;
  }
}

export function sendJson(
  res: ApiResponse,
  statusCode: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  res.statusCode = statusCode;

  if (!res.hasHeader("Content-Type")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }

  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  res.end(JSON.stringify(body));
}

export function setBaseHeaders(res: ApiResponse, requestId: string) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Request-Id", requestId);
}

export function getHeaderValue(value: string | string[] | undefined) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? null;
  }

  return null;
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildOriginFromHost(host: string, forwardedProto?: string | null) {
  const isLocalHost =
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1";

  const protocol = forwardedProto ?? (isLocalHost ? "http" : "https");
  return `${protocol}://${host}`;
}

function getAllowedOrigins(req: ApiRequest) {
  const allowedOrigins = new Set<string>();
  const envOrigins = process.env.ALLOWED_ORIGINS?.split(",") ?? [];
  const forwardedProto = getHeaderValue(req.headers["x-forwarded-proto"]);
  const host =
    getHeaderValue(req.headers["x-forwarded-host"]) ??
    getHeaderValue(req.headers.host);

  for (const candidate of envOrigins) {
    const normalized = normalizeOrigin(candidate.trim());
    if (normalized) {
      allowedOrigins.add(normalized);
    }
  }

  for (const candidate of [
    process.env.APP_BASE_URL,
    process.env.OPENROUTER_HTTP_REFERER,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ]) {
    if (!candidate) {
      continue;
    }

    const normalized = normalizeOrigin(candidate);
    if (normalized) {
      allowedOrigins.add(normalized);
    }
  }

  if (host) {
    allowedOrigins.add(buildOriginFromHost(host, forwardedProto));
  }

  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://127.0.0.1:3000");

  return allowedOrigins;
}

function getRequestOrigin(req: ApiRequest) {
  const origin = getHeaderValue(req.headers.origin);
  if (origin) {
    return normalizeOrigin(origin);
  }

  const referer = getHeaderValue(req.headers.referer);
  return referer ? normalizeOrigin(referer) : null;
}

export function enforceOrigin(req: ApiRequest) {
  const requestOrigin = getRequestOrigin(req);
  const secFetchSite = getHeaderValue(req.headers["sec-fetch-site"]);

  if (!requestOrigin) {
    if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
      throw new HttpError(403, "Cross-site requests are not allowed.");
    }
    return;
  }

  if (!getAllowedOrigins(req).has(requestOrigin)) {
    throw new HttpError(403, "Origin not allowed.");
  }
}

export function enforceJsonRequest(req: ApiRequest) {
  const contentType = getHeaderValue(req.headers["content-type"]);
  if (!contentType?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json.");
  }
}

export function enforceMethod(
  req: ApiRequest,
  res: ApiResponse,
  allowedMethod = "POST",
) {
  if (req.method !== allowedMethod) {
    res.setHeader("Allow", allowedMethod);
    throw new HttpError(405, "Method not allowed.");
  }
}

export function enforceBodySize(req: ApiRequest, maxBodyBytes: number) {
  const rawContentLength = getHeaderValue(req.headers["content-length"]);
  if (!rawContentLength) {
    return;
  }

  const contentLength = Number.parseInt(rawContentLength, 10);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    throw new HttpError(
      413,
      `Request body too large. Keep payloads below ${maxBodyBytes.toLocaleString()} bytes.`,
    );
  }
}

export async function readJsonBody(
  req: ApiRequest,
  maxBodyBytes: number,
): Promise<unknown> {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        throw new HttpError(400, "Request body must be valid JSON.");
      }
    }

    return req.body;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const bufferChunk = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += bufferChunk.length;

    if (totalBytes > maxBodyBytes) {
      throw new HttpError(
        413,
        `Request body too large. Keep payloads below ${maxBodyBytes.toLocaleString()} bytes.`,
      );
    }

    chunks.push(bufferChunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export function handleApiError(
  error: unknown,
  res: ApiResponse,
  requestId: string,
) {
  const httpError =
    error instanceof HttpError
      ? error
      : new HttpError(
          500,
          process.env.NODE_ENV === "production" || !(error instanceof Error)
            ? "Unexpected server error."
            : `Unexpected server error: ${error.message}`,
        );

  if (!(error instanceof HttpError)) {
    console.error(`[${requestId}] Unhandled API error`, error);
  }

  return sendJson(
    res,
    httpError.statusCode,
    { error: httpError.message },
    httpError.headers,
  );
}
