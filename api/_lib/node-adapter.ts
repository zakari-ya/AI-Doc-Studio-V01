import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "./http";

type WebHandler = (request: Request) => Response | Promise<Response>;

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

export function createNodeHandler(webHandler: WebHandler) {
  return async function vercelHandler(
    req: Request | NodeRequestWithBody,
    res?: ServerResponse,
  ) {
    if (req instanceof Request || !res) {
      return webHandler(req as Request);
    }

    try {
      const request = new Request(getRequestUrl(req), {
        method: req.method ?? "GET",
        headers: getHeaders(req),
        body: await readNodeBody(req),
      });

      await writeWebResponse(res, await webHandler(request));
    } catch (error) {
      console.error("[node-adapter] Unhandled adapter error", error);
      await writeWebResponse(
        res,
        sendJson(500, { error: "Unexpected server error." }),
      );
    }
  };
}
