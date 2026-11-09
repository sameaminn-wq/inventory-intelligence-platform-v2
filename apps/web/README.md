# Vercel Web App and Shelf Analysis API

The Next.js app under `apps/web` contains the browser UI and the server-side shelf analysis endpoint:

- `POST /api/analyze` — Vercel Node.js Function; requires a verified Supabase Auth session; Gemini credentials remain server-side.
- `/login` — administrator-provisioned email/password sign-in; public self-registration is intentionally disabled.
- `/capture` — captures shelf images on the employee's ordinary phone.
- `/analysis` — compresses the local capture session, calls the server endpoint, and presents AI suggestions for human review.

## Vercel project setup

Create or configure the Vercel project with:

- Root Directory: `apps/web`
- Framework: Next.js
- Install Command: `npm install` (monorepo workspace install from the repository root may require the project setting to include the repository root; verify the build output before enabling production).

Set these environment variables in Vercel Preview:

- `NEXT_PUBLIC_SUPABASE_URL` — URL of the development Supabase project.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key (safe for browser use; never use a secret/service-role key here).
- `ANALYSIS_API_ENABLED=false` initially; keep disabled until store membership authorization and durable quotas are implemented.
- `GEMINI_API_KEY` — secret API key; never prefix with `NEXT_PUBLIC_`.
- `GEMINI_MODEL` — the exact Gemini model ID selected for this project.

Do not commit real values. The browser only calls the same-origin `/api/analyze` route; it never receives the provider key.

## Request limits

Vercel Functions have a 4.5 MB request body limit. The browser resizes and JPEG-compresses images before upload and caps the estimated binary image payload at 2.8 MiB to leave room for base64 and JSON overhead. The API independently validates the content length, image count, MIME signatures, canonical base64, and decoded aggregate image size.

The separate AI service's 20 MiB validation limit does not override the Vercel Function request limit.

## Important readiness and security limits

This integration is a development/preview slice, not production-ready:

- Supabase email/password authentication is integrated using `@supabase/ssr`; the Next.js 15 middleware refreshes cookie sessions, protects application pages, and the analysis API independently verifies the session.
- User self-registration is disabled in the UI. Create employee accounts administratively in Supabase Auth.
- Store membership authorization, capture-session ownership enforcement, and durable per-user/store rate limits are not implemented yet. A valid login alone must not be treated as permission to access a store.
- Keep the Vercel project on Preview deployments with Vercel Deployment Protection enabled while testing. Do not enable `ANALYSIS_API_ENABLED` on a publicly accessible deployment. Deployment Protection is an environment access gate, not application-level user/store authorization.
- Before public/production access, implement store membership checks, role-based permissions, capture-session ownership, durable rate limits/quotas, and abuse monitoring. The current login gate is identity verification, not tenant authorization.
- Capture photos are stored locally in IndexedDB; analysis results and human review drafts are stored in browser session storage. None of this data is persisted to a server database yet.
- Saving a human review draft does not update inventory.
- AI output is untrusted and requires human review. Unknown or occluded quantities must remain unknown.

## Manual verification

1. Configure the Supabase Auth Site URL and allowed redirect URLs for the exact Vercel Preview domain.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel Preview.
3. Enable Vercel Preview Deployment Protection. Keep `ANALYSIS_API_ENABLED=false` until tenant membership and quotas are implemented.
4. Deploy a Preview from `architecture/multi-provider-ai`.
5. Sign in with an administrator-provisioned Supabase Auth account and confirm an unauthenticated browser is redirected to `/login`.
6. Confirm sign-out clears the session and protected pages redirect back to `/login`.
7. Keep the analysis API disabled; do not enable it before store authorization is ready.
8. Confirm the provider key is not present in browser bundles or network responses.
