# Store and team administration

## Server environment

Configure these variables in the Vercel Preview environment:

- \`NEXT_PUBLIC_SUPABASE_URL\`
- \`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\`
- \`SUPABASE_SERVICE_ROLE_KEY\` — server-only secret. Never prefix it with \`NEXT_PUBLIC_\`.
- \`NEXT_PUBLIC_SITE_URL\` — exact HTTPS origin of the Preview deployment, used to construct invitation callbacks.
- \`PLATFORM_ADMIN_USER_IDS\` — comma-separated Supabase Auth user UUIDs allowed to create stores and administer all stores.

The service-role key is used only by \`apps/web/lib/supabase/admin.ts\` and server route handlers. Do not expose it to browser code, logs, or client bundles.

## Capabilities

- \`/team\` lists stores available to the signed-in user.
- Platform administrators can create stores; the creator receives the initial owner membership.
- Store owners and admins can invite members by email.
- New users receive a Supabase Auth invitation. Existing Auth users are added directly to the selected store.
- Invited memberships remain \`invited\` until the Auth callback exchanges the invitation code; the callback then activates the signed-in user's invited memberships.
- Owners can promote members to admin. Admins cannot modify other admins or promote members to admin.
- Owners and admins can assign manager, employee, and viewer roles, and suspend/reactivate eligible memberships.
- Owner memberships cannot be changed from the team screen; self-modification is blocked.
- Membership changes are recorded in \`store_membership_audit\`.

## Bootstrap the first platform administrator

1. Create the initial administrator account through Supabase Auth Dashboard.
2. Copy its Auth user UUID.
3. Add that UUID to \`PLATFORM_ADMIN_USER_IDS\` in Vercel Preview and redeploy the Preview.
4. Sign in and open \`/team\`.
5. Create a store. The administrator is assigned as its owner.
6. Invite team members from the store page.

Do not set a user as a platform administrator based on email address or editable user metadata. The server-side UUID allowlist is the control for platform-wide access.

## Email invitation setup

Configure Supabase Auth SMTP and the allowed redirect URL for the exact Preview origin. The invite link redirects to \`/auth/callback?next=%2Fteam\`. The callback exchanges the one-time code and activates memberships in the invited state. Test with a separate email address before inviting real staff.

## Security and limitations

- The service-role key is server-only and bypasses RLS; every handler authenticates the caller and checks store-scoped owner/admin membership before using it.
- The audit table is not readable or writable by browser roles; server handlers write audit records.
- No user is deleted when a store membership is suspended or removed. This implementation currently offers suspension/reactivation, not permanent account deletion.
- There is no ownership transfer UI. The owner cannot be demoted or suspended through this interface.
- Invitation delivery depends on configured Supabase SMTP and redirect allowlists.
- Before production, add automated integration tests for invitation acceptance, existing-user addition, role boundaries, concurrent membership changes, and audit failure handling. Keep the analysis API disabled until the Vercel Preview security and quota checks are completed.
