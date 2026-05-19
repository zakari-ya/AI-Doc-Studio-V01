import type { IncomingMessage, ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import reconstructHandler from "./api/reconstruct";

type DevRequest = IncomingMessage & {
  originalUrl?: string;
};

type DevResponse = ServerResponse & {
  status: (code: number) => DevResponse;
  json: (body: unknown) => void;
};

function createDevApiPlugin(): Plugin {
  return {
    name: "local-reconstruct-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const request = req as DevRequest;
        const requestUrl = request.originalUrl ?? request.url ?? "";

        if (!requestUrl.startsWith("/api/reconstruct")) {
          next();
          return;
        }

        const response = res as DevResponse;
        response.status = (code: number) => {
          response.statusCode = code;
          return response;
        };
        response.json = (body: unknown) => {
          if (!response.headersSent) {
            response.setHeader("Content-Type", "application/json; charset=utf-8");
          }
          response.end(JSON.stringify(body));
        };

        try {
          await reconstructHandler(request as Parameters<typeof reconstructHandler>[0], response as Parameters<typeof reconstructHandler>[1]);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected dev server error.";
          if (!response.writableEnded) {
            response.status(500).json({ error: message });
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (env.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY) {
    process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
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
