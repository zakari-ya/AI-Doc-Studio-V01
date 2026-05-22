# AI Doc Studio

Security-first PDF-to-Markdown reconstruction studio built for Vercel. The landing page is public, authentication is handled with Supabase Auth magic links, and document processing remains private behind authenticated Vercel API routes.

## Highlights

- Public landing page with invite-only Supabase Auth magic-link login
- Private PDF uploads through signed Supabase Storage URLs
- Server-side PDF extraction and OpenRouter reconstruction
- Per-user daily rate limiting in Postgres
- Markdown sanitization plus TXT / MD / DOCX export
- Daily cleanup cron compatible with the Vercel Hobby plan

## Security Model

- Browser users must sign in before upload or reconstruction actions are allowed.
- API routes require `Authorization: Bearer <supabase access token>`.
- Document ownership is tied to `auth_user_id` from Supabase Auth.
- Uploaded PDFs live in a private `documents-temp` bucket and expire after `24 hours`.
- The service-role key, Postgres URL, and OpenRouter key stay server-only.
- Production rate limiting uses Postgres when available and falls back to the `documents` table if the dedicated limiter store is unavailable.

## Tech Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| Auth | Supabase Auth magic links |
| Database | Supabase Postgres |
| File Storage | Private Supabase Storage |
| Rate Limiting | `rate-limiter-flexible` + `pg` |
| PDF Extraction | `pdfjs-dist` |
| Deployment | Vercel Functions + Vercel Cron |

## API Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/uploads/create` | Supabase bearer token | Create a document row and signed upload URL |
| `POST /api/documents/reconstruct` | Supabase bearer token | Download, extract, reconstruct, and persist result |
| `POST /api/maintenance/cleanup` | `CRON_SECRET` bearer token | Expire old files and rows |
| `POST /api/reconstruct` | Disabled | Legacy endpoint returns `410` |

## Environment Variables

Start from [.env.example](/home/zakariya/Downloads/ai-docs-studio/AI-Doc-Studio-V01/.env.example:1).

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Browser | Supabase project URL for auth and signed uploads |
| `VITE_SUPABASE_ANON_KEY` | Yes | Browser | Public Supabase anon key |
| `VITE_SUPABASE_STORAGE_BUCKET` | Recommended | Browser | Storage bucket name, defaults to `documents-temp` |
| `SUPABASE_URL` | Yes | Server | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server | Server-only key for auth verification, DB writes, and storage access |
| `SUPABASE_STORAGE_BUCKET` | Recommended | Server | Storage bucket name, defaults to `documents-temp` |
| `SUPABASE_DATABASE_URL` | Recommended | Server | Postgres URL for the primary rate-limiter store |
| `SUPABASE_DATABASE_SSL` | Recommended | Server | Set to `true` for hosted Supabase Postgres |
| `OPENROUTER_API_KEY` | Yes | Server | Reconstruction model provider key |
| `APP_BASE_URL` | Yes in production | Server | Canonical app URL and magic-link redirect target |
| `ALLOWED_ORIGINS` | Recommended | Server | Comma-separated origin allowlist |
| `OPENROUTER_HTTP_REFERER` | Recommended | Server | OpenRouter attribution header |
| `CRON_SECRET` | Yes | Server | Protect the cleanup endpoint |

## Supabase Setup

1. Create a Supabase project.
2. Enable email auth and magic links in `Authentication`.
3. Keep the project invite-only by inviting or pre-creating users from the Supabase dashboard or admin tooling.
4. Add your local and production app URLs to Supabase Auth redirect URLs, with the site URL matching your main deployment.
5. Run [supabase/schema.sql](/home/zakariya/Downloads/ai-docs-studio/AI-Doc-Studio-V01/supabase/schema.sql:1) in the SQL editor.
6. Confirm the `documents-temp` bucket exists and is private.

Important:

- The app sends magic links with `shouldCreateUser: false`, so unknown emails must not create accounts.
- This schema is a clean auth cutover and resets the old Clerk-linked `documents` table.

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

Recommended local values:

```bash
APP_BASE_URL="http://localhost:3000"
ALLOWED_ORIGINS="http://localhost:3000"
OPENROUTER_HTTP_REFERER="http://localhost:3000"
```

The Vite development server bridges the local API handlers so browser auth, uploads, and reconstruction stay same-origin during development.

## Vercel Deployment

1. Import the repository into Vercel with the `Vite` framework preset.
2. Add all environment variables to the Production environment.
3. Set `APP_BASE_URL` and `ALLOWED_ORIGINS` to your deployed origin.
4. Add the same deployed origin to Supabase Auth site URL and redirect URLs.
5. Redeploy after every environment-variable change.

`vercel.json` keeps the CSP aligned with Supabase and uses a daily cleanup cron so Hobby deployments stay valid.

## Verification

Run:

```bash
npm run check
npm run security:audit
```

Manual checks:

- Signed-out visitors can view the landing page.
- The landing login button opens the magic-link modal.
- Signed-out landing CTA opens login, then returns the user to upload after successful auth.
- Unknown / non-invited emails do not gain access.
- `POST /api/uploads/create` returns `401` without a valid Supabase bearer token.
- Authenticated users can upload, reconstruct, and reopen the editor.
- Different authenticated users cannot reconstruct each other’s documents.

## Operational Limits

- PDF size: `15 MB`
- PDF pages: `40`
- Extracted text: `200,000` characters
- Reconstruction limit: `20` jobs per authenticated user per day
- File retention: `24 hours`

## License

No license file is included yet. Add one before publishing publicly.
