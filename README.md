# AI Doc Studio

Security-first PDF-to-Markdown reconstruction studio built for Vercel. Users sign in with Clerk, upload PDFs directly to a private Supabase Storage bucket, and a protected Vercel Function extracts text transiently before reconstructing clean Markdown through OpenRouter.

## Status

Production-ready after Clerk, Supabase, OpenRouter, and Vercel environment variables are configured. The app no longer uses React state as the PDF lifecycle or sends raw files to `/api/reconstruct`; the browser uses a short-lived Supabase signed upload token and the server owns extraction, rate limiting, and reconstruction.

## Features

- Invite-only authentication with `Clerk`.
- Private temporary PDF storage in `Supabase Storage`.
- Server-side PDF extraction with `pdf.js` inside Vercel Functions.
- OpenRouter reconstruction with chunking, retries, timeout guards, and output validation.
- Per-user daily reconstruction quota with `rate-limiter-flexible` and Supabase Postgres.
- Markdown sanitization with `DOMPurify`, `react-markdown`, and `rehype-sanitize`.
- Export to Markdown, TXT, and DOCX.
- Vercel Cron cleanup for expired files and stored reconstruction content.

## Security First

- `CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DATABASE_URL`, and `OPENROUTER_API_KEY` are server-only.
- API routes require `Authorization: Bearer <Clerk session token>`.
- Document rows are scoped by `clerk_user_id`; another user cannot reconstruct someone else’s document.
- The Supabase bucket is private and uploads use signed upload tokens.
- PDF type, signature, size, and page count are validated before OpenRouter is called.
- Rate limiting is per Clerk user id: `20` reconstructions per day.
- Production rate-limiter storage fails closed with `503` if Supabase Postgres is unavailable.
- CSP, HSTS, `nosniff`, `no-referrer`, COOP, CORP, and restrictive permissions are configured in `vercel.json`.
- Uploaded PDFs expire after `24 hours`; cleanup marks rows expired and removes storage objects.

## Tech Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| Auth | Clerk |
| Database | Supabase Postgres |
| File Storage | Private Supabase Storage bucket |
| Rate Limiting | `rate-limiter-flexible` + `pg` |
| PDF Extraction | `pdfjs-dist` |
| Validation | `zod`, `file-type` |
| Markdown Safety | `DOMPurify`, `react-markdown`, `rehype-sanitize` |
| Export | `docx`, `docx-preview` |
| Deployment | Vercel Functions + Vercel Cron |

## Data Flow

1. Signed-out users see Clerk sign-in and cannot access app actions.
2. Signed-in user selects a PDF.
3. Browser validates basic metadata and first-byte signature.
4. Browser calls `POST /api/uploads/create` with a Clerk bearer token.
5. Server creates a `documents` row and returns a Supabase signed upload token.
6. Browser uploads the PDF directly to private Supabase Storage.
7. Browser calls `POST /api/documents/reconstruct` with `{ documentId }`.
8. Server verifies ownership, applies rate limiting, downloads the private PDF, extracts text, reconstructs Markdown, stores results, and returns content.
9. `POST /api/maintenance/cleanup` removes expired files and marks rows as `expired`.

## API Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/uploads/create` | Clerk bearer token | Create document row and signed Supabase upload token |
| `POST /api/documents/reconstruct` | Clerk bearer token | Extract PDF text, reconstruct Markdown, persist result |
| `POST /api/maintenance/cleanup` | `CRON_SECRET` bearer token | Delete expired storage objects and expire rows |
| `POST /api/reconstruct` | Disabled | Legacy endpoint returns `410` |

## Environment Variables

Start from [.env.example](/home/zakariya/Downloads/ai-docs-studio/AI-Doc-Studio-V01/.env.example:1).

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Browser | Clerk React SDK |
| `CLERK_SECRET_KEY` | Yes | Server | Verify Clerk session tokens |
| `VITE_SUPABASE_URL` | Yes | Browser | Supabase project URL for signed storage upload |
| `VITE_SUPABASE_ANON_KEY` | Yes | Browser | Public Supabase anon key |
| `VITE_SUPABASE_STORAGE_BUCKET` | Recommended | Browser | Storage bucket name, defaults to `documents-temp` |
| `SUPABASE_URL` | Yes | Server | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server | Private database/storage admin key |
| `SUPABASE_STORAGE_BUCKET` | Recommended | Server | Storage bucket name, defaults to `documents-temp` |
| `SUPABASE_DATABASE_URL` | Yes | Server | Postgres URL for durable rate limiting |
| `SUPABASE_DATABASE_SSL` | Recommended | Server | Set to `true` for Supabase hosted Postgres |
| `OPENROUTER_API_KEY` | Yes | Server | Model provider API key |
| `APP_BASE_URL` | Yes in production | Server | Canonical origin for origin checks |
| `ALLOWED_ORIGINS` | Recommended | Server | Comma-separated origin allowlist |
| `OPENROUTER_HTTP_REFERER` | Recommended | Server | Provider attribution header |
| `CRON_SECRET` | Yes | Server | Protect cleanup endpoint |

## Supabase Setup

1. Create a Supabase project.
2. Run [supabase/schema.sql](/home/zakariya/Downloads/ai-docs-studio/AI-Doc-Studio-V01/supabase/schema.sql:1) in the SQL editor.
3. Confirm the `documents-temp` bucket is private.
4. Copy the project URL, anon key, service role key, and database connection string into Vercel.
5. Do not expose the service role key or database URL with a `VITE_` prefix.

## Clerk Setup

1. Create a Clerk application.
2. Configure sign-ups as invite-only in the Clerk dashboard.
3. Add the production domain and local development URL to Clerk allowed origins.
4. Set `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in Vercel.

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

The Vite dev server bridges `/api/uploads/create`, `/api/documents/reconstruct`, and `/api/maintenance/cleanup` to the local API handlers.

## Vercel Deployment

1. Import the repository into Vercel.
2. Use the Vite framework preset.
3. Add all required environment variables for Production and Preview as needed.
4. Ensure `APP_BASE_URL` and `ALLOWED_ORIGINS` match the deployed origin.
5. Deploy.

`vercel.json` configures function timeouts, hardened headers, CSP allowlists for Clerk/Supabase/Vercel Live, and an hourly cleanup cron.

## Project Structure

```text
.
├── api/
│   ├── _lib/                  # Server auth, HTTP, Supabase, PDF, rate limit helpers
│   ├── documents/
│   │   └── reconstruct.ts      # Authenticated extraction + reconstruction
│   ├── maintenance/
│   │   └── cleanup.ts          # Cron cleanup endpoint
│   ├── uploads/
│   │   └── create.ts           # Signed upload creation
│   └── reconstruct.ts          # Disabled legacy endpoint
├── src/
│   ├── components/             # Upload, processing, landing, editor UI
│   ├── lib/                    # Browser API client, sanitizer, schemas, exports
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   └── schema.sql              # Database, bucket, and rate limiter bootstrap
├── vercel.json
└── vite.config.ts
```

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run check
npm run security:audit
npm run preview
```

## Operational Limits

- Maximum PDF size: `15 MB`
- Maximum PDF pages: `40`
- Maximum extracted text: `200,000` characters
- Maximum reconstructed output: `250,000` characters
- Temporary retention: `24 hours`
- Rate limit: `20` reconstructions per Clerk user per day

## Verification

```bash
npm run check
npm run security:audit
```

Recommended manual checks:

- Signed-out user cannot reach upload actions.
- API calls without a Clerk bearer token return `401`.
- A valid PDF uploads to the private Supabase bucket and creates a `documents` row.
- A different Clerk user cannot reconstruct the document.
- Invalid PDF signatures and oversized files are rejected before OpenRouter.
- User receives `429` after the daily reconstruction quota.
- Cleanup removes expired storage objects and marks rows `expired`.

## Known Limitations

- Scanned image PDFs are not OCR processed.
- Very complex layouts may still need manual editing after reconstruction.
- Vercel Function duration and OpenRouter model latency can still limit very large documents.

## License

No license file is included yet. Add a license before publishing as a public open-source project.
