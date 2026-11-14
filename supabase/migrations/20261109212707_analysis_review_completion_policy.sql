grant update (status, reviewed_at) on public.analysis_sessions to authenticated;

drop policy if exists "active members can mark sessions reviewed" on public.analysis_sessions;
create policy "active members can mark sessions reviewed"
  on public.analysis_sessions for update to authenticated
  using (exists (
    select 1 from public.store_memberships m
    where m.store_id = analysis_sessions.store_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner','admin','manager','employee')
  ))
  with check (
    status = 'reviewed' and reviewed_at is not null
    and exists (
      select 1 from public.store_memberships m
      where m.store_id = analysis_sessions.store_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner','admin','manager','employee')
    )
  );
