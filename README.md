# AI Doc Studio

Security-first PDF to Markdown reconstruction studio built with React, Vite, and Vercel Functions. The app extracts text from digital PDF files in the browser, sends only validated text to a guarded serverless endpoint, reconstructs the document with OpenRouter, sanitizes the result, and lets the user review or export Markdown, TXT, or DOCX.

## Status

Production-oriented and Vercel-ready after environment configuration.

## Highlights

- Browser-side PDF text extraction with `pdf.js`
- Server-side LLM reconstruction through `/api/reconstruct`
- Strict input validation with `zod`
- Sanitized Markdown output with `DOMPurify` and `rehype-sanitize`
- Same-origin API design with origin allowlisting
- Optional durable rate limiting through Vercel KV REST variables
- Hardened security headers through `vercel.json`
- Local DOCX generation and preview without exposing provider secrets

## Security First

This project is intentionally biased toward safe defaults.

- The OpenRouter API key never reaches the browser bundle.
- The frontend only calls the local `/api/reconstruct` endpoint.
- The API accepts `POST` requests only and requires JSON payloads.
- Request size, extracted text size, file size, and page count are all capped.
- Suspicious files are rejected using both MIME checks and binary signature checks.
- AI output is validated, sanitized, and rendered through a restricted Markdown pipeline.
- Same-origin requests are enforced through `Origin` and `Referer` checks.
- Security headers include CSP, HSTS, COOP, CORP, `nosniff`, and `no-referrer`.
- Legacy service-worker caching is actively removed to avoid stale deploys.

## What This Project Does

1. Accepts a local PDF file from the browser.
2. Verifies the file type and size before processing.
3. Extracts text locally with `pdf.js`.
4. Sends validated text to a Vercel serverless function.
5. Calls OpenRouter from the server only.
6. Validates and sanitizes the response.
7. Lets the user edit, preview, copy, and export the final document.

## What This Project Does Not Do

- It does not expose the model provider key to the client.
- It does not OCR scanned image PDFs.
- It does not store uploaded files or reconstructed content on the server.
- It does not support arbitrary HTML rendering from model output.

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- Motion
- Lucide React

### Document Processing

- `pdf.js` for browser-side PDF text extraction
- `file-type` for binary signature validation
- `docx` for export generation
- `docx-preview` for local preview rendering

### Content Safety

- `zod` for runtime validation
- `DOMPurify` for output sanitization
- `react-markdown` + `remark-gfm` + `rehype-sanitize` for safe rendering

### Backend and Deployment

- Vercel Functions
- Browser `fetch` API for the frontend request path
- Server-side `fetch` to OpenRouter
- Optional Vercel KV REST integration for durable rate limiting

## External Services and Fetchers

The application uses only two network paths in production:

- Browser to app backend: `POST /api/reconstruct`
- App backend to model provider: `POST https://openrouter.ai/api/v1/chat/completions`

Optional infrastructure:

- Vercel KV REST API when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are configured for durable rate limiting

No CDN fonts, no client-side model calls, and no third-party analytics are required by the app.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Yes | Secret API key used only by the serverless function |
| `APP_BASE_URL` | Yes in production | Canonical app URL used for origin checks and provider attribution |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated explicit origin allowlist |
| `OPENROUTER_HTTP_REFERER` | Recommended | Sent to OpenRouter as request attribution |
| `KV_REST_API_URL` | Optional | Enables durable rate limiting via Vercel KV / Upstash REST |
| `KV_REST_API_TOKEN` | Optional | Auth token for the KV REST endpoint |

Start from [.env.example](/home/zakariya/Downloads/ai-docs-studio/AI-Doc-Studio-V01/.env.example:1).

## Project Structure

```text
.
├── api/
│   └── reconstruct.ts        # Vercel serverless reconstruction endpoint
├── public/
│   ├── favicone.png          # App icon
│   ├── manifest.json         # Web manifest
│   └── service-worker.js     # Legacy-cache cleanup worker
├── src/
│   ├── components/
│   │   ├── EditorWorkspace.tsx
│   │   ├── LandingPage.tsx
│   │   ├── ProcessingState.tsx
│   │   └── UploadSection.tsx
│   ├── lib/
│   │   ├── openrouter.ts     # Frontend API client
│   │   ├── pdf.ts            # Browser PDF extraction
│   │   ├── reconstruction.ts # Prompt + model selection
│   │   ├── sanitizer.ts      # Content sanitization
│   │   ├── schemas.ts        # Shared runtime limits and validation
│   │   └── utils.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .env.example
├── package.json
├── vercel.json
└── vite.config.ts
```

## Local Development

### Prerequisites

- Node.js 20.12+
- npm

### Setup

```bash
npm install
cp .env.example .env
```

Set at least:

```bash
OPENROUTER_API_KEY="your-key"
APP_BASE_URL="http://localhost:3000"
ALLOWED_ORIGINS="http://localhost:3000"
OPENROUTER_HTTP_REFERER="http://localhost:3000"
```

### Run

```bash
npm run dev
```

The Vite development server includes the local `/api/reconstruct` bridge through `vite.config.ts`, so the frontend and serverless handler share the same local origin during development.

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run check
npm run security:audit
npm run clean
```

## Vercel Deployment

### Required Vercel Project Settings

1. Import the repository into Vercel.
2. Set the framework preset to `Vite` if Vercel does not detect it automatically.
3. Add the production environment variables:
   - `OPENROUTER_API_KEY`
   - `APP_BASE_URL`
   - `ALLOWED_ORIGINS`
   - `OPENROUTER_HTTP_REFERER`
4. Optional but recommended: attach Vercel KV and expose:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
5. Deploy.

### Recommended Production Values

If your production domain is `https://docs.example.com`:

```bash
APP_BASE_URL="https://docs.example.com"
ALLOWED_ORIGINS="https://docs.example.com"
OPENROUTER_HTTP_REFERER="https://docs.example.com"
```

If you use preview deployments and want them to work, include preview origins explicitly or generate them through your Vercel environment setup.

## Security Checklist Before Going Live

- Set `OPENROUTER_API_KEY` in Vercel and do not commit `.env`.
- Set `APP_BASE_URL` to the exact production origin.
- Set `ALLOWED_ORIGINS` to the exact allowed origins.
- Attach Vercel KV if you want durable rate limiting across serverless instances.
- Verify the CSP in `vercel.json` after any future third-party asset additions.
- Keep `npm run check` and `npm run security:audit` green before deploys.
- Review provider cost limits and quotas in OpenRouter.

## Operational Limits

Current application guards:

- Maximum PDF size: 15 MB
- Maximum PDF pages: 40
- Maximum extracted text: 200,000 characters
- Maximum output size: 250,000 characters
- Maximum API requests per IP per minute: 5

These limits are designed to reduce abuse, lower timeout risk, and keep model costs bounded.

## Known Limitations

- Scanned image PDFs are not OCR-processed.
- Rate limiting is durable only when Vercel KV REST variables are configured.
- Very complex PDF layouts may still require manual editing after reconstruction.
- DOCX preview fidelity depends on the generated markdown structure.

## Verification

Before merging or deploying, run:

```bash
npm run check
npm run security:audit
```

## Contributing

1. Fork the repository.
2. Create a branch for your change.
3. Run the verification commands.
4. Open a pull request with a clear description of the security and behavior impact.

## License

No license file is included in this repository yet. Add a project license before publishing it as a public open-source project.
