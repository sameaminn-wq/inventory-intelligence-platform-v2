# Inventory Intelligence Web App

The Next.js application in `apps/web` provides authentication, store onboarding, shelf capture, AI analysis, human review, inventory operations, and reports.

## First-time user journey

1. Open `/signup` and create an account with an email address and password (minimum 10 characters).
2. If Supabase email confirmation is enabled, confirm the email using the message sent to your inbox, then sign in at `/login`.
3. After sign-in, the app checks active store memberships. A new account with no store is redirected to `/stores/`.
4. Create the first store. The authenticated account becomes its owner through the database RPC `create_store_for_current_user`.
5. The app redirects to `/`, the dashboard. Existing users with an active store go directly to the dashboard after sign-in.
6. From the dashboard, add products, capture shelf images, analyze them, review AI suggestions, then use inventory and reports.

Self-registration creates an identity only; it does not grant access to an existing store. Store access remains controlled by active `store_memberships` and RLS. Employee invitations and in-app role management are not included in this beta flow; an administrator must provision those memberships.

## Routes

- `/signup` — public email/password account creation.
- `/login` — email/password sign-in.
- `/` — authenticated dashboard; redirects users without a store to `/stores/`.
- `/stores` — view authorized stores and create a store owned by the current user.
- `/capture` — capture shelf images on a phone.
- `/analysis` — submit a capture session to the server-side AI endpoint.
- `/review` — review persisted analysis sessions.
- `/inventory` and `/reports` — stock operations and reporting.

## Environment

Configure these in the relevant Vercel environment (Preview first):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key; never expose a secret/service-role key in the browser.
- `ANALYSIS_API_ENABLED` — keep `false` until the intended Preview access and AI spend controls are verified.
- `GEMINI_API_KEY` — server-only Gemini API key.
- `GEMINI_MODEL` — exact supported Gemini model ID.

Set the Supabase Auth Site URL and allowed redirect URLs to the exact app Preview URL. If email confirmation is enabled, the user must confirm their address before a session is established. Never commit real environment values.

## Security and beta limits

- Supabase Auth sessions are refreshed by the Next.js middleware and verified in server routes.
- Every store API must verify the authenticated user and active membership. RLS remains the database boundary; signup metadata must never be used for authorization.
- The first-store flow uses the existing `create_store_for_current_user` RPC. It must create the store and owner membership atomically; no client-supplied user ID is trusted.
- Analysis is disabled unless `ANALYSIS_API_ENABLED=true`; it also requires a store membership, configured Gemini credentials, and the database quota RPC.
- AI quantities are suggestions only. Human review must not silently update stock. A separate, authorized inventory operation is required.
- Capture images remain in local IndexedDB until analysis. Server-side analysis images are stored in the private `shelf-captures` bucket.
- Keep deployment access restricted while testing. Do not enable public production access until onboarding, tenant isolation, abuse controls, and the complete user journey are verified.

## Manual smoke test

1. Create a fresh test account at `/signup`.
2. Complete email confirmation if enabled.
3. Sign in at `/login`; verify the account without a store lands on `/stores/`.
4. Create a store and verify the account receives the owner role.
5. Verify the app redirects to the dashboard and shows only data for stores where the user has an active membership.
6. Sign out and verify protected pages redirect to `/login`.
7. Verify a user without membership cannot read or analyze another store.
