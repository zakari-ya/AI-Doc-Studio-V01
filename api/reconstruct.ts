import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";

const MAX_RAW_TEXT_CHARS = 200_000;
const MAX_OUTPUT_CHARS = 250_000;

const AIReconstructionSchema = z.object({
  rawText: z
    .string()
    .min(1, "Input text cannot be empty")
    .max(MAX_RAW_TEXT_CHARS, "Input text is too large."),
  segmentIndex: z.number().int().min(0).optional(),
  segmentCount: z.number().int().min(1).optional(),
});

const AIOutputSchema = z.object({
  content: z
    .string()
    .min(1, "AI output is empty")
    .max(MAX_OUTPUT_CHARS, "AI output is excessively large."),
});

const RECONSTRUCTION_MODELS = [
  "z-ai/glm-4.5-air:free",
  "openrouter/owl-alpha",
] as const;

type ReconstructionPromptOptions = {
  segmentCount?: number;
  segmentIndex?: number;
};

function buildReconstructionPrompt(
  rawText: string,
  options: ReconstructionPromptOptions = {},
): string {
  const hasSegmentation =
    typeof options.segmentCount === "number" && options.segmentCount > 1;
  const segmentInstructions = hasSegmentation
    ? `
SEGMENT CONTEXT:
- This is segment ${Number(options.segmentIndex ?? 0) + 1} of ${options.segmentCount}.
- Reconstruct only this segment into markdown.
- Preserve headings, lists, and tables exactly as they appear in this segment.
- Do not mention missing previous or next segments.
- Do not invent a new global title unless this segment clearly contains one.
`
    : "";

  return `
You are a document reconstruction expert.
Below is raw text extracted from a PDF.
Your task is to reconstruct the original document structure into clean, professional Markdown.
${segmentInstructions}
RULES:
1. Identify headings and use appropriate # levels.
2. Format lists (numbered or bulleted) correctly.
3. Reconstruct tables if data looks tabular.
4. Fix common OCR/extraction issues (broken words, missing spaces).
5. Maintain the logical flow of the document.
6. Do NOT include any meta-talk or introductory remarks. Just the Markdown.
7. Use standard Markdown syntax only.
8. Do NOT emit raw HTML blocks.

RAW TEXT:
${rawText}
  `.trim();
}

type VercelRequest = IncomingMessage & {
  body?: unknown;
};

type VercelResponse = ServerResponse;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  limit: number;
  remaining: number;
  resetAt: number;
};

type UpstashResult<T> = {
  result?: T;
  error?: string;
};

const RATE_LIMIT_WINDOW_MS = 300_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const MAX_BODY_BYTES = 300_000;
const PROVIDER_TIMEOUT_MS = 150_000;
const KV_RATE_LIMIT_PREFIX = "ratelimit:reconstruct";
const rateLimitStore = new Map<string, RateLimitEntry>();

class HttpError extends Error {
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

function sendJson(
  res: VercelResponse,
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

function setResponseHeaders(res: VercelResponse, requestId: string) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Request-Id", requestId);
}

function getHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? null;
  }

  return null;
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildOriginFromHost(host: string, forwardedProto?: string | null): string {
  const isLocalHost =
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1";

  const protocol = forwardedProto ?? (isLocalHost ? "http" : "https");
  return `${protocol}://${host}`;
}

function getAllowedOrigins(req: VercelRequest) {
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

function getRequestOrigin(req: VercelRequest): string | null {
  const origin = getHeaderValue(req.headers.origin);
  if (origin) {
    return normalizeOrigin(origin);
  }

  const referer = getHeaderValue(req.headers.referer);
  return referer ? normalizeOrigin(referer) : null;
}

function enforceOrigin(req: VercelRequest) {
  const requestOrigin = getRequestOrigin(req);
  const secFetchSite = getHeaderValue(req.headers["sec-fetch-site"]);

  if (!requestOrigin) {
    if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
      throw new HttpError(403, "Cross-site requests are not allowed.");
    }
    return;
  }

  const allowedOrigins = getAllowedOrigins(req);
  if (!allowedOrigins.has(requestOrigin)) {
    throw new HttpError(403, "Origin not allowed.");
  }
}

function enforceJsonRequest(req: VercelRequest) {
  const contentType = getHeaderValue(req.headers["content-type"]);
  if (!contentType?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json.");
  }
}

function enforceBodySize(req: VercelRequest) {
  const rawContentLength = getHeaderValue(req.headers["content-length"]);
  if (!rawContentLength) {
    return;
  }

  const contentLength = Number.parseInt(rawContentLength, 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new HttpError(
      413,
      `Request body too large. Keep payloads below ${MAX_BODY_BYTES.toLocaleString()} bytes.`,
    );
  }
}

function getClientIp(req: VercelRequest): string {
  const forwardedFor = getHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = getHeaderValue(req.headers["x-real-ip"]);
  if (realIp) {
    return realIp;
  }

  return req.socket.remoteAddress ?? "unknown";
}

function buildRateLimitHeaders(result: RateLimitResult) {
  return {
    "Retry-After": String(Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1)),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(result.remaining, 0)),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

function enforceInMemoryRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const currentEntry = rateLimitStore.get(ip);

  if (!currentEntry || currentEntry.resetAt <= now) {
    const nextEntry = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
    rateLimitStore.set(ip, nextEntry);
    return {
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt: nextEntry.resetAt,
    };
  }

  currentEntry.count += 1;

  if (currentEntry.count > RATE_LIMIT_MAX_REQUESTS) {
    throw new HttpError(
      429,
      "Rate limit exceeded. Please wait a few minutes before trying again.",
      buildRateLimitHeaders({
        limit: RATE_LIMIT_MAX_REQUESTS,
        remaining: 0,
        resetAt: currentEntry.resetAt,
      }),
    );
  }

  return {
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: RATE_LIMIT_MAX_REQUESTS - currentEntry.count,
    resetAt: currentEntry.resetAt,
  };
}

async function callKv<T>(
  path: string,
  requestId: string,
): Promise<UpstashResult<T> | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    const response = await fetch(`${url}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`KV REST call failed with status ${response.status}`);
    }

    return (await response.json()) as UpstashResult<T>;
  } catch (error) {
    console.error(`[${requestId}] KV rate limit fallback activated`, error);
    return null;
  }
}

async function enforceDistributedRateLimit(
  ip: string,
  requestId: string,
): Promise<RateLimitResult | null> {
  const key = encodeURIComponent(`${KV_RATE_LIMIT_PREFIX}:${ip}`);
  const increment = await callKv<number>(`/incr/${key}`, requestId);

  if (!increment || typeof increment.result !== "number") {
    return null;
  }

  if (increment.result === 1) {
    await callKv<string>(`/expire/${key}/${RATE_LIMIT_WINDOW_MS / 1000}`, requestId);
  }

  const ttl = await callKv<number>(`/ttl/${key}`, requestId);
  const ttlSeconds = typeof ttl?.result === "number" && ttl.result > 0 ? ttl.result : Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
  const resetAt = Date.now() + ttlSeconds * 1000;

  if (increment.result > RATE_LIMIT_MAX_REQUESTS) {
    throw new HttpError(
      429,
      "Rate limit exceeded. Please wait a few minutes before trying again.",
      buildRateLimitHeaders({
        limit: RATE_LIMIT_MAX_REQUESTS,
        remaining: 0,
        resetAt,
      }),
    );
  }

  return {
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: RATE_LIMIT_MAX_REQUESTS - increment.result,
    resetAt,
  };
}

async function enforceRateLimit(
  ip: string,
  requestId: string,
): Promise<RateLimitResult> {
  const distributedResult = await enforceDistributedRateLimit(ip, requestId);
  return distributedResult ?? enforceInMemoryRateLimit(ip);
}

async function readJsonBody(req: VercelRequest): Promise<unknown> {
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

    if (totalBytes > MAX_BODY_BYTES) {
      throw new HttpError(
        413,
        `Request body too large. Keep payloads below ${MAX_BODY_BYTES.toLocaleString()} bytes.`,
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

function getProviderReferer(req: VercelRequest): string | undefined {
  const explicitReferer = process.env.OPENROUTER_HTTP_REFERER;
  if (explicitReferer) {
    return explicitReferer;
  }

  const host =
    getHeaderValue(req.headers["x-forwarded-host"]) ??
    getHeaderValue(req.headers.host);
  if (!host) {
    return process.env.APP_BASE_URL;
  }

  return buildOriginFromHost(
    host,
    getHeaderValue(req.headers["x-forwarded-proto"]),
  );
}

async function callOpenRouter(
  rawText: string,
  req: VercelRequest,
  requestId: string,
  validationSegmentIndex?: number,
  validationSegmentCount?: number,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new HttpError(500, "OPENROUTER_API_KEY is missing in Vercel Environment Variables.");
  }

  const prompt = buildReconstructionPrompt(rawText, {
    segmentIndex: validationSegmentIndex,
    segmentCount: validationSegmentCount,
  });
  const providerReferer = getProviderReferer(req);
  let lastError: HttpError | null = null;

  for (const model of RECONSTRUCTION_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "AI-Doc-Studio",
          ...(providerReferer ? { "HTTP-Referer": providerReferer } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const providerErrorBody = await response.text().catch(() => "");
        const providerMessage = providerErrorBody.slice(0, 500);

        if (response.status === 401 || response.status === 403) {
          throw new HttpError(
            500,
            "OpenRouter rejected the server API key. Check OPENROUTER_API_KEY in Vercel Environment Variables.",
          );
        }

        if (response.status === 429) {
          throw new HttpError(
            503,
            "Reconstruction provider is temporarily unavailable. Please try again shortly.",
          );
        }

        throw new HttpError(
          502,
          `OpenRouter returned HTTP ${response.status}. ${providerMessage || "No provider error body."}`,
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const rawOutput = data.choices?.[0]?.message?.content ?? "";
      const outputValidation = AIOutputSchema.safeParse({ content: rawOutput });
      if (!outputValidation.success) {
        throw new HttpError(
          502,
          "Reconstruction provider returned an invalid response. Please try again.",
        );
      }

      return outputValidation.data.content;
    } catch (error) {
      if (error instanceof HttpError) {
        lastError = error;
        console.error(`[${requestId}] Provider request failed for model ${model}`, error.message);
      } else if (error instanceof Error && error.name === "AbortError") {
        lastError = new HttpError(
          504,
          "Reconstruction is taking longer than expected. The extracted text is still available for editing.",
        );
        console.error(`[${requestId}] Provider request timed out for model ${model}`);
      } else {
        lastError = new HttpError(
          502,
          "Failed to reconstruct document. Please try again.",
        );
        console.error(`[${requestId}] Provider request failed for model ${model}`, error);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new HttpError(502, "Failed to reconstruct document. Please try again.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = randomUUID();
  setResponseHeaders(res, requestId);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    enforceOrigin(req);
    enforceJsonRequest(req);
    enforceBodySize(req);

    const rateLimit = await enforceRateLimit(getClientIp(req), requestId);
    const rateLimitHeaders = buildRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
      res.setHeader(key, value);
    }

    const body = await readJsonBody(req);
    const validation = AIReconstructionSchema.safeParse(body);
    if (!validation.success) {
      throw new HttpError(400, validation.error.issues[0]?.message ?? "Invalid request payload.");
    }

    if (validation.data.rawText.length > MAX_RAW_TEXT_CHARS) {
      throw new HttpError(413, "Input text exceeds the maximum supported length.");
    }

    const content = await callOpenRouter(
      validation.data.rawText,
      req,
      requestId,
      validation.data.segmentIndex,
      validation.data.segmentCount,
    );
    return sendJson(res, 200, { content });
  } catch (error) {
    const httpError =
      error instanceof HttpError
        ? error
        : new HttpError(500, "Unexpected server error.");

    if (!(error instanceof HttpError)) {
      console.error(`[${requestId}] Unhandled reconstruction error`, error);
    }

    return sendJson(res, httpError.statusCode, { error: httpError.message }, httpError.headers);
  }
}
