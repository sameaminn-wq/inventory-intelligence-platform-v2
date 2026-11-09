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
- Tenant foundation is now in the development database: `stores`, `store_memberships`, and `user_profiles`, all with RLS enabled. `/api/stores` returns active memberships only, and `/api/analyze` checks active membership plus an analysis-allowed role before using Gemini.
- Store membership provisioning is administrator-only through Supabase Dashboard for now; there is no in-app invite or role-management screen yet.
- Daily analysis quotas are enforced atomically per user and store: 20 requests, 100 images, and 100 MiB of decoded image data per UTC database date. Counters are not readable or writable directly by browser users. The quota RPC is a narrowly scoped `SECURITY DEFINER` function; it checks `auth.uid()` and active membership/role internally. Supabase's security advisor flags callable `SECURITY DEFINER` functions for review; this warning is intentional for the quota transaction and must remain monitored.
- Keep the Vercel project on Preview deployments with Vercel Deployment Protection enabled while testing. Do not enable `ANALYSIS_API_ENABLED` on a publicly accessible deployment. Deployment Protection is an environment access gate, not application-level user/store authorization.
- Before public/production access, implement capture-session ownership, abuse monitoring, and an in-app audited membership administration workflow. The current quota is a basic per-user/store daily cap, not a full anti-abuse or billing system. The current tenant checks protect analysis by store membership, but they are not a complete production authorization system.
- Capture photos are stored locally in IndexedDB; analysis results and human review drafts are stored in browser session storage. None of this data is persisted to a server database yet.
- Saving a human review draft does not update inventory.
- AI output is untrusted and requires human review. Unknown or occluded quantities must remain unknown.

## Manual verification

1. Configure the Supabase Auth Site URL and allowed redirect URLs for the exact Vercel Preview domain.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel Preview.
3. Provision Auth users, stores, and memberships using [the store provisioning guide](../../docs/STORE_MEMBERSHIP_BOOTSTRAP.md).
4. Enable Vercel Preview Deployment Protection. Keep `ANALYSIS_API_ENABLED=false` until durable quotas and rate limits are implemented.
5. Deploy a Preview from `architecture/multi-provider-ai`.
6. Sign in with an administrator-provisioned Supabase Auth account and confirm an unauthenticated browser is redirected to `/login`.
7. Confirm sign-out clears the session and protected pages redirect back to `/login`.
8. Keep the analysis API disabled until durable quotas and rate limits are configured.
9. Confirm the provider key is not present in browser bundles or network responses.
