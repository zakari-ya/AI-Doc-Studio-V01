export type ApiRequest = Request;

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

type ApiLogDetails = Record<string, boolean | number | string | null | undefined>;

function sanitizeLogDetails(details: ApiLogDetails) {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  );
}

export function logApiEvent(
  route: string,
  requestId: string,
  stage: string,
  details: ApiLogDetails = {},
) {
  console.info(
    JSON.stringify({
      level: "info",
      route,
      requestId,
      stage,
      ...sanitizeLogDetails(details),
    }),
  );
}

export function logApiError(
  route: string,
  requestId: string,
  stage: string,
  error: unknown,
  details: ApiLogDetails = {},
) {
  const errorDetails =
    error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
        }
      : {
          errorName: "UnknownError",
          errorMessage: String(error),
        };

  console.error(
    JSON.stringify({
      level: "error",
      route,
      requestId,
      stage,
      ...sanitizeLogDetails(details),
      ...errorDetails,
    }),
  );
}

export function createBaseHeaders(
  requestId: string,
  headers: HeadersInit = {},
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("Referrer-Policy", "no-referrer");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("X-Request-Id", requestId);
  return responseHeaders;
}

export function sendJson(
  statusCode: number,
  body: Record<string, unknown>,
  headers: HeadersInit = {},
) {
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has("Content-Type")) {
    responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: responseHeaders,
  });
}

export function getHeaderValue(headers: Headers, name: string) {
  const value = headers.get(name);
  return value && value.length > 0 ? value : null;
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
  const forwardedProto = getHeaderValue(req.headers, "x-forwarded-proto");
  const host =
    getHeaderValue(req.headers, "x-forwarded-host") ??
    getHeaderValue(req.headers, "host");

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
  const origin = getHeaderValue(req.headers, "origin");
  if (origin) {
    return normalizeOrigin(origin);
  }

  const referer = getHeaderValue(req.headers, "referer");
  return referer ? normalizeOrigin(referer) : null;
}

export function enforceOrigin(req: ApiRequest) {
  const requestOrigin = getRequestOrigin(req);
  const secFetchSite = getHeaderValue(req.headers, "sec-fetch-site");

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
  const contentType = getHeaderValue(req.headers, "content-type");
  if (!contentType?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json.");
  }
}

export function enforceMethod(req: ApiRequest, allowedMethod = "POST") {
  if (req.method.toUpperCase() !== allowedMethod.toUpperCase()) {
    throw new HttpError(405, "Method not allowed.", {
      Allow: allowedMethod,
    });
  }
}

export function enforceBodySize(req: ApiRequest, maxBodyBytes: number) {
  const rawContentLength = getHeaderValue(req.headers, "content-length");
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
  const rawBody = await req.text();
  const rawBodyBytes = Buffer.byteLength(rawBody, "utf8");

  if (rawBodyBytes > maxBodyBytes) {
    throw new HttpError(
      413,
      `Request body too large. Keep payloads below ${maxBodyBytes.toLocaleString()} bytes.`,
    );
  }

  const trimmed = rawBody.trim();
  if (!trimmed) {
    return {};
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export function handleApiError(
  error: unknown,
  requestId: string,
  route = "unknown",
  stage = "unhandled",
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

  logApiError(route, requestId, stage, error, {
    statusCode: httpError.statusCode,
    publicMessage: httpError.message,
  });

  return sendJson(
    httpError.statusCode,
    {
      error: httpError.message,
      requestId,
      statusCode: httpError.statusCode,
      route,
      stage,
    },
    createBaseHeaders(requestId, httpError.headers),
  );
}
