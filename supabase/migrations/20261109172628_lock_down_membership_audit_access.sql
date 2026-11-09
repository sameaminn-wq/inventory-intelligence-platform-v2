create index if not exists store_membership_audit_actor_user_idx
  on public.store_membership_audit (actor_user_id);
create index if not exists store_membership_audit_target_user_idx
  on public.store_membership_audit (target_user_id);

drop policy if exists "no direct browser access to membership audit" on public.store_membership_audit;
create policy "no direct browser access to membership audit"
  on public.store_membership_audit for all to anon, authenticated
  using (false)
  with check (false);
