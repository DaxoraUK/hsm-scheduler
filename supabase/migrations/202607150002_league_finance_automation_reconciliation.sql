-- Daxora League Operations v3.9.1
-- Finance automation, bulk billing, document delivery and payment reconciliation.

create table if not exists public.league_finance_club_profiles (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  parent_club_id uuid not null references public.league_parent_clubs(id) on delete cascade,
  billing_email text,
  cc_emails text[] not null default '{}',
  account_reference text,
  payment_terms_days integer not null default 30 check (payment_terms_days between 1 and 180),
  reminders_enabled boolean not null default true,
  reminder_days integer[] not null default '{0,7,14}',
  purchase_order_required boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id,parent_club_id)
);

create table if not exists public.league_finance_billing_templates (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete set null,
  charge_type_id uuid not null references public.league_finance_charge_types(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 140),
  scope text not null default 'club' check (scope in ('club','team')),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  due_days integer not null default 30 check (due_days between 1 and 180),
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id,name)
);

create table if not exists public.league_finance_billing_runs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete set null,
  template_id uuid references public.league_finance_billing_templates(id) on delete set null,
  name text not null,
  idempotency_key text not null,
  status text not null default 'processing' check (status in ('processing','draft_created','issued','failed','void')),
  issue_on date not null,
  due_on date,
  invoice_count integer not null default 0,
  total_pence bigint not null default 0,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (league_id,idempotency_key)
);

create table if not exists public.league_finance_billing_run_invoices (
  run_id uuid not null references public.league_finance_billing_runs(id) on delete cascade,
  invoice_id uuid not null references public.league_finance_invoices(id) on delete cascade,
  primary key (run_id,invoice_id)
);

create table if not exists public.league_finance_delivery_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  invoice_id uuid not null references public.league_finance_invoices(id) on delete cascade,
  delivery_kind text not null check (delivery_kind in ('invoice','reminder')),
  status text not null default 'processing' check (status in ('processing','delivered','failed')),
  recipients text[] not null default '{}',
  provider text,
  provider_reference text,
  error_message text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.league_finance_payment_imports (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  filename text not null,
  status text not null default 'processing' check (status in ('processing','applied','failed','void')),
  row_count integer not null default 0,
  matched_count integer not null default 0,
  applied_count integer not null default 0,
  total_pence bigint not null default 0,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.league_finance_payment_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.league_finance_payment_imports(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  invoice_id uuid references public.league_finance_invoices(id) on delete set null,
  row_number integer not null,
  paid_on date not null,
  amount_pence integer not null check (amount_pence > 0),
  reference text,
  status text not null default 'applied' check (status in ('applied','rejected','reversed')),
  error_message text,
  payment_id uuid references public.league_finance_payments(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists league_finance_delivery_invoice_idx on public.league_finance_delivery_events(invoice_id,created_at desc);
create index if not exists league_finance_billing_runs_league_idx on public.league_finance_billing_runs(league_id,created_at desc);
create index if not exists league_finance_payment_imports_league_idx on public.league_finance_payment_imports(league_id,created_at desc);

alter table public.league_finance_club_profiles enable row level security;
alter table public.league_finance_club_profiles force row level security;
alter table public.league_finance_billing_templates enable row level security;
alter table public.league_finance_billing_templates force row level security;
alter table public.league_finance_billing_runs enable row level security;
alter table public.league_finance_billing_runs force row level security;
alter table public.league_finance_billing_run_invoices enable row level security;
alter table public.league_finance_billing_run_invoices force row level security;
alter table public.league_finance_delivery_events enable row level security;
alter table public.league_finance_delivery_events force row level security;
alter table public.league_finance_payment_imports enable row level security;
alter table public.league_finance_payment_imports force row level security;
alter table public.league_finance_payment_import_rows enable row level security;
alter table public.league_finance_payment_import_rows force row level security;

revoke all on public.league_finance_club_profiles from anon,authenticated;
revoke all on public.league_finance_billing_templates from anon,authenticated;
revoke all on public.league_finance_billing_runs from anon,authenticated;
revoke all on public.league_finance_billing_run_invoices from anon,authenticated;
revoke all on public.league_finance_delivery_events from anon,authenticated;
revoke all on public.league_finance_payment_imports from anon,authenticated;
revoke all on public.league_finance_payment_import_rows from anon,authenticated;

create or replace function public.upsert_league_finance_club_profile(target_league_id uuid,profile_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid(); club_id uuid:=nullif(profile_data->>'parent_club_id','')::uuid; target_id uuid;
  safe_email text:=lower(trim(coalesce(profile_data->>'billing_email',''))); safe_cc text[]:='{}'::text[];
  safe_days integer[]:='{}'::integer[];
begin
  if actor_id is null or not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  if club_id is null or not exists(select 1 from public.league_parent_clubs club where club.id=club_id and club.league_id=target_league_id) then raise exception 'Select a valid league club' using errcode='22023'; end if;
  if safe_email<>'' and safe_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid billing email address' using errcode='22023'; end if;
  select coalesce(array_agg(distinct lower(trim(value))) filter(where trim(value)<>''),'{}'::text[]) into safe_cc from jsonb_array_elements_text(coalesce(profile_data->'cc_emails','[]'::jsonb)) item(value);
  if exists(select 1 from unnest(safe_cc) email where email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Every CC recipient must be a valid email address' using errcode='22023'; end if;
  select coalesce(array_agg(distinct greatest(0,least(120,value::integer)) order by greatest(0,least(120,value::integer))),'{}'::integer[]) into safe_days from jsonb_array_elements_text(coalesce(profile_data->'reminder_days','[0,7,14]'::jsonb)) item(value);
  insert into public.league_finance_club_profiles(league_id,parent_club_id,billing_email,cc_emails,account_reference,payment_terms_days,reminders_enabled,reminder_days,purchase_order_required,notes,created_by,updated_by)
  values(target_league_id,club_id,nullif(safe_email,''),safe_cc,nullif(trim(profile_data->>'account_reference'),''),greatest(1,least(180,coalesce((profile_data->>'payment_terms_days')::integer,30))),coalesce((profile_data->>'reminders_enabled')::boolean,true),safe_days,coalesce((profile_data->>'purchase_order_required')::boolean,false),nullif(trim(profile_data->>'notes'),''),actor_id,actor_id)
  on conflict(league_id,parent_club_id) do update set billing_email=excluded.billing_email,cc_emails=excluded.cc_emails,account_reference=excluded.account_reference,payment_terms_days=excluded.payment_terms_days,reminders_enabled=excluded.reminders_enabled,reminder_days=excluded.reminder_days,purchase_order_required=excluded.purchase_order_required,notes=excluded.notes,updated_by=actor_id,updated_at=now()
  returning id into target_id;
  perform private.write_league_audit(target_league_id,'league.finance_profile_saved','finance_profile',target_id,jsonb_build_object('club_id',club_id));
  return target_id;
end;
$$;

create or replace function public.upsert_league_finance_billing_template(target_league_id uuid,template_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid(); target_id uuid:=nullif(template_data->>'id','')::uuid; charge_id uuid:=nullif(template_data->>'charge_type_id','')::uuid;
  safe_name text:=trim(coalesce(template_data->>'name','')); safe_scope text:=lower(trim(coalesce(template_data->>'scope','club')));
begin
  if actor_id is null or not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  if length(safe_name)<2 then raise exception 'Template name is required' using errcode='22023'; end if;
  if safe_scope not in ('club','team') then raise exception 'Invalid billing scope' using errcode='22023'; end if;
  if charge_id is null or not exists(select 1 from public.league_finance_charge_types charge where charge.id=charge_id and charge.league_id=target_league_id and charge.active) then raise exception 'Select an active charge type' using errcode='22023'; end if;
  if target_id is null then
    insert into public.league_finance_billing_templates(league_id,season_id,charge_type_id,name,scope,quantity,due_days,active,notes,created_by,updated_by)
    values(target_league_id,nullif(template_data->>'season_id','')::uuid,charge_id,safe_name,safe_scope,greatest(0.001,coalesce((template_data->>'quantity')::numeric,1)),greatest(1,least(180,coalesce((template_data->>'due_days')::integer,30))),coalesce((template_data->>'active')::boolean,true),nullif(trim(template_data->>'notes'),''),actor_id,actor_id)
    returning id into target_id;
  else
    update public.league_finance_billing_templates set season_id=nullif(template_data->>'season_id','')::uuid,charge_type_id=charge_id,name=safe_name,scope=safe_scope,quantity=greatest(0.001,coalesce((template_data->>'quantity')::numeric,1)),due_days=greatest(1,least(180,coalesce((template_data->>'due_days')::integer,30))),active=coalesce((template_data->>'active')::boolean,true),notes=nullif(trim(template_data->>'notes'),''),updated_by=actor_id,updated_at=now()
    where id=target_id and league_id=target_league_id;
    if not found then raise exception 'Billing template not found' using errcode='P0002'; end if;
  end if;
  perform private.write_league_audit(target_league_id,'league.finance_billing_template_saved','finance_billing_template',target_id,jsonb_build_object('name',safe_name,'scope',safe_scope));
  return target_id;
end;
$$;

create or replace function public.create_league_finance_billing_run(target_league_id uuid,run_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid(); template_row public.league_finance_billing_templates%rowtype; charge_row public.league_finance_charge_types%rowtype;
  run_id uuid; club_row record; invoice_id uuid; quantity_value numeric; net_value integer; tax_value integer; total_value integer;
  invoice_count_value integer:=0; run_total bigint:=0; selected_ids uuid[]:='{}'::uuid[];
  safe_key text:=trim(coalesce(run_data->>'idempotency_key','')); safe_name text:=trim(coalesce(run_data->>'name','Bulk billing run'));
  issue_date date:=coalesce(nullif(run_data->>'issue_on','')::date,current_date); due_date date:=nullif(run_data->>'due_on','')::date;
  issue_immediately boolean:=coalesce((run_data->>'issue_immediately')::boolean,false); run_status text;
begin
  if actor_id is null or not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  if safe_key='' then raise exception 'A billing-run idempotency key is required' using errcode='22023'; end if;
  select * into template_row from public.league_finance_billing_templates where id=nullif(run_data->>'template_id','')::uuid and league_id=target_league_id and active;
  if template_row.id is null then raise exception 'Select an active billing template' using errcode='22023'; end if;
  select * into charge_row from public.league_finance_charge_types where id=template_row.charge_type_id and league_id=target_league_id and active;
  if charge_row.id is null then raise exception 'The template charge is unavailable' using errcode='22023'; end if;
  if due_date is null then due_date:=issue_date+template_row.due_days; end if;
  if due_date<issue_date then raise exception 'Due date cannot precede issue date' using errcode='22023'; end if;
  select coalesce(array_agg(value::uuid),'{}'::uuid[]) into selected_ids from jsonb_array_elements_text(coalesce(run_data->'parent_club_ids','[]'::jsonb)) item(value);
  select id into run_id from public.league_finance_billing_runs where league_id=target_league_id and idempotency_key=safe_key;
  if run_id is not null then
    return (select jsonb_build_object('id',run.id,'status',run.status,'invoice_count',run.invoice_count,'total_pence',run.total_pence,'reused',true) from public.league_finance_billing_runs run where run.id=run_id);
  end if;
  insert into public.league_finance_billing_runs(league_id,season_id,template_id,name,idempotency_key,status,issue_on,due_on,created_by)
  values(target_league_id,coalesce(nullif(run_data->>'season_id','')::uuid,template_row.season_id),template_row.id,safe_name,safe_key,'processing',issue_date,due_date,actor_id)
  returning id into run_id;
  for club_row in
    select club.id,club.name,coalesce(profile.payment_terms_days,template_row.due_days) as terms,
      case when template_row.scope='team' then (select count(*) from public.league_teams team where team.league_id=target_league_id and team.parent_club_id=club.id and team.status='active' and (coalesce(nullif(run_data->>'season_id','')::uuid,template_row.season_id) is null or team.season_id=coalesce(nullif(run_data->>'season_id','')::uuid,template_row.season_id))) else 1 end as units
    from public.league_parent_clubs club
    left join public.league_finance_club_profiles profile on profile.league_id=target_league_id and profile.parent_club_id=club.id
    where club.league_id=target_league_id and club.status='active' and (cardinality(selected_ids)=0 or club.id=any(selected_ids))
    order by club.name
  loop
    if club_row.units<=0 then continue; end if;
    quantity_value:=template_row.quantity*club_row.units;
    net_value:=round(quantity_value*charge_row.default_amount_pence)::integer;
    tax_value:=round(net_value*charge_row.tax_rate/100)::integer;
    total_value:=net_value+tax_value;
    insert into public.league_finance_invoices(league_id,season_id,parent_club_id,invoice_number,status,issue_on,due_on,period_label,notes,created_by,updated_by)
    values(target_league_id,coalesce(nullif(run_data->>'season_id','')::uuid,template_row.season_id),club_row.id,private.next_league_invoice_number(target_league_id),'draft',issue_date,coalesce(due_date,issue_date+club_row.terms),safe_name,'Created by automated billing run '||safe_name,actor_id,actor_id)
    returning id into invoice_id;
    insert into public.league_finance_invoice_lines(league_id,invoice_id,charge_type_id,description,quantity,unit_amount_pence,tax_rate,net_pence,tax_pence,total_pence,source_type,source_id,source_label,created_by)
    values(target_league_id,invoice_id,charge_row.id,charge_row.name,quantity_value,charge_row.default_amount_pence,charge_row.tax_rate,net_value,tax_value,total_value,'billing_template',template_row.id,safe_name,actor_id);
    perform private.recalculate_league_finance_invoice(invoice_id);
    if issue_immediately then update public.league_finance_invoices set status='issued',issued_at=now(),updated_at=now() where id=invoice_id; end if;
    insert into public.league_finance_billing_run_invoices(run_id,invoice_id) values(run_id,invoice_id);
    invoice_count_value:=invoice_count_value+1; run_total:=run_total+total_value;
  end loop;
  if invoice_count_value=0 then
    update public.league_finance_billing_runs set status='failed',error_message='No eligible clubs or teams were found',completed_at=now() where id=run_id;
    raise exception 'No eligible clubs or teams were found for this billing run' using errcode='22023';
  end if;
  run_status:=case when issue_immediately then 'issued' else 'draft_created' end;
  update public.league_finance_billing_runs set status=run_status,invoice_count=invoice_count_value,total_pence=run_total,completed_at=now() where id=run_id;
  perform private.write_league_audit(target_league_id,'league.finance_billing_run_completed','finance_billing_run',run_id,jsonb_build_object('invoice_count',invoice_count_value,'total_pence',run_total,'status',run_status));
  return jsonb_build_object('id',run_id,'status',run_status,'invoice_count',invoice_count_value,'total_pence',run_total,'reused',false);
exception when others then
  if run_id is not null then update public.league_finance_billing_runs set status='failed',error_message=sqlerrm,completed_at=now() where id=run_id; end if;
  raise;
end;
$$;

create or replace function public.apply_league_finance_payment_batch(target_league_id uuid,filename_value text,payment_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid(); import_id uuid; row_value jsonb; invoice_row public.league_finance_invoices%rowtype; payment_id uuid;
  row_count_value integer:=0; applied_count_value integer:=0; total_value bigint:=0; amount_value integer; row_number_value integer;
begin
  if actor_id is null or not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  if jsonb_typeof(coalesce(payment_rows,'[]'::jsonb))<>'array' then raise exception 'Payment rows must be an array' using errcode='22023'; end if;
  insert into public.league_finance_payment_imports(league_id,filename,status,created_by) values(target_league_id,coalesce(nullif(trim(filename_value),''),'payment-import.csv'),'processing',actor_id) returning id into import_id;
  for row_value in select value from jsonb_array_elements(coalesce(payment_rows,'[]'::jsonb)) loop
    row_count_value:=row_count_value+1; row_number_value:=coalesce((row_value->>'row_number')::integer,row_count_value+1); amount_value:=coalesce((row_value->>'amount_pence')::integer,0);
    select * into invoice_row from public.league_finance_invoices where id=nullif(row_value->>'invoice_id','')::uuid and league_id=target_league_id for update;
    if invoice_row.id is null or invoice_row.status in ('draft','void','paid') or amount_value<=0 then
      insert into public.league_finance_payment_import_rows(import_id,league_id,invoice_id,row_number,paid_on,amount_pence,reference,status,error_message)
      values(import_id,target_league_id,invoice_row.id,row_number_value,coalesce(nullif(row_value->>'paid_on','')::date,current_date),greatest(1,amount_value),nullif(trim(row_value->>'reference'),''),'rejected','Invoice is unavailable or the amount is invalid');
      continue;
    end if;
    if amount_value>(invoice_row.total_pence-coalesce((select sum(amount_pence) from public.league_finance_payments where invoice_id=invoice_row.id and status<>'reversed'),0)-coalesce((select sum(amount_pence) from public.league_finance_credits where invoice_id=invoice_row.id and status<>'void'),0)) then
      insert into public.league_finance_payment_import_rows(import_id,league_id,invoice_id,row_number,paid_on,amount_pence,reference,status,error_message)
      values(import_id,target_league_id,invoice_row.id,row_number_value,coalesce(nullif(row_value->>'paid_on','')::date,current_date),amount_value,nullif(trim(row_value->>'reference'),''),'rejected','Payment exceeds the outstanding invoice balance');
      continue;
    end if;
    insert into public.league_finance_payments(league_id,invoice_id,parent_club_id,amount_pence,paid_on,payment_method,reference,notes,status,created_by)
    values(target_league_id,invoice_row.id,invoice_row.parent_club_id,amount_value,coalesce(nullif(row_value->>'paid_on','')::date,current_date),'bank_transfer',nullif(trim(row_value->>'reference'),''),'Imported from '||coalesce(nullif(trim(filename_value),''),'payment file'),'received',actor_id)
    returning id into payment_id;
    insert into public.league_finance_payment_import_rows(import_id,league_id,invoice_id,row_number,paid_on,amount_pence,reference,status,payment_id)
    values(import_id,target_league_id,invoice_row.id,row_number_value,coalesce(nullif(row_value->>'paid_on','')::date,current_date),amount_value,nullif(trim(row_value->>'reference'),''),'applied',payment_id);
    perform private.recalculate_league_finance_invoice(invoice_row.id);
    applied_count_value:=applied_count_value+1; total_value:=total_value+amount_value;
  end loop;
  update public.league_finance_payment_imports set status='applied',row_count=row_count_value,matched_count=applied_count_value,applied_count=applied_count_value,total_pence=total_value,completed_at=now() where id=import_id;
  perform private.write_league_audit(target_league_id,'league.finance_payment_import_applied','finance_payment_import',import_id,jsonb_build_object('rows',row_count_value,'applied',applied_count_value,'total_pence',total_value));
  return jsonb_build_object('id',import_id,'row_count',row_count_value,'applied_count',applied_count_value,'total_pence',total_value);
exception when others then
  if import_id is not null then update public.league_finance_payment_imports set status='failed',error_message=sqlerrm,completed_at=now() where id=import_id; end if;
  raise;
end;
$$;

create or replace function public.prepare_league_finance_delivery(target_league_id uuid,target_invoice_id uuid,requested_kind text default 'invoice')
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid(); safe_kind text:=lower(trim(coalesce(requested_kind,'invoice'))); invoice_row record; profile_row record; delivery_id uuid; recipients text[]:='{}'::text[]; league_name text;
begin
  if actor_id is null or not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  if safe_kind not in ('invoice','reminder') then raise exception 'Invalid finance delivery type' using errcode='22023'; end if;
  select invoice.*,club.name as parent_club_name into invoice_row from public.league_finance_invoices invoice join public.league_parent_clubs club on club.id=invoice.parent_club_id where invoice.id=target_invoice_id and invoice.league_id=target_league_id;
  if invoice_row.id is null or invoice_row.status in ('draft','void') then raise exception 'Only issued invoices can be delivered' using errcode='22023'; end if;
  select profile.*,club.name as parent_club_name into profile_row from public.league_finance_club_profiles profile join public.league_parent_clubs club on club.id=profile.parent_club_id where profile.league_id=target_league_id and profile.parent_club_id=invoice_row.parent_club_id;
  if profile_row.id is null or coalesce(trim(profile_row.billing_email),'')='' then raise exception 'Add a billing email to the club finance profile before delivery' using errcode='22023'; end if;
  recipients:=array[lower(trim(profile_row.billing_email))]||coalesce(profile_row.cc_emails,'{}'::text[]);
  select name into league_name from public.leagues where id=target_league_id;
  insert into public.league_finance_delivery_events(league_id,invoice_id,delivery_kind,status,recipients,requested_by) values(target_league_id,target_invoice_id,safe_kind,'processing',recipients,actor_id) returning id into delivery_id;
  perform private.write_league_audit(target_league_id,'league.finance_document_delivery_started','finance_delivery',delivery_id,jsonb_build_object('invoice_id',target_invoice_id,'kind',safe_kind,'recipient_count',cardinality(recipients)));
  return jsonb_build_object(
    'delivery_id',delivery_id,'league_id',target_league_id,'league_name',league_name,'delivery_kind',safe_kind,'recipients',to_jsonb(recipients),
    'profile',to_jsonb(profile_row),
    'invoice',(select to_jsonb(document_row) from (
      select invoice_row.id,invoice_row.parent_club_id,invoice_row.parent_club_name,invoice_row.invoice_number,invoice_row.status,invoice_row.issue_on,invoice_row.due_on,invoice_row.period_label,invoice_row.purchase_order_reference,invoice_row.notes,invoice_row.subtotal_pence,invoice_row.tax_pence,invoice_row.total_pence,
        coalesce((select sum(payment.amount_pence) from public.league_finance_payments payment where payment.invoice_id=invoice_row.id and payment.status<>'reversed'),0) as paid_pence,
        coalesce((select sum(credit.amount_pence) from public.league_finance_credits credit where credit.invoice_id=invoice_row.id and credit.status<>'void'),0) as credited_pence,
        greatest(0,invoice_row.total_pence-coalesce((select sum(payment.amount_pence) from public.league_finance_payments payment where payment.invoice_id=invoice_row.id and payment.status<>'reversed'),0)-coalesce((select sum(credit.amount_pence) from public.league_finance_credits credit where credit.invoice_id=invoice_row.id and credit.status<>'void'),0)) as balance_pence,
        coalesce((select jsonb_agg(to_jsonb(line) order by line.created_at) from public.league_finance_invoice_lines line where line.invoice_id=invoice_row.id),'[]'::jsonb) as lines
    ) document_row)
  );
end;
$$;

create or replace function public.claim_due_league_finance_reminders(batch_size integer default 50)
returns setof jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  item record;
  delivery_id uuid;
  recipients text[];
  threshold_day integer;
begin
  if not private.is_service_role() then raise exception 'Service role required' using errcode='42501'; end if;
  for item in
    select invoice.id as invoice_id, invoice.league_id, invoice.parent_club_id, invoice.due_on,
      league.name as league_name, club.name as parent_club_name,
      profile.reminder_days, profile.billing_email, profile.cc_emails,
      to_jsonb(profile) || jsonb_build_object('parent_club_name',club.name) as profile_json
    from public.league_finance_invoices invoice
    join public.leagues league on league.id=invoice.league_id
    join public.league_parent_clubs club on club.id=invoice.parent_club_id
    join public.league_finance_club_profiles profile on profile.league_id=invoice.league_id and profile.parent_club_id=invoice.parent_club_id
    where invoice.status not in ('draft','void','paid')
      and invoice.due_on is not null and invoice.due_on<=current_date
      and profile.reminders_enabled
      and coalesce(trim(profile.billing_email),'')<>''
      and greatest(0,invoice.total_pence
        -coalesce((select sum(payment.amount_pence) from public.league_finance_payments payment where payment.invoice_id=invoice.id and payment.status<>'reversed'),0)
        -coalesce((select sum(credit.amount_pence) from public.league_finance_credits credit where credit.invoice_id=invoice.id and credit.status<>'void'),0))>0
    order by invoice.due_on,invoice.created_at
    for update of invoice skip locked
    limit greatest(1,least(200,coalesce(batch_size,50)))
  loop
    select max(day_value) into threshold_day
    from unnest(coalesce(item.reminder_days,'{0,7,14}'::integer[])) day_value
    where day_value>=0 and day_value<=(current_date-item.due_on);
    if threshold_day is null then continue; end if;
    if exists(
      select 1 from public.league_finance_delivery_events event
      where event.invoice_id=item.invoice_id and event.delivery_kind='reminder'
        and event.status in ('processing','delivered')
        and event.created_at::date>=item.due_on+threshold_day
    ) then continue; end if;
    recipients:=array[lower(trim(item.billing_email))]||coalesce(item.cc_emails,'{}'::text[]);
    insert into public.league_finance_delivery_events(league_id,invoice_id,delivery_kind,status,recipients,requested_by)
    values(item.league_id,item.invoice_id,'reminder','processing',recipients,null)
    returning id into delivery_id;
    return next jsonb_build_object(
      'delivery_id',delivery_id,'league_id',item.league_id,'league_name',item.league_name,'delivery_kind','reminder','recipients',to_jsonb(recipients),
      'profile',item.profile_json,
      'invoice',(select to_jsonb(document_row) from (
        select invoice.id,invoice.parent_club_id,club.name as parent_club_name,invoice.invoice_number,invoice.status,invoice.issue_on,invoice.due_on,invoice.period_label,invoice.purchase_order_reference,invoice.notes,invoice.subtotal_pence,invoice.tax_pence,invoice.total_pence,
          coalesce((select sum(payment.amount_pence) from public.league_finance_payments payment where payment.invoice_id=invoice.id and payment.status<>'reversed'),0) as paid_pence,
          coalesce((select sum(credit.amount_pence) from public.league_finance_credits credit where credit.invoice_id=invoice.id and credit.status<>'void'),0) as credited_pence,
          greatest(0,invoice.total_pence-coalesce((select sum(payment.amount_pence) from public.league_finance_payments payment where payment.invoice_id=invoice.id and payment.status<>'reversed'),0)-coalesce((select sum(credit.amount_pence) from public.league_finance_credits credit where credit.invoice_id=invoice.id and credit.status<>'void'),0)) as balance_pence,
          coalesce((select jsonb_agg(to_jsonb(line) order by line.created_at) from public.league_finance_invoice_lines line where line.invoice_id=invoice.id),'[]'::jsonb) as lines
        from public.league_finance_invoices invoice
        join public.league_parent_clubs club on club.id=invoice.parent_club_id
        where invoice.id=item.invoice_id
      ) document_row)
    );
  end loop;
end;
$$;

create or replace function public.complete_league_finance_delivery(target_delivery_id uuid,next_status text,provider_name text default '',provider_reference_value text default '',error_message_value text default '')
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare safe_status text:=lower(trim(coalesce(next_status,''))); target_league_id uuid;
begin
  if not private.is_service_role() then raise exception 'Service role required' using errcode='42501'; end if;
  if safe_status not in ('delivered','failed') then raise exception 'Invalid finance delivery status' using errcode='22023'; end if;
  update public.league_finance_delivery_events set status=safe_status,provider=nullif(trim(provider_name),''),provider_reference=nullif(trim(provider_reference_value),''),error_message=nullif(trim(error_message_value),''),completed_at=now() where id=target_delivery_id returning league_id into target_league_id;
  if target_league_id is null then raise exception 'Finance delivery not found' using errcode='P0002'; end if;
  perform private.write_league_audit(target_league_id,'league.finance_document_delivery_completed','finance_delivery',target_delivery_id,jsonb_build_object('status',safe_status,'provider',provider_name));
end;
$$;

create or replace function public.get_league_finance_data(target_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare actor_role text:=private.current_league_role(target_league_id,auth.uid());
begin
  if not public.can_view_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'access',jsonb_build_object('role',actor_role,'can_view',true,'can_manage',public.can_manage_league_finance(target_league_id),'is_club_portal',false),
    'charge_types',coalesce((select jsonb_agg(to_jsonb(charge) order by charge.name) from public.league_finance_charge_types charge where charge.league_id=target_league_id),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(to_jsonb(invoice_row) order by invoice_row.issue_on desc nulls last,invoice_row.created_at desc) from (select invoice.*,club.name as parent_club_name from public.league_finance_invoices invoice join public.league_parent_clubs club on club.id=invoice.parent_club_id where invoice.league_id=target_league_id) invoice_row),'[]'::jsonb),
    'invoice_lines',coalesce((select jsonb_agg(to_jsonb(line) order by line.created_at) from public.league_finance_invoice_lines line where line.league_id=target_league_id),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(payment) order by payment.paid_on desc,payment.created_at desc) from public.league_finance_payments payment where payment.league_id=target_league_id),'[]'::jsonb),
    'credits',coalesce((select jsonb_agg(to_jsonb(credit) order by credit.credit_on desc,credit.created_at desc) from public.league_finance_credits credit where credit.league_id=target_league_id),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(to_jsonb(expense) order by expense.expense_on desc,expense.created_at desc) from public.league_finance_expenses expense where expense.league_id=target_league_id),'[]'::jsonb),
    'unbilled_fines',coalesce((select jsonb_agg(to_jsonb(fine_row) order by fine_row.payment_due_on nulls last) from (select sanction.id,sanction.case_id,discipline.case_reference,sanction.amount_pence,sanction.payment_due_on,discipline.respondent_club_id as parent_club_id,club.name as parent_club_name,sanction.subject_label from public.league_case_sanctions sanction join public.league_discipline_cases discipline on discipline.id=sanction.case_id left join public.league_parent_clubs club on club.id=discipline.respondent_club_id where sanction.league_id=target_league_id and sanction.sanction_type='fine' and sanction.amount_pence>0 and sanction.status not in ('paid','revoked') and not exists(select 1 from public.league_finance_invoice_lines line where line.league_id=target_league_id and line.source_type='discipline_sanction' and line.source_id=sanction.id)) fine_row),'[]'::jsonb),
    'club_profiles',coalesce((select jsonb_agg(to_jsonb(profile_row) order by profile_row.parent_club_name) from (select profile.*,club.name as parent_club_name from public.league_finance_club_profiles profile join public.league_parent_clubs club on club.id=profile.parent_club_id where profile.league_id=target_league_id) profile_row),'[]'::jsonb),
    'billing_templates',coalesce((select jsonb_agg(to_jsonb(template_row) order by template_row.active desc,template_row.name) from (select template.*,charge.name as charge_name from public.league_finance_billing_templates template join public.league_finance_charge_types charge on charge.id=template.charge_type_id where template.league_id=target_league_id) template_row),'[]'::jsonb),
    'billing_runs',coalesce((select jsonb_agg(to_jsonb(run_row) order by run_row.created_at desc) from (select * from public.league_finance_billing_runs where league_id=target_league_id order by created_at desc limit 60) run_row),'[]'::jsonb),
    'delivery_events',coalesce((select jsonb_agg(to_jsonb(delivery_row) order by delivery_row.created_at desc) from (select event.*,invoice.invoice_number,club.name as parent_club_name from public.league_finance_delivery_events event join public.league_finance_invoices invoice on invoice.id=event.invoice_id join public.league_parent_clubs club on club.id=invoice.parent_club_id where event.league_id=target_league_id order by event.created_at desc limit 100) delivery_row),'[]'::jsonb),
    'payment_imports',coalesce((select jsonb_agg(to_jsonb(import_row) order by import_row.created_at desc) from (select * from public.league_finance_payment_imports where league_id=target_league_id order by created_at desc limit 50) import_row),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.upsert_league_finance_club_profile(uuid,jsonb) from public,anon;
revoke all on function public.upsert_league_finance_billing_template(uuid,jsonb) from public,anon;
revoke all on function public.create_league_finance_billing_run(uuid,jsonb) from public,anon;
revoke all on function public.apply_league_finance_payment_batch(uuid,text,jsonb) from public,anon;
revoke all on function public.prepare_league_finance_delivery(uuid,uuid,text) from public,anon;
revoke all on function public.claim_due_league_finance_reminders(integer) from public,anon,authenticated;
revoke all on function public.complete_league_finance_delivery(uuid,text,text,text,text) from public,anon,authenticated;

grant execute on function public.upsert_league_finance_club_profile(uuid,jsonb) to authenticated;
grant execute on function public.upsert_league_finance_billing_template(uuid,jsonb) to authenticated;
grant execute on function public.create_league_finance_billing_run(uuid,jsonb) to authenticated;
grant execute on function public.apply_league_finance_payment_batch(uuid,text,jsonb) to authenticated;
grant execute on function public.prepare_league_finance_delivery(uuid,uuid,text) to authenticated;
grant execute on function public.claim_due_league_finance_reminders(integer) to service_role;
grant execute on function public.complete_league_finance_delivery(uuid,text,text,text,text) to service_role;

create or replace function public.get_league_club_finance_data(target_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare actor_id uuid:=auth.uid(); club_id uuid:=private.current_league_club_id(target_league_id,actor_id); actor_role text:=private.current_league_role(target_league_id,actor_id);
begin
  if actor_id is null or club_id is null then raise exception 'Club finance access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'access',jsonb_build_object('role',actor_role,'can_view',true,'can_manage',false,'is_club_portal',true),
    'charge_types','[]'::jsonb,
    'invoices',coalesce((select jsonb_agg(to_jsonb(invoice_row) order by invoice_row.issue_on desc nulls last,invoice_row.created_at desc) from (select invoice.*,club.name as parent_club_name from public.league_finance_invoices invoice join public.league_parent_clubs club on club.id=invoice.parent_club_id where invoice.league_id=target_league_id and invoice.parent_club_id=club_id and invoice.status<>'draft') invoice_row),'[]'::jsonb),
    'invoice_lines',coalesce((select jsonb_agg(to_jsonb(line) order by line.created_at) from public.league_finance_invoice_lines line join public.league_finance_invoices invoice on invoice.id=line.invoice_id where line.league_id=target_league_id and invoice.parent_club_id=club_id and invoice.status<>'draft'),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(payment) order by payment.paid_on desc,payment.created_at desc) from public.league_finance_payments payment where payment.league_id=target_league_id and payment.parent_club_id=club_id),'[]'::jsonb),
    'credits',coalesce((select jsonb_agg(to_jsonb(credit) order by credit.credit_on desc,credit.created_at desc) from public.league_finance_credits credit where credit.league_id=target_league_id and credit.parent_club_id=club_id),'[]'::jsonb),
    'expenses','[]'::jsonb,'unbilled_fines','[]'::jsonb,
    'club_profiles',coalesce((select jsonb_agg(to_jsonb(profile_row)) from (select profile.*,club.name as parent_club_name from public.league_finance_club_profiles profile join public.league_parent_clubs club on club.id=profile.parent_club_id where profile.league_id=target_league_id and profile.parent_club_id=club_id) profile_row),'[]'::jsonb),
    'billing_templates','[]'::jsonb,'billing_runs','[]'::jsonb,'delivery_events','[]'::jsonb,'payment_imports','[]'::jsonb
  );
end;
$$;
