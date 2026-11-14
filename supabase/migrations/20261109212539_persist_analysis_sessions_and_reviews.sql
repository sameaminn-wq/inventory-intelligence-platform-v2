create table if not exists public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  capture_session_id text not null check (char_length(btrim(capture_session_id)) between 1 and 128),
  provider text not null check (char_length(provider) between 1 and 80),
  model text not null check (char_length(model) between 1 and 160),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'reviewed')),
  review_required boolean not null default true,
  result_json jsonb not null check (jsonb_typeof(result_json) = 'object'),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists analysis_sessions_store_created_idx
  on public.analysis_sessions (store_id, created_at desc);
create index if not exists analysis_sessions_creator_created_idx
  on public.analysis_sessions (created_by, created_at desc);

create table if not exists public.analysis_reviews (
  id uuid primary key default gen_random_uuid(),
  analysis_session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  review_json jsonb not null check (jsonb_typeof(review_json) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists analysis_reviews_session_created_idx
  on public.analysis_reviews (analysis_session_id, created_at desc);
create index if not exists analysis_reviews_reviewer_created_idx
  on public.analysis_reviews (reviewer_id, created_at desc);

alter table public.analysis_sessions enable row level security;
alter table public.analysis_reviews enable row level security;

revoke all on public.analysis_sessions from anon, authenticated;
revoke all on public.analysis_reviews from anon, authenticated;
grant select, insert on public.analysis_sessions to authenticated;
grant select, insert on public.analysis_reviews to authenticated;

drop policy if exists "active store members can read analysis sessions" on public.analysis_sessions;
create policy "active store members can read analysis sessions"
  on public.analysis_sessions for select to authenticated
  using (exists (
    select 1 from public.store_memberships m
    where m.store_id = analysis_sessions.store_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
  ));

drop policy if exists "active members can create own analysis sessions" on public.analysis_sessions;
create policy "active members can create own analysis sessions"
  on public.analysis_sessions for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.store_memberships m
      where m.store_id = analysis_sessions.store_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner','admin','manager','employee')
    )
  );

drop policy if exists "active store members can read analysis reviews" on public.analysis_reviews;
create policy "active store members can read analysis reviews"
  on public.analysis_reviews for select to authenticated
  using (exists (
    select 1 from public.analysis_sessions s
    join public.store_memberships m on m.store_id = s.store_id
    where s.id = analysis_reviews.analysis_session_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
  ));

drop policy if exists "active members can save own analysis reviews" on public.analysis_reviews;
create policy "active members can save own analysis reviews"
  on public.analysis_reviews for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and exists (
      select 1 from public.analysis_sessions s
      join public.store_memberships m on m.store_id = s.store_id
      where s.id = analysis_reviews.analysis_session_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner','admin','manager','employee')
    )
  );
