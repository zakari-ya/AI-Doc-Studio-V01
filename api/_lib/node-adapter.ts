import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "./http";

type WebHandler = (request: Request) => Response | Promise<Response>;
type NodeBodyInit = Exclude<BodyInit, ReadableStream> | undefined;

type NodeRequestWithBody = IncomingMessage & {
  body?: unknown;
  originalUrl?: string;
};

function headerValueToString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getRequestUrl(req: NodeRequestWithBody) {
  const rawUrl = req.originalUrl ?? req.url ?? "/";
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }

  const host = headerValueToString(req.headers["x-forwarded-host"]) ||
    headerValueToString(req.headers.host) ||
    "localhost";
  const proto = headerValueToString(req.headers["x-forwarded-proto"]) ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return new URL(rawUrl, `${proto}://${host}`).toString();
}

async function readNodeBody(req: NodeRequestWithBody) {
  const method = req.method?.toUpperCase() ?? "GET";
  if (method === "GET" || method === "HEAD") {
    return undefined;
  }

  if (typeof req.body === "string" || req.body instanceof Uint8Array) {
    return req.body;
  }

  if (req.body && typeof req.body === "object") {
    return JSON.stringify(req.body);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const body = Buffer.concat(chunks);
  return body.length > 0 ? body : undefined;
}

function isWebRequest(value: unknown): value is Request {
  return typeof Request !== "undefined" && value instanceof Request;
}

function getHeaders(req: IncomingMessage) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  return headers;
}

async function writeWebResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  res.end(Buffer.from(await response.arrayBuffer()));
}

function writeNodeJson(
  res: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function createNodeHandler(webHandler: WebHandler) {
  return async function vercelHandler(
    req: Request | NodeRequestWithBody,
    res?: ServerResponse,
  ) {
    try {
      if (isWebRequest(req) || !res) {
        return webHandler(req as Request);
      }

      if (
        typeof Request === "undefined" ||
        typeof Response === "undefined" ||
        typeof Headers === "undefined"
      ) {
        writeNodeJson(res, 500, {
          error:
            "This runtime is missing Web Request/Response APIs. Set the Vercel Node.js version to 20.x or newer.",
        });
        return;
      }

      const body = await readNodeBody(req) as NodeBodyInit;
      const requestInit: RequestInit = {
        method: req.method ?? "GET",
        headers: getHeaders(req),
      };

      if (body !== undefined) {
        requestInit.body = body;
      }

      const request = new Request(getRequestUrl(req), {
        ...requestInit,
      });

      await writeWebResponse(res, await webHandler(request));
    } catch (error) {
      console.error("[node-adapter] Unhandled adapter error", error);
      if (res) {
        writeNodeJson(res, 500, { error: "Unexpected server error." });
        return;
      }

      return sendJson(500, { error: "Unexpected server error." });
    }
  };
}
