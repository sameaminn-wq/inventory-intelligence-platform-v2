create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'manager', 'employee', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create index if not exists store_memberships_user_status_idx
  on public.store_memberships (user_id, status);
create index if not exists store_memberships_store_status_idx
  on public.store_memberships (store_id, status);

alter table public.user_profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_memberships enable row level security;

drop policy if exists "users can read own profile" on public.user_profiles;
create policy "users can read own profile"
  on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "active members can read their stores" on public.stores;
create policy "active members can read their stores"
  on public.stores for select to authenticated
  using (
    status = 'active'
    and exists (
      select 1
      from public.store_memberships membership
      where membership.store_id = stores.id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

drop policy if exists "users can read own memberships" on public.store_memberships;
create policy "users can read own memberships"
  on public.store_memberships for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.user_profiles from anon, authenticated;
revoke all on public.stores from anon, authenticated;
revoke all on public.store_memberships from anon, authenticated;
grant select on public.user_profiles to authenticated;
grant select on public.stores to authenticated;
grant select on public.store_memberships to authenticated;
