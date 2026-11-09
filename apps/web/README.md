# Vercel Web App and Shelf Analysis API

The Next.js app under `apps/web` contains the browser UI and the server-side shelf analysis endpoint:

- `POST /api/analyze` — Vercel Node.js Function; Gemini credentials remain server-side.
- `/capture` — captures shelf images on the employee's ordinary phone.
- `/analysis` — compresses the local capture session, calls the server endpoint, and presents AI suggestions for human review.

## Vercel project setup

Create or configure the Vercel project with:

- Root Directory: `apps/web`
- Framework: Next.js
- Install Command: `npm install` (monorepo workspace install from the repository root may require the project setting to include the repository root; verify the build output before enabling production).

Set these server-only environment variables in Vercel Preview:

- `ANALYSIS_API_ENABLED=false` initially; change to `true` only for a protected Preview after reviewing access and spend controls.
- `GEMINI_API_KEY` — secret API key; never prefix with `NEXT_PUBLIC_`.
- `GEMINI_MODEL` — the exact Gemini model ID selected for this project.

Do not commit real values. The browser only calls the same-origin `/api/analyze` route; it never receives the provider key.

## Request limits

Vercel Functions have a 4.5 MB request body limit. The browser resizes and JPEG-compresses images before upload and caps the estimated binary image payload at 2.8 MiB to leave room for base64 and JSON overhead. The API independently validates the content length, image count, MIME signatures, canonical base64, and decoded aggregate image size.

The separate AI service's 20 MiB validation limit does not override the Vercel Function request limit.

## Important readiness and security limits

This integration is a development/preview slice, not production-ready:

- There is not yet application user authentication, store membership authorization, capture-session ownership enforcement, or durable per-user rate limiting.
- Keep the Vercel project on Preview deployments with Vercel Deployment Protection enabled while testing. Do not enable `ANALYSIS_API_ENABLED` on a publicly accessible deployment. Deployment Protection is an environment access gate, not application-level user/store authorization.
- Before public/production access, implement authenticated user sessions, store membership checks, durable rate limits/quotas, and abuse monitoring. The API route protects the provider key but is not by itself an authorization boundary.
- Capture photos are stored locally in IndexedDB; analysis results and human review drafts are stored in browser session storage. None of this data is persisted to a server database yet.
- Saving a human review draft does not update inventory.
- AI output is untrusted and requires human review. Unknown or occluded quantities must remain unknown.

## Manual verification

1. Enable Vercel Preview Deployment Protection and configure `ANALYSIS_API_ENABLED=true`, `GEMINI_API_KEY`, and `GEMINI_MODEL` in Preview only.
2. Deploy a Preview from `architecture/multi-provider-ai`.
3. Capture a small shelf session on a phone.
4. Open `/analysis`, run analysis, and verify that the result is editable as a human review draft.
5. Confirm the provider key is not present in browser bundles or network responses.
6. Confirm no inventory records are modified.
