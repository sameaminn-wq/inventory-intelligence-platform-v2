create table if not exists public.store_membership_audit (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('invited', 'membership_added', 'role_changed', 'suspended', 'reactivated')),
  previous_role text,
  new_role text,
  previous_status text,
  new_status text,
  created_at timestamptz not null default now()
);

create index if not exists store_membership_audit_store_created_idx
  on public.store_membership_audit (store_id, created_at desc);

alter table public.store_membership_audit enable row level security;
revoke all on public.store_membership_audit from anon, authenticated;
