-- Daxora Ground Control: billing integration and legal readiness architecture.
-- Requires migrations through 202607030005_admin_support_tooling.sql.
--
-- This migration keeps all Stripe secrets outside Postgres and the browser.
-- Checkout, portal and webhook traffic is handled by Supabase Edge Functions.
-- Legal documents are deliberately seeded as drafts so self-service billing
-- remains fail-closed until Daxora has completed professional legal review.

begin;

alter table public.club_subscriptions
  add column if not exists payment_provider text not null default 'manual',
  add column if not exists external_price_id text,
  add column if not exists billing_email text,
  add column if not exists billing_name text,
  add column if not exists billing_address jsonb not null default '{}'::jsonb,
  add column if not exists last_invoice_status text,
  add column if not exists last_payment_at timestamptz,
  add column if not exists payment_failure_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.club_subscriptions'::regclass
      and conname = 'club_subscriptions_payment_provider_check'
  ) then
    alter table public.club_subscriptions
      add constraint club_subscriptions_payment_provider_check
      check (payment_provider in ('manual', 'stripe'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.club_subscriptions'::regclass
      and conname = 'club_subscriptions_billing_address_object_check'
  ) then
    alter table public.club_subscriptions
      add constraint club_subscriptions_billing_address_object_check
      check (jsonb_typeof(billing_address) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.club_subscriptions'::regclass
      and conname = 'club_subscriptions_payment_failure_count_check'
  ) then
    alter table public.club_subscriptions
      add constraint club_subscriptions_payment_failure_count_check
      check (payment_failure_count >= 0);
  end if;
end;
$$;

create index if not exists club_subscriptions_external_price_idx
  on public.club_subscriptions(external_price_id)
  where external_price_id is not null;

create table if not exists public.platform_legal_settings (
  singleton boolean primary key default true check (singleton),
  legal_name text not null default '',
  trading_name text not null default 'Daxora',
  service_address text not null default '',
  website_url text not null default '',
  support_email text not null default '',
  privacy_email text not null default '',
  governing_law text not null default 'England and Wales',
  stripe_mode text not null default 'disabled'
    check (stripe_mode in ('disabled', 'test', 'live')),
  default_currency text not null default 'gbp'
    check (default_currency ~ '^[a-z]{3}$'),
  tax_status text not null default 'not_configured'
    check (tax_status in ('not_configured', 'not_vat_registered', 'vat_registered')),
  vat_number text,
  invoice_prefix text not null default 'DAX',
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object'),
  check (vat_number is null or length(trim(vat_number)) between 4 and 32)
);

insert into public.platform_legal_settings (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.legal_documents (
  code text not null,
  version text not null,
  title text not null,
  category text not null
    check (category in ('commercial', 'privacy', 'security', 'operational')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'retired')),
  required_for_checkout boolean not null default false,
  document_url text not null default '',
  content_hash text not null default '',
  effective_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (code, version),
  check (code ~ '^[a-z0-9_]{3,64}$'),
  check (length(trim(version)) between 1 and 32),
  check (length(trim(title)) between 3 and 160),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists legal_documents_one_published_version
  on public.legal_documents(code)
  where status = 'published';

insert into public.legal_documents (
  code, version, title, category, status, required_for_checkout, document_url, metadata
) values
  ('service_terms', '1.0-draft', 'Business Service Terms', 'commercial', 'draft', true, '', '{"review_required":true}'::jsonb),
  ('data_processing_addendum', '1.0-draft', 'Data Processing Addendum', 'privacy', 'draft', true, '', '{"review_required":true}'::jsonb),
  ('acceptable_use', '1.0-draft', 'Acceptable Use Policy', 'operational', 'draft', true, '', '{"review_required":true}'::jsonb),
  ('privacy_notice', '1.0-draft', 'Privacy Notice', 'privacy', 'draft', false, '', '{"acknowledgement_not_consent":true,"review_required":true}'::jsonb),
  ('cookie_notice', '1.0-draft', 'Cookie and Storage Notice', 'privacy', 'draft', false, '', '{"review_required":true}'::jsonb),
  ('security_overview', '1.0-draft', 'Security Overview', 'security', 'draft', false, '', '{"review_required":true}'::jsonb),
  ('subprocessor_list', '1.0-draft', 'Subprocessor List', 'privacy', 'draft', false, '', '{"review_required":true}'::jsonb)
on conflict (code, version) do nothing;

create table if not exists public.club_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  document_code text not null,
  document_version text not null,
  accepted_by uuid not null references auth.users(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  authority_confirmed boolean not null default true,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  unique (club_id, document_code, document_version),
  foreign key (document_code, document_version)
    references public.legal_documents(code, version) on delete restrict,
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists club_legal_acceptances_club_idx
  on public.club_legal_acceptances(club_id, accepted_at desc);

create table if not exists public.billing_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe' check (provider in ('stripe')),
  external_event_id text not null unique,
  event_type text not null,
  club_id uuid references public.clubs(id) on delete set null,
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'processed', 'ignored', 'failed')),
  payload_hash text,
  failure_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists billing_provider_events_received_idx
  on public.billing_provider_events(received_at desc);
create index if not exists billing_provider_events_club_idx
  on public.billing_provider_events(club_id, received_at desc)
  where club_id is not null;

create table if not exists public.billing_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  plan_code text not null references public.subscription_plans(code),
  billing_interval text not null check (billing_interval in ('monthly', 'annual')),
  provider text not null default 'stripe' check (provider in ('stripe')),
  external_session_id text,
  status text not null default 'created'
    check (status in ('created', 'completed', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists billing_checkout_attempts_club_idx
  on public.billing_checkout_attempts(club_id, created_at desc);
create unique index if not exists billing_checkout_attempts_session_key
  on public.billing_checkout_attempts(external_session_id)
  where external_session_id is not null;

drop trigger if exists platform_legal_settings_touch_updated_at on public.platform_legal_settings;
create trigger platform_legal_settings_touch_updated_at
before update on public.platform_legal_settings
for each row execute function public.touch_updated_at();

drop trigger if exists legal_documents_touch_updated_at on public.legal_documents;
create trigger legal_documents_touch_updated_at
before update on public.legal_documents
for each row execute function public.touch_updated_at();

alter table public.platform_legal_settings enable row level security;
alter table public.platform_legal_settings force row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_documents force row level security;
alter table public.club_legal_acceptances enable row level security;
alter table public.club_legal_acceptances force row level security;
alter table public.billing_provider_events enable row level security;
alter table public.billing_provider_events force row level security;
alter table public.billing_checkout_attempts enable row level security;
alter table public.billing_checkout_attempts force row level security;

revoke all on table public.platform_legal_settings from public, anon, authenticated;
revoke all on table public.legal_documents from public, anon, authenticated;
revoke all on table public.club_legal_acceptances from public, anon, authenticated;
revoke all on table public.billing_provider_events from public, anon, authenticated;
revoke all on table public.billing_checkout_attempts from public, anon, authenticated;

drop policy if exists legal_documents_published_read on public.legal_documents;
create policy legal_documents_published_read
on public.legal_documents
for select
to authenticated
using (status = 'published');

drop policy if exists club_legal_acceptances_read on public.club_legal_acceptances;
create policy club_legal_acceptances_read
on public.club_legal_acceptances
for select
to authenticated
using (public.has_club_role(club_id, array['owner', 'admin']));

drop policy if exists billing_checkout_attempts_read on public.billing_checkout_attempts;
create policy billing_checkout_attempts_read
on public.billing_checkout_attempts
for select
to authenticated
using (public.has_club_role(club_id, array['owner']));

grant select on public.legal_documents to authenticated;
grant select on public.club_legal_acceptances to authenticated;
grant select on public.billing_checkout_attempts to authenticated;

create or replace function private.billing_legal_configuration_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    length(trim(settings.legal_name)) > 1
    and length(trim(settings.trading_name)) > 1
    and length(trim(settings.service_address)) > 5
    and position('@' in settings.support_email) > 1
    and position('@' in settings.privacy_email) > 1
    and settings.stripe_mode in ('test', 'live')
    and (
      select count(*)
      from public.legal_documents document
      where document.status = 'published'
        and document.required_for_checkout
        and document.document_url ~* '^https://'
    ) >= 3
  from public.platform_legal_settings settings
  where settings.singleton = true;
$$;

create or replace function private.club_has_current_legal_acceptance(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select not exists (
    select 1
    from public.legal_documents document
    where document.status = 'published'
      and document.required_for_checkout
      and not exists (
        select 1
        from public.club_legal_acceptances acceptance
        where acceptance.club_id = target_club_id
          and acceptance.document_code = document.code
          and acceptance.document_version = document.version
      )
  );
$$;

create or replace function public.get_billing_legal_status(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  settings public.platform_legal_settings%rowtype;
  subscription public.club_subscriptions%rowtype;
  documents jsonb;
  configuration_ready boolean;
  acceptance_ready boolean;
begin
  if actor_id is null or not public.has_club_role(target_club_id, array['owner']) then
    raise exception 'Club owner access required' using errcode = '42501';
  end if;

  select * into settings
  from public.platform_legal_settings
  where singleton = true;

  select * into subscription
  from public.club_subscriptions
  where club_id = target_club_id;

  configuration_ready := private.billing_legal_configuration_ready();
  acceptance_ready := private.club_has_current_legal_acceptance(target_club_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'code', document.code,
      'version', document.version,
      'title', document.title,
      'category', document.category,
      'status', document.status,
      'required_for_checkout', document.required_for_checkout,
      'document_url', document.document_url,
      'effective_at', document.effective_at,
      'accepted', exists (
        select 1
        from public.club_legal_acceptances acceptance
        where acceptance.club_id = target_club_id
          and acceptance.document_code = document.code
          and acceptance.document_version = document.version
      )
    ) order by document.required_for_checkout desc, document.title
  ), '[]'::jsonb)
  into documents
  from public.legal_documents document
  where document.status = 'published';

  return jsonb_build_object(
    'club_id', target_club_id,
    'provider', subscription.payment_provider,
    'external_customer_id', subscription.external_customer_id,
    'external_subscription_id', subscription.external_subscription_id,
    'last_invoice_status', subscription.last_invoice_status,
    'last_payment_at', subscription.last_payment_at,
    'payment_failure_count', subscription.payment_failure_count,
    'stripe_mode', settings.stripe_mode,
    'billing_enabled', configuration_ready,
    'legal_acceptance_complete', acceptance_ready,
    'checkout_ready', configuration_ready and acceptance_ready,
    'documents', documents,
    'business_identity', jsonb_build_object(
      'legal_name', settings.legal_name,
      'trading_name', settings.trading_name,
      'support_email', settings.support_email,
      'privacy_email', settings.privacy_email,
      'website_url', settings.website_url,
      'governing_law', settings.governing_law,
      'tax_status', settings.tax_status,
      'vat_number', settings.vat_number
    )
  );
end;
$$;

create or replace function public.accept_billing_legal_documents(
  target_club_id uuid,
  accepted_documents jsonb,
  authority_confirmed boolean default false,
  browser_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  required_document record;
  supplied_version text;
begin
  if actor_id is null or not public.has_club_role(target_club_id, array['owner']) then
    raise exception 'Club owner access required' using errcode = '42501';
  end if;
  if not authority_confirmed then
    raise exception 'Authority to accept the commercial documents must be confirmed' using errcode = '22023';
  end if;
  if accepted_documents is null or jsonb_typeof(accepted_documents) <> 'object' then
    raise exception 'Accepted documents must be supplied as an object' using errcode = '22023';
  end if;
  if not private.billing_legal_configuration_ready() then
    raise exception 'Daxora billing and legal configuration is not ready' using errcode = '55000';
  end if;

  for required_document in
    select code, version
    from public.legal_documents
    where status = 'published'
      and required_for_checkout
  loop
    supplied_version := accepted_documents ->> required_document.code;
    if supplied_version is distinct from required_document.version then
      raise exception 'The current % document must be accepted', required_document.code using errcode = '22023';
    end if;

    insert into public.club_legal_acceptances (
      club_id,
      document_code,
      document_version,
      accepted_by,
      authority_confirmed,
      user_agent,
      metadata
    ) values (
      target_club_id,
      required_document.code,
      required_document.version,
      actor_id,
      true,
      nullif(left(coalesce(browser_user_agent, ''), 500), ''),
      jsonb_build_object('source', 'billing_settings')
    ) on conflict (club_id, document_code, document_version)
    do update set
      accepted_by = excluded.accepted_by,
      accepted_at = now(),
      authority_confirmed = true,
      user_agent = excluded.user_agent,
      metadata = public.club_legal_acceptances.metadata || excluded.metadata;
  end loop;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'billing.legal.accepted',
    'club_subscription',
    target_club_id::text,
    jsonb_build_object('documents', accepted_documents),
    'database'
  );

  return public.get_billing_legal_status(target_club_id);
end;
$$;

create or replace function public.platform_get_billing_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  settings public.platform_legal_settings%rowtype;
  documents jsonb;
begin
  perform private.require_platform_staff('admin');

  select * into settings
  from public.platform_legal_settings
  where singleton = true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'code', document.code,
      'version', document.version,
      'title', document.title,
      'category', document.category,
      'status', document.status,
      'required_for_checkout', document.required_for_checkout,
      'document_url', document.document_url,
      'content_hash', document.content_hash,
      'effective_at', document.effective_at,
      'updated_at', document.updated_at
    ) order by document.required_for_checkout desc, document.title, document.updated_at desc
  ), '[]'::jsonb)
  into documents
  from public.legal_documents document;

  return jsonb_build_object(
    'configuration_ready', private.billing_legal_configuration_ready(),
    'settings', to_jsonb(settings) - 'metadata',
    'documents', documents,
    'metrics', jsonb_build_object(
      'clubs_with_stripe_customer', (select count(*) from public.club_subscriptions where external_customer_id is not null),
      'active_paid_clubs', (select count(*) from public.club_subscriptions where payment_provider = 'stripe' and status = 'active'),
      'failed_events', (select count(*) from public.billing_provider_events where processing_status = 'failed'),
      'unprocessed_events', (select count(*) from public.billing_provider_events where processing_status = 'processing')
    )
  );
end;
$$;

create or replace function public.platform_update_legal_settings(
  next_legal_name text,
  next_trading_name text,
  next_service_address text,
  next_website_url text,
  next_support_email text,
  next_privacy_email text,
  next_governing_law text default 'England and Wales',
  next_stripe_mode text default 'disabled',
  next_tax_status text default 'not_configured',
  next_vat_number text default null,
  next_invoice_prefix text default 'DAX'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_mode text := lower(trim(coalesce(next_stripe_mode, 'disabled')));
  safe_tax_status text := lower(trim(coalesce(next_tax_status, 'not_configured')));
begin
  perform private.require_platform_staff('admin');

  if safe_mode not in ('disabled', 'test', 'live') then
    raise exception 'Unsupported Stripe mode' using errcode = '22023';
  end if;
  if safe_tax_status not in ('not_configured', 'not_vat_registered', 'vat_registered') then
    raise exception 'Unsupported tax status' using errcode = '22023';
  end if;
  if safe_tax_status = 'vat_registered' and length(trim(coalesce(next_vat_number, ''))) < 4 then
    raise exception 'VAT number is required when VAT registered' using errcode = '22023';
  end if;

  update public.platform_legal_settings
  set legal_name = trim(coalesce(next_legal_name, '')),
      trading_name = trim(coalesce(next_trading_name, '')),
      service_address = trim(coalesce(next_service_address, '')),
      website_url = trim(coalesce(next_website_url, '')),
      support_email = lower(trim(coalesce(next_support_email, ''))),
      privacy_email = lower(trim(coalesce(next_privacy_email, ''))),
      governing_law = trim(coalesce(next_governing_law, 'England and Wales')),
      stripe_mode = safe_mode,
      tax_status = safe_tax_status,
      vat_number = nullif(upper(trim(coalesce(next_vat_number, ''))), ''),
      invoice_prefix = upper(trim(coalesce(next_invoice_prefix, 'DAX'))),
      updated_by = actor_id,
      updated_at = now()
  where singleton = true;

  perform private.write_platform_activity(
    'billing.legal_settings.update',
    null,
    'platform_legal_settings',
    'singleton',
    jsonb_build_object('stripe_mode', safe_mode, 'tax_status', safe_tax_status)
  );

  return public.platform_get_billing_readiness();
end;
$$;

create or replace function public.platform_publish_legal_document(
  document_code text,
  next_version text,
  next_title text,
  next_category text,
  next_document_url text,
  next_content_hash text default '',
  next_required_for_checkout boolean default false,
  next_status text default 'published',
  next_effective_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_code text := lower(trim(coalesce(document_code, '')));
  safe_status text := lower(trim(coalesce(next_status, 'published')));
  safe_category text := lower(trim(coalesce(next_category, 'commercial')));
begin
  perform private.require_platform_staff('admin');

  if safe_status not in ('draft', 'published', 'retired') then
    raise exception 'Unsupported document status' using errcode = '22023';
  end if;
  if safe_category not in ('commercial', 'privacy', 'security', 'operational') then
    raise exception 'Unsupported document category' using errcode = '22023';
  end if;
  if safe_status = 'published' and trim(coalesce(next_document_url, '')) !~* '^https://' then
    raise exception 'Published documents require a public HTTPS URL' using errcode = '22023';
  end if;

  if safe_status = 'published' then
    update public.legal_documents
    set status = 'retired', updated_at = now()
    where code = safe_code
      and status = 'published'
      and version <> trim(next_version);
  end if;

  insert into public.legal_documents (
    code, version, title, category, status, required_for_checkout,
    document_url, content_hash, effective_at, published_by, metadata
  ) values (
    safe_code,
    trim(next_version),
    trim(next_title),
    safe_category,
    safe_status,
    coalesce(next_required_for_checkout, false),
    trim(coalesce(next_document_url, '')),
    trim(coalesce(next_content_hash, '')),
    case when safe_status = 'published' then coalesce(next_effective_at, now()) else next_effective_at end,
    case when safe_status = 'published' then actor_id else null end,
    jsonb_build_object('managed_by', 'platform_admin')
  ) on conflict (code, version)
  do update set
    title = excluded.title,
    category = excluded.category,
    status = excluded.status,
    required_for_checkout = excluded.required_for_checkout,
    document_url = excluded.document_url,
    content_hash = excluded.content_hash,
    effective_at = excluded.effective_at,
    published_by = excluded.published_by,
    metadata = public.legal_documents.metadata || excluded.metadata,
    updated_at = now();

  perform private.write_platform_activity(
    'billing.legal_document.update',
    null,
    'legal_document',
    safe_code || ':' || trim(next_version),
    jsonb_build_object('status', safe_status, 'required_for_checkout', next_required_for_checkout)
  );

  return public.platform_get_billing_readiness();
end;
$$;

revoke all on function public.get_billing_legal_status(uuid) from public, anon;
revoke all on function public.accept_billing_legal_documents(uuid, jsonb, boolean, text) from public, anon;
revoke all on function public.platform_get_billing_readiness() from public, anon;
revoke all on function public.platform_update_legal_settings(text, text, text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.platform_publish_legal_document(text, text, text, text, text, text, boolean, text, timestamptz) from public, anon;

grant execute on function public.get_billing_legal_status(uuid) to authenticated;
grant execute on function public.accept_billing_legal_documents(uuid, jsonb, boolean, text) to authenticated;
grant execute on function public.platform_get_billing_readiness() to authenticated;
grant execute on function public.platform_update_legal_settings(text, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.platform_publish_legal_document(text, text, text, text, text, text, boolean, text, timestamptz) to authenticated;

commit;
