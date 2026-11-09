create index if not exists analysis_usage_daily_store_id_idx
  on public.analysis_usage_daily (store_id);

drop policy if exists "no direct access to analysis usage counters" on public.analysis_usage_daily;
create policy "no direct access to analysis usage counters"
  on public.analysis_usage_daily for all to authenticated
  using (false)
  with check (false);
