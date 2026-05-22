import type { IncomingMessage, ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import * as reconstructHandler from "./api/documents/reconstruct";
import * as cleanupHandler from "./api/maintenance/cleanup";
import * as createUploadHandler from "./api/uploads/create";
import * as legacyReconstructHandler from "./api/reconstruct";

type DevRequest = IncomingMessage & {
  originalUrl?: string;
};

type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

type RouteModule = Partial<
  Record<HttpMethod, (request: Request) => Response | Promise<Response>>
> & {
  default?: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Response | Promise<Response> | void | Promise<void>;
};

async function readNodeRequestBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

function toRouteModule(module: RouteModule): RouteModule {
  return module;
}

function createDevApiPlugin(): Plugin {
  const handlers = new Map<string, RouteModule>();

  handlers.set(
    "/api/uploads/create",
    toRouteModule({
      POST: createUploadHandler.POST,
      default: createUploadHandler.default,
    }),
  );
  handlers.set(
    "/api/documents/reconstruct",
    toRouteModule({
      POST: reconstructHandler.POST,
      default: reconstructHandler.default,
    }),
  );
  handlers.set(
    "/api/maintenance/cleanup",
    toRouteModule({
      POST: cleanupHandler.POST,
      default: cleanupHandler.default,
    }),
  );
  handlers.set(
    "/api/reconstruct",
    toRouteModule({
      POST: legacyReconstructHandler.POST,
      default: legacyReconstructHandler.default,
    }),
  );

  return {
    name: "local-secure-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const request = req as DevRequest;
        const requestUrl = request.originalUrl ?? request.url ?? "";
        const pathname = requestUrl.split("?")[0] ?? "";
        const routeModule = handlers.get(pathname);

        if (!routeModule) {
          next();
          return;
        }

        const method = (request.method ?? "GET").toUpperCase() as HttpMethod;
        const handler = routeModule[method];
        const defaultHandler = routeModule.default;

        if (!handler && !defaultHandler) {
          res.statusCode = 405;
          res.setHeader("Allow", Object.keys(routeModule).join(", "));
          res.end(JSON.stringify({ error: "Method not allowed." }));
          return;
        }

        try {
          if (defaultHandler) {
            const result = await defaultHandler(request, res);
            if (result instanceof Response && !res.writableEnded) {
              await writeWebResponse(res, result);
            }
            return;
          }

          if (!handler) {
            res.statusCode = 405;
            res.setHeader("Allow", Object.keys(routeModule).join(", "));
            res.end(JSON.stringify({ error: "Method not allowed." }));
            return;
          }

          const headers = new Headers();
          for (const [key, value] of Object.entries(request.headers)) {
            if (Array.isArray(value)) {
              for (const item of value) {
                headers.append(key, item);
              }
            } else if (typeof value === "string") {
              headers.set(key, value);
            }
          }

          const body =
            method === "GET" || method === "HEAD"
              ? undefined
              : await readNodeRequestBody(request);
          const url = new URL(requestUrl, "http://localhost:3000");
          const webRequest = new Request(url, {
            method,
            headers,
            body: body && body.length > 0 ? body : undefined,
          });

          const response = await handler(webRequest);
          await writeWebResponse(res, response);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unexpected dev server error.";
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: message }));
          }
        }
      });
    },
  };
}

async function writeWebResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (env.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY) {
    process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
  }

  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value;
  }

  return {
    plugins: [react(), tailwindcss(), createDevApiPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
      dedupe: [
        "prosemirror-model",
        "prosemirror-state",
        "prosemirror-view",
        "prosemirror-transform",
        "prosemirror-commands",
        "prosemirror-schema-list",
        "prosemirror-dropcursor",
        "prosemirror-gapcursor",
        "prosemirror-history",
        "prosemirror-keymap",
      ],
    },
    optimizeDeps: {
      exclude: ["@blocknote/core", "@blocknote/react", "@blocknote/mantine"],
      include: [
        "use-sync-external-store/shim/with-selector.js",
        "use-sync-external-store",
      ],
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("pdfjs-dist")) {
              return "pdf-vendor";
            }

            if (id.includes("docx-preview") || id.includes("/docx/")) {
              return "docx-vendor";
            }

            if (
              id.includes("react-markdown") ||
              id.includes("remark-gfm") ||
              id.includes("rehype-sanitize")
            ) {
              return "markdown-vendor";
            }

            if (id.includes("motion") || id.includes("lucide-react")) {
              return "ui-vendor";
            }

            if (id.includes("react") || id.includes("scheduler")) {
              return "react-vendor";
            }
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
