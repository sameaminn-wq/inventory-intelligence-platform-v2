create index if not exists stores_created_by_idx
  on public.stores (created_by)
  where created_by is not null;
