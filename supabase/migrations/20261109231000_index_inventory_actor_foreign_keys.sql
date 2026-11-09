create index if not exists products_created_by_idx
  on public.products (created_by);
create index if not exists stock_movements_actor_user_idx
  on public.stock_movements (actor_user_id);
