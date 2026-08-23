-- Persistent, audited product-level access. Product grants narrow package access;
-- they never replace feature entitlements or role permissions.

create or replace function public.get_club_product_entitlements(target_club_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  products jsonb;
begin
  -- Reuse the established subscription reader as the workspace-access guard.
  perform public.get_club_subscription(target_club_id);

  select subscription.metadata -> 'product_entitlements'
  into products
  from public.club_subscriptions subscription
  where subscription.club_id = target_club_id;

  if products is null then
    return null;
  end if;
  if jsonb_typeof(products) <> 'array' then
    raise exception 'Stored product entitlements are invalid' using errcode = '22023';
  end if;

  return coalesce(array(
    select jsonb_array_elements_text(products)
  ), '{}'::text[]);
end;
$$;

revoke all on function public.get_club_product_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.get_club_product_entitlements(uuid) to authenticated;

create or replace function public.platform_set_club_product_entitlements(
  target_club_id uuid,
  next_product_entitlements text[] default '{}'::text[],
  change_reason text default 'Manual product access update'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  known_products constant text[] := array['ground_control', 'coach_hub']::text[];
  safe_products text[];
  previous_products jsonb;
  updated_subscription public.club_subscriptions%rowtype;
begin
  perform private.require_platform_staff('admin');

  if length(trim(coalesce(change_reason, ''))) < 5 then
    raise exception 'A product-access reason is required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.clubs where id = target_club_id) then
    raise exception 'Club workspace not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct lower(trim(product))) filter (where lower(trim(product)) = any(known_products)), '{}'::text[])
  into safe_products
  from unnest(coalesce(next_product_entitlements, '{}'::text[])) product;

  if exists (
    select 1 from unnest(coalesce(next_product_entitlements, '{}'::text[])) product
    where lower(trim(product)) <> all(known_products)
  ) then
    raise exception 'Unsupported product entitlement' using errcode = '22023';
  end if;

  select metadata -> 'product_entitlements'
  into previous_products
  from public.club_subscriptions
  where club_id = target_club_id;

  update public.club_subscriptions
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'product_entitlements', to_jsonb(safe_products),
        'product_entitlements_updated_at', now(),
        'product_entitlements_updated_by', actor_id,
        'product_entitlements_reason', trim(change_reason)
      ),
      updated_by = actor_id,
      updated_at = now()
  where club_id = target_club_id
  returning * into updated_subscription;

  if updated_subscription.club_id is null then
    raise exception 'Club subscription not found' using errcode = 'P0002';
  end if;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'subscription.product_access.update',
    'club_subscription',
    target_club_id::text,
    jsonb_build_object(
      'previous_products', previous_products,
      'next_products', to_jsonb(safe_products),
      'reason', trim(change_reason)
    ),
    'platform_admin'
  );

  perform private.write_platform_activity(
    'subscription.product_access.update',
    target_club_id,
    'club_subscription',
    target_club_id::text,
    jsonb_build_object('products', to_jsonb(safe_products), 'reason', trim(change_reason))
  );

  return public.get_club_subscription(target_club_id);
end;
$$;

revoke all on function public.platform_set_club_product_entitlements(uuid, text[], text) from public, anon, authenticated;
grant execute on function public.platform_set_club_product_entitlements(uuid, text[], text) to authenticated;

comment on function public.platform_set_club_product_entitlements(uuid, text[], text) is
  'Platform-admin-only audited product access control. Explicit products narrow package and role access.';

comment on function public.get_club_product_entitlements(uuid) is
  'Returns explicit product access after applying the existing club subscription access guard; null preserves inferred legacy access.';
