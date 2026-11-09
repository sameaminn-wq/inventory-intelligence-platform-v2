# Store and employee provisioning (development)

The authentication and tenant foundation is connected to the development Supabase project. The app intentionally has no public sign-up screen. An administrator must create employee identities and assign store membership.

## 1. Create the employee identity

In Supabase Dashboard → Authentication → Users, create the user with the employee's email and a temporary password. Use the supported invitation flow if enabled for the project. The employee must complete any configured email confirmation before signing in.

Copy the new user's UUID from the Auth user record.

## 2. Create the first store and assign its owner

Open Supabase Dashboard → SQL Editor. Replace the two UUID placeholders and store details, then execute:

```sql
with new_store as (
  insert into public.stores (name, slug, created_by)
  values (
    'Example Store',
    'example-store',
    '00000000-0000-0000-0000-000000000001'::uuid
  )
  returning id
)
insert into public.store_memberships (store_id, user_id, role, status)
select
  new_store.id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'owner',
  'active'
from new_store;
```

Replace the UUID in both places with the same Auth user UUID. Use a unique lowercase slug with hyphens.

## 3. Add employees

After creating each employee in Auth, assign them to a store with an administrator-controlled SQL statement:

```sql
insert into public.store_memberships (store_id, user_id, role, status)
values (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'employee',
  'active'
);
```

Replace both UUIDs with the store ID and employee Auth user ID. Allowed roles are `owner`, `admin`, `manager`, `employee`, and `viewer`. The current analysis endpoint permits `owner`, `admin`, `manager`, and `employee`; `viewer` is read-only.

## 4. Verify

- Sign in as the provisioned employee.
- `GET /api/stores` should return only active stores where the signed-in user has an active membership.
- The analysis page requires an explicit store selection.
- `POST /api/analyze` checks the authenticated user's active membership and role before sending images to Gemini.
- A user with no membership must receive an empty store list and a 403 from analysis for any store ID.

## Security boundary

RLS is enabled on `user_profiles`, `stores`, and `store_memberships`. Authenticated users can read only their own profile and memberships, and stores only when they are active members. No client-side insert, update, or delete grants are provided for these tables. Provisioning is intentionally an administrator operation.

The current schema does not yet provide an in-app invitation/role-management screen, per-store quotas, durable rate limiting, or an audit log. Keep `ANALYSIS_API_ENABLED=false` until the Vercel Preview access controls and spend limits are configured. Do not use this development setup as a production launch checklist.
