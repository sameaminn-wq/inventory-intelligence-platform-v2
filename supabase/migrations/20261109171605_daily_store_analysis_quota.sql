create table if not exists public.analysis_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  image_count integer not null default 0 check (image_count >= 0),
  bytes_total bigint not null default 0 check (bytes_total >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, store_id, usage_date)
);

alter table public.analysis_usage_daily enable row level security;
revoke all on public.analysis_usage_daily from anon, authenticated;

create or replace function public.consume_analysis_quota(
  p_store_id uuid,
  p_image_count integer,
  p_payload_bytes bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_allowed boolean := false;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return false;
  end if;
  if p_store_id is null or p_image_count is null or p_image_count < 1 or p_image_count > 8
     or p_payload_bytes is null or p_payload_bytes < 1 or p_payload_bytes > 4194304 then
    return false;
  end if;
  if not exists (
    select 1 from public.store_memberships membership
    where membership.store_id = p_store_id
      and membership.user_id = v_user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager', 'employee')
  ) then
    return false;
  end if;
  insert into public.analysis_usage_daily (
    user_id, store_id, usage_date, request_count, image_count, bytes_total, updated_at
  )
  values (v_user_id, p_store_id, current_date, 1, p_image_count, p_payload_bytes, now())
  on conflict (user_id, store_id, usage_date)
  do update set
    request_count = public.analysis_usage_daily.request_count + 1,
    image_count = public.analysis_usage_daily.image_count + excluded.image_count,
    bytes_total = public.analysis_usage_daily.bytes_total + excluded.bytes_total,
    updated_at = now()
  where public.analysis_usage_daily.request_count < 20
    and public.analysis_usage_daily.image_count + excluded.image_count <= 100
    and public.analysis_usage_daily.bytes_total + excluded.bytes_total <= 104857600
  returning true into v_allowed;
  return coalesce(v_allowed, false);
end;
$function$;

revoke all on function public.consume_analysis_quota(uuid, integer, bigint) from public, anon;
grant execute on function public.consume_analysis_quota(uuid, integer, bigint) to authenticated;
