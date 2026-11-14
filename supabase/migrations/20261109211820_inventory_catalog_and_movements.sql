create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  sku text,
  unit text not null default 'piece' check (char_length(btrim(unit)) between 1 and 32),
  quantity_on_hand numeric(14,3) not null default 0 check (quantity_on_hand >= 0),
  minimum_quantity numeric(14,3) not null default 0 check (minimum_quantity >= 0),
  unit_cost numeric(14,2) check (unit_cost is null or unit_cost >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sku is null or char_length(btrim(sku)) between 1 and 80)
);

create unique index if not exists products_store_sku_unique_idx
  on public.products (store_id, lower(sku))
  where sku is not null;
create index if not exists products_store_name_idx
  on public.products (store_id, name);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null check (movement_type in ('inbound', 'outbound', 'adjustment')),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  quantity_after numeric(14,3) not null check (quantity_after >= 0),
  notes text,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (notes is null or char_length(notes) <= 500)
);
create index if not exists stock_movements_store_created_idx
  on public.stock_movements (store_id, created_at desc);
create index if not exists stock_movements_product_created_idx
  on public.stock_movements (product_id, created_at desc);

alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

revoke all on public.products from anon, authenticated;
revoke all on public.stock_movements from anon, authenticated;
grant select on public.products to authenticated;
grant select on public.stock_movements to authenticated;

drop policy if exists "active store members can read products" on public.products;
create policy "active store members can read products"
  on public.products for select to authenticated
  using (exists (
    select 1 from public.store_memberships m
    where m.store_id = products.store_id and m.user_id = (select auth.uid())
      and m.status = 'active'
  ));

drop policy if exists "active store members can read stock movements" on public.stock_movements;
create policy "active store members can read stock movements"
  on public.stock_movements for select to authenticated
  using (exists (
    select 1 from public.store_memberships m
    where m.store_id = stock_movements.store_id and m.user_id = (select auth.uid())
      and m.status = 'active'
  ));

create or replace function public.create_store_product(
  p_store_id uuid,
  p_name text,
  p_sku text default null,
  p_unit text default 'piece',
  p_minimum_quantity numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_product_id uuid;
  v_name text;
  v_sku text;
  v_unit text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_store_id is null then
    raise exception 'Store is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.store_memberships m
    where m.store_id = p_store_id and m.user_id = v_user_id
      and m.status = 'active' and m.role in ('owner','admin','manager')
  ) then
    raise exception 'Insufficient store permissions' using errcode = '42501';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  v_sku := nullif(btrim(coalesce(p_sku, '')), '');
  v_unit := btrim(coalesce(p_unit, 'piece'));
  if char_length(v_name) < 1 or char_length(v_name) > 200 then
    raise exception 'Product name must contain 1-200 characters' using errcode = '22023';
  end if;
  if v_sku is not null and char_length(v_sku) > 80 then
    raise exception 'SKU must contain at most 80 characters' using errcode = '22023';
  end if;
  if char_length(v_unit) < 1 or char_length(v_unit) > 32 then
    raise exception 'Unit must contain 1-32 characters' using errcode = '22023';
  end if;
  if p_minimum_quantity is null or p_minimum_quantity < 0 or p_minimum_quantity > 99999999999 then
    raise exception 'Minimum quantity is invalid' using errcode = '22023';
  end if;

  insert into public.products(store_id,name,sku,unit,minimum_quantity,created_by)
  values(p_store_id,v_name,v_sku,v_unit,p_minimum_quantity,v_user_id)
  returning id into v_product_id;
  return v_product_id;
end;
$function$;

revoke all on function public.create_store_product(uuid,text,text,text,numeric)
  from public, anon, authenticated;
grant execute on function public.create_store_product(uuid,text,text,text,numeric)
  to authenticated;

create or replace function public.adjust_inventory_stock(
  p_store_id uuid,
  p_product_id uuid,
  p_quantity_delta numeric,
  p_movement_type text,
  p_notes text default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_role text;
  v_current numeric(14,3);
  v_next numeric(14,3);
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_store_id is null or p_product_id is null or p_quantity_delta is null
     or p_quantity_delta = 0 or abs(p_quantity_delta) > 99999999999
     or p_movement_type not in ('inbound','outbound','adjustment')
     or (p_notes is not null and char_length(p_notes) > 500) then
    raise exception 'Invalid stock movement' using errcode = '22023';
  end if;

  select m.role into v_role
  from public.store_memberships m
  where m.store_id = p_store_id and m.user_id = v_user_id and m.status = 'active';
  if v_role is null or v_role not in ('owner','admin','manager','employee') then
    raise exception 'Insufficient store permissions' using errcode = '42501';
  end if;

  select p.quantity_on_hand into v_current
  from public.products p
  where p.id = p_product_id and p.store_id = p_store_id
  for update;
  if not found then
    raise exception 'Product not found in this store' using errcode = 'P0002';
  end if;

  if (p_movement_type = 'inbound' and p_quantity_delta <= 0)
     or (p_movement_type = 'outbound' and p_quantity_delta >= 0) then
    raise exception 'Movement sign does not match movement type' using errcode = '22023';
  end if;

  v_next := v_current + p_quantity_delta;
  if v_next < 0 then
    raise exception 'Insufficient stock for this movement' using errcode = '22023';
  end if;

  update public.products set quantity_on_hand = v_next, updated_at = now()
  where id = p_product_id and store_id = p_store_id;

  insert into public.stock_movements(
    store_id,product_id,movement_type,quantity_delta,quantity_after,notes,actor_user_id
  ) values (
    p_store_id,p_product_id,p_movement_type,p_quantity_delta,v_next,nullif(btrim(p_notes),''),v_user_id
  );
  return v_next;
end;
$function$;

revoke all on function public.adjust_inventory_stock(uuid,uuid,numeric,text,text)
  from public, anon, authenticated;
grant execute on function public.adjust_inventory_stock(uuid,uuid,numeric,text,text)
  to authenticated;
