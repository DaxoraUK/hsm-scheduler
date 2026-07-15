-- Daxora League Operations v3.9: finance and commercial administration.
begin;

alter table public.league_memberships drop constraint if exists league_memberships_role_check;
alter table public.league_memberships add constraint league_memberships_role_check
  check (role in ('owner','admin','fixtures','officials','results','discipline','registrations','finance','viewer'));

alter table public.league_invitations drop constraint if exists league_invitations_role_check;
alter table public.league_invitations add constraint league_invitations_role_check
  check (role in ('admin','fixtures','officials','results','discipline','registrations','finance','viewer'));

create table if not exists public.league_finance_charge_types (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  code text not null check (length(trim(code)) between 2 and 40),
  category text not null default 'other'
    check (category in ('affiliation','team_entry','competition_entry','cup_entry','fine','official_fee','facility','administration','other')),
  default_amount_pence integer not null default 0 check (default_amount_pence between 0 and 100000000),
  tax_rate numeric(6,3) not null default 0 check (tax_rate between 0 and 100),
  active boolean not null default true,
  notes text check (notes is null or length(notes) <= 5000),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, code)
);

create table if not exists public.league_finance_invoices (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete restrict,
  parent_club_id uuid not null references public.league_parent_clubs(id) on delete restrict,
  invoice_number text not null,
  status text not null default 'draft'
    check (status in ('draft','issued','part_paid','paid','overdue','void')),
  issue_on date,
  due_on date,
  period_label text,
  purchase_order_reference text,
  notes text check (notes is null or length(notes) <= 10000),
  subtotal_pence integer not null default 0 check (subtotal_pence between 0 and 1000000000),
  tax_pence integer not null default 0 check (tax_pence between 0 and 1000000000),
  total_pence integer not null default 0 check (total_pence between 0 and 1000000000),
  issued_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, invoice_number)
);

create table if not exists public.league_finance_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  invoice_id uuid not null references public.league_finance_invoices(id) on delete cascade,
  charge_type_id uuid references public.league_finance_charge_types(id) on delete set null,
  description text not null check (length(trim(description)) between 2 and 500),
  quantity numeric(12,3) not null default 1 check (quantity > 0 and quantity <= 100000),
  unit_amount_pence integer not null default 0 check (unit_amount_pence between -100000000 and 100000000),
  tax_rate numeric(6,3) not null default 0 check (tax_rate between 0 and 100),
  net_pence integer not null default 0 check (net_pence between -1000000000 and 1000000000),
  tax_pence integer not null default 0 check (tax_pence between -1000000000 and 1000000000),
  total_pence integer not null default 0 check (total_pence between -1000000000 and 1000000000),
  source_type text check (source_type is null or source_type in ('discipline_sanction','team_entry','competition_entry','official_expense','manual','other')),
  source_id uuid,
  source_label text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists league_finance_invoice_lines_source_unique
  on public.league_finance_invoice_lines(league_id,source_type,source_id)
  where source_id is not null and source_type is not null;

create table if not exists public.league_finance_payments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  invoice_id uuid not null references public.league_finance_invoices(id) on delete restrict,
  parent_club_id uuid not null references public.league_parent_clubs(id) on delete restrict,
  amount_pence integer not null check (amount_pence > 0 and amount_pence <= 1000000000),
  paid_on date not null default current_date,
  payment_method text not null default 'bank_transfer'
    check (payment_method in ('bank_transfer','card','cash','cheque','direct_debit','credit_offset','other')),
  reference text,
  notes text check (notes is null or length(notes) <= 5000),
  status text not null default 'received' check (status in ('received','cleared','reversed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.league_finance_credits (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  invoice_id uuid not null references public.league_finance_invoices(id) on delete restrict,
  parent_club_id uuid not null references public.league_parent_clubs(id) on delete restrict,
  amount_pence integer not null check (amount_pence > 0 and amount_pence <= 1000000000),
  credit_on date not null default current_date,
  reason text not null check (length(trim(reason)) between 2 and 5000),
  reference text,
  status text not null default 'applied' check (status in ('applied','void')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.league_finance_expenses (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete restrict,
  official_id uuid references public.league_officials(id) on delete set null,
  official_name text not null check (length(trim(official_name)) between 2 and 220),
  publication_fixture_id uuid references public.league_publication_fixtures(id) on delete set null,
  fixture_label text,
  expense_type text not null default 'match_fee'
    check (expense_type in ('match_fee','assistant_fee','travel','mileage','parking','equipment','administration','other')),
  amount_pence integer not null check (amount_pence > 0 and amount_pence <= 100000000),
  expense_on date not null default current_date,
  status text not null default 'submitted' check (status in ('draft','submitted','approved','rejected','paid','void')),
  payment_reference text,
  notes text check (notes is null or length(notes) <= 5000),
  submitted_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists league_finance_invoice_queue_idx on public.league_finance_invoices(league_id,status,due_on,issue_on desc);
create index if not exists league_finance_invoice_club_idx on public.league_finance_invoices(league_id,parent_club_id,status,due_on);
create index if not exists league_finance_invoice_line_idx on public.league_finance_invoice_lines(league_id,invoice_id,created_at);
create index if not exists league_finance_payment_idx on public.league_finance_payments(league_id,invoice_id,paid_on desc);
create index if not exists league_finance_credit_idx on public.league_finance_credits(league_id,invoice_id,credit_on desc);
create index if not exists league_finance_expense_queue_idx on public.league_finance_expenses(league_id,status,expense_on desc);

alter table public.league_finance_charge_types enable row level security;
alter table public.league_finance_charge_types force row level security;
alter table public.league_finance_invoices enable row level security;
alter table public.league_finance_invoices force row level security;
alter table public.league_finance_invoice_lines enable row level security;
alter table public.league_finance_invoice_lines force row level security;
alter table public.league_finance_payments enable row level security;
alter table public.league_finance_payments force row level security;
alter table public.league_finance_credits enable row level security;
alter table public.league_finance_credits force row level security;
alter table public.league_finance_expenses enable row level security;
alter table public.league_finance_expenses force row level security;

revoke all on table public.league_finance_charge_types, public.league_finance_invoices,
  public.league_finance_invoice_lines, public.league_finance_payments,
  public.league_finance_credits, public.league_finance_expenses from anon, authenticated;

create or replace function public.can_view_league_finance(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select auth.uid() is not null and (
    private.is_platform_admin(auth.uid())
    or private.current_league_role(target_league_id,auth.uid()) in ('owner','admin','finance')
  );
$$;

create or replace function public.can_manage_league_finance(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select public.can_view_league_finance(target_league_id);
$$;

create or replace function public.create_league_invitation(target_league_id uuid,invite_email text,invite_role text default 'viewer',expiry_hours integer default 168)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_email text := lower(trim(coalesce(invite_email,'')));
  safe_role text := lower(trim(coalesce(invite_role,'viewer')));
  raw_token text := encode(gen_random_bytes(32),'hex');
  invitation_id uuid;
  invitation_expiry timestamptz;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  if position('@' in safe_email) <= 1 then raise exception 'A valid email address is required' using errcode='22023'; end if;
  if safe_role not in ('admin','fixtures','officials','results','discipline','registrations','finance','viewer') then raise exception 'Invalid league role' using errcode='22023'; end if;
  update public.league_invitations invitation_value set status='revoked',revoked_at=now(),updated_at=now()
    where invitation_value.league_id=target_league_id and lower(invitation_value.email)=safe_email and invitation_value.status='pending';
  invitation_expiry := now() + make_interval(hours => greatest(1,least(coalesce(expiry_hours,168),720)));
  insert into public.league_invitations(league_id,email,role,token_hash,status,invited_by,expires_at)
    values(target_league_id,safe_email,safe_role,encode(digest(raw_token,'sha256'),'hex'),'pending',actor_id,invitation_expiry)
    returning id into invitation_id;
  perform private.write_league_audit(target_league_id,'league.invitation_created','invitation',invitation_id,jsonb_build_object('email',safe_email,'role',safe_role));
  return jsonb_build_object('id',invitation_id,'token',raw_token,'email',safe_email,'role',safe_role,'expires_at',invitation_expiry);
end;
$$;

create or replace function public.update_league_member_role(target_league_id uuid,target_user_id uuid,next_role text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_role text := lower(trim(coalesce(next_role,'')));
  target_current_role text;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  if safe_role not in ('admin','fixtures','officials','results','discipline','registrations','finance','viewer') then raise exception 'Invalid league role' using errcode='22023'; end if;
  select membership.role into target_current_role from public.league_memberships membership
    where membership.league_id=target_league_id and membership.user_id=target_user_id and membership.status='active';
  if target_current_role is null then raise exception 'League member not found' using errcode='P0002'; end if;
  if target_current_role='owner' then raise exception 'The league owner role cannot be changed here' using errcode='42501'; end if;
  update public.league_memberships membership set role=safe_role,updated_at=now()
    where membership.league_id=target_league_id and membership.user_id=target_user_id;
  perform private.write_league_audit(target_league_id,'league.member_role_changed','member',target_user_id,jsonb_build_object('role',safe_role));
end;
$$;

create or replace function private.recalculate_league_finance_invoice(target_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  subtotal_value bigint;
  tax_value bigint;
  total_value bigint;
  paid_value bigint;
  credit_value bigint;
  current_status text;
begin
  select coalesce(sum(line.net_pence),0),coalesce(sum(line.tax_pence),0),coalesce(sum(line.total_pence),0)
    into subtotal_value,tax_value,total_value
  from public.league_finance_invoice_lines line where line.invoice_id=target_invoice_id;
  select coalesce(sum(payment.amount_pence),0) into paid_value
  from public.league_finance_payments payment where payment.invoice_id=target_invoice_id and payment.status<>'reversed';
  select coalesce(sum(credit.amount_pence),0) into credit_value
  from public.league_finance_credits credit where credit.invoice_id=target_invoice_id and credit.status<>'void';
  select invoice.status into current_status from public.league_finance_invoices invoice where invoice.id=target_invoice_id;
  update public.league_finance_invoices invoice set
    subtotal_pence=subtotal_value::integer,
    tax_pence=tax_value::integer,
    total_pence=total_value::integer,
    status=case
      when current_status in ('draft','void') then current_status
      when total_value>0 and paid_value+credit_value>=total_value then 'paid'
      when invoice.due_on is not null and invoice.due_on<current_date then 'overdue'
      when paid_value+credit_value>0 then 'part_paid'
      else 'issued'
    end,
    paid_at=case when total_value>0 and paid_value+credit_value>=total_value then coalesce(invoice.paid_at,now()) else null end,
    updated_at=now()
  where invoice.id=target_invoice_id;
end;
$$;

create or replace function private.next_league_invoice_number(target_league_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  year_label text := to_char(current_date,'YYYY');
  next_number integer;
begin
  select coalesce(max((regexp_match(invoice.invoice_number,'([0-9]+)$'))[1]::integer),0)+1 into next_number
  from public.league_finance_invoices invoice
  where invoice.league_id=target_league_id and invoice.invoice_number like 'FIN-'||year_label||'-%';
  return 'FIN-'||year_label||'-'||lpad(next_number::text,4,'0');
end;
$$;

create or replace function public.get_league_finance_data(target_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_role text := private.current_league_role(target_league_id,auth.uid());
begin
  if not public.can_view_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'access',jsonb_build_object('role',actor_role,'can_view',true,'can_manage',public.can_manage_league_finance(target_league_id),'is_club_portal',false),
    'charge_types',coalesce((select jsonb_agg(to_jsonb(charge) order by charge.name) from public.league_finance_charge_types charge where charge.league_id=target_league_id),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(to_jsonb(invoice_row) order by invoice_row.issue_on desc nulls last,invoice_row.created_at desc) from (
      select invoice.*,club.name as parent_club_name
      from public.league_finance_invoices invoice join public.league_parent_clubs club on club.id=invoice.parent_club_id
      where invoice.league_id=target_league_id
    ) invoice_row),'[]'::jsonb),
    'invoice_lines',coalesce((select jsonb_agg(to_jsonb(line) order by line.created_at) from public.league_finance_invoice_lines line where line.league_id=target_league_id),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(payment) order by payment.paid_on desc,payment.created_at desc) from public.league_finance_payments payment where payment.league_id=target_league_id),'[]'::jsonb),
    'credits',coalesce((select jsonb_agg(to_jsonb(credit) order by credit.credit_on desc,credit.created_at desc) from public.league_finance_credits credit where credit.league_id=target_league_id),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(to_jsonb(expense) order by expense.expense_on desc,expense.created_at desc) from public.league_finance_expenses expense where expense.league_id=target_league_id),'[]'::jsonb),
    'unbilled_fines',coalesce((select jsonb_agg(to_jsonb(fine_row) order by fine_row.payment_due_on nulls last) from (
      select sanction.id,sanction.case_id,discipline.case_reference,sanction.amount_pence,sanction.payment_due_on,
        discipline.respondent_club_id as parent_club_id,club.name as parent_club_name,sanction.subject_label
      from public.league_case_sanctions sanction
      join public.league_discipline_cases discipline on discipline.id=sanction.case_id
      left join public.league_parent_clubs club on club.id=discipline.respondent_club_id
      where sanction.league_id=target_league_id and sanction.sanction_type='fine' and sanction.amount_pence>0
        and sanction.status not in ('paid','revoked')
        and not exists(select 1 from public.league_finance_invoice_lines line where line.league_id=target_league_id and line.source_type='discipline_sanction' and line.source_id=sanction.id)
    ) fine_row),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_league_club_finance_data(target_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  actor_role text := private.current_league_role(target_league_id,actor_id);
begin
  if actor_id is null or club_id is null then raise exception 'Club finance access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'access',jsonb_build_object('role',actor_role,'can_view',true,'can_manage',false,'is_club_portal',true),
    'charge_types','[]'::jsonb,
    'invoices',coalesce((select jsonb_agg(to_jsonb(invoice_row) order by invoice_row.issue_on desc nulls last,invoice_row.created_at desc) from (
      select invoice.*,club.name as parent_club_name
      from public.league_finance_invoices invoice join public.league_parent_clubs club on club.id=invoice.parent_club_id
      where invoice.league_id=target_league_id and invoice.parent_club_id=club_id and invoice.status<>'draft'
    ) invoice_row),'[]'::jsonb),
    'invoice_lines',coalesce((select jsonb_agg(to_jsonb(line) order by line.created_at) from public.league_finance_invoice_lines line join public.league_finance_invoices invoice on invoice.id=line.invoice_id where line.league_id=target_league_id and invoice.parent_club_id=club_id and invoice.status<>'draft'),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(payment) order by payment.paid_on desc,payment.created_at desc) from public.league_finance_payments payment where payment.league_id=target_league_id and payment.parent_club_id=club_id),'[]'::jsonb),
    'credits',coalesce((select jsonb_agg(to_jsonb(credit) order by credit.credit_on desc,credit.created_at desc) from public.league_finance_credits credit where credit.league_id=target_league_id and credit.parent_club_id=club_id),'[]'::jsonb),
    'expenses','[]'::jsonb,
    'unbilled_fines','[]'::jsonb
  );
end;
$$;

create or replace function public.upsert_league_finance_charge_type(target_league_id uuid,charge_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  entity_id uuid;
  actor_id uuid := auth.uid();
  safe_code text := upper(trim(coalesce(charge_data->>'code','')));
  safe_name text := trim(coalesce(charge_data->>'name',''));
  safe_category text := lower(trim(coalesce(charge_data->>'category','other')));
begin
  if not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  if length(safe_name)<2 or length(safe_code)<2 then raise exception 'Charge name and code are required' using errcode='22023'; end if;
  if safe_category not in ('affiliation','team_entry','competition_entry','cup_entry','fine','official_fee','facility','administration','other') then raise exception 'Invalid charge category' using errcode='22023'; end if;
  if nullif(charge_data->>'id','') is null then
    insert into public.league_finance_charge_types(league_id,name,code,category,default_amount_pence,tax_rate,active,notes,created_by,updated_by)
      values(target_league_id,safe_name,safe_code,safe_category,greatest(0,coalesce((charge_data->>'default_amount_pence')::integer,0)),greatest(0,least(100,coalesce((charge_data->>'tax_rate')::numeric,0))),coalesce((charge_data->>'active')::boolean,true),nullif(trim(charge_data->>'notes'),''),actor_id,actor_id)
      returning id into entity_id;
  else
    entity_id := (charge_data->>'id')::uuid;
    update public.league_finance_charge_types charge set name=safe_name,code=safe_code,category=safe_category,
      default_amount_pence=greatest(0,coalesce((charge_data->>'default_amount_pence')::integer,0)),tax_rate=greatest(0,least(100,coalesce((charge_data->>'tax_rate')::numeric,0))),
      active=coalesce((charge_data->>'active')::boolean,true),notes=nullif(trim(charge_data->>'notes'),''),updated_by=actor_id,updated_at=now()
      where charge.id=entity_id and charge.league_id=target_league_id;
    if not found then raise exception 'Finance charge type not found' using errcode='P0002'; end if;
  end if;
  perform private.write_league_audit(target_league_id,'league.finance_charge_type_saved','finance_charge_type',entity_id,jsonb_build_object('code',safe_code));
  return entity_id;
end;
$$;

create or replace function public.upsert_league_finance_invoice(target_league_id uuid,invoice_data jsonb,line_rows jsonb default '[]'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  entity_id uuid;
  actor_id uuid := auth.uid();
  club_id uuid := nullif(invoice_data->>'parent_club_id','')::uuid;
  line jsonb;
  quantity_value numeric;
  unit_value integer;
  tax_rate_value numeric;
  net_value integer;
  tax_value integer;
  invoice_number_value text;
begin
  if not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  if club_id is null or not exists(select 1 from public.league_parent_clubs club where club.id=club_id and club.league_id=target_league_id) then raise exception 'Select a valid league club' using errcode='22023'; end if;
  invoice_number_value := nullif(trim(invoice_data->>'invoice_number'),'');
  if nullif(invoice_data->>'id','') is null then
    if invoice_number_value is null then invoice_number_value := private.next_league_invoice_number(target_league_id); end if;
    insert into public.league_finance_invoices(league_id,season_id,parent_club_id,invoice_number,status,issue_on,due_on,period_label,purchase_order_reference,notes,created_by,updated_by)
      values(target_league_id,nullif(invoice_data->>'season_id','')::uuid,club_id,invoice_number_value,'draft',nullif(invoice_data->>'issue_on','')::date,nullif(invoice_data->>'due_on','')::date,nullif(trim(invoice_data->>'period_label'),''),nullif(trim(invoice_data->>'purchase_order_reference'),''),nullif(trim(invoice_data->>'notes'),''),actor_id,actor_id)
      returning id into entity_id;
  else
    entity_id := (invoice_data->>'id')::uuid;
    update public.league_finance_invoices invoice set season_id=nullif(invoice_data->>'season_id','')::uuid,parent_club_id=club_id,
      invoice_number=coalesce(invoice_number_value,invoice.invoice_number),issue_on=nullif(invoice_data->>'issue_on','')::date,due_on=nullif(invoice_data->>'due_on','')::date,
      period_label=nullif(trim(invoice_data->>'period_label'),''),purchase_order_reference=nullif(trim(invoice_data->>'purchase_order_reference'),''),notes=nullif(trim(invoice_data->>'notes'),''),updated_by=actor_id,updated_at=now()
      where invoice.id=entity_id and invoice.league_id=target_league_id and invoice.status='draft';
    if not found then raise exception 'Only draft invoices can be edited' using errcode='42501'; end if;
    delete from public.league_finance_invoice_lines line_value where line_value.invoice_id=entity_id and line_value.league_id=target_league_id;
  end if;
  for line in select value from jsonb_array_elements(coalesce(line_rows,'[]'::jsonb)) loop
    if length(trim(coalesce(line->>'description','')))<2 then continue; end if;
    quantity_value := greatest(0.001,coalesce((line->>'quantity')::numeric,1));
    unit_value := coalesce((line->>'unit_amount_pence')::integer,0);
    tax_rate_value := greatest(0,least(100,coalesce((line->>'tax_rate')::numeric,0)));
    net_value := round(quantity_value*unit_value)::integer;
    tax_value := round(net_value*tax_rate_value/100)::integer;
    insert into public.league_finance_invoice_lines(league_id,invoice_id,charge_type_id,description,quantity,unit_amount_pence,tax_rate,net_pence,tax_pence,total_pence,source_type,source_id,source_label,created_by)
      values(target_league_id,entity_id,nullif(line->>'charge_type_id','')::uuid,trim(line->>'description'),quantity_value,unit_value,tax_rate_value,net_value,tax_value,net_value+tax_value,nullif(trim(line->>'source_type'),''),nullif(line->>'source_id','')::uuid,nullif(trim(line->>'source_label'),''),actor_id);
  end loop;
  perform private.recalculate_league_finance_invoice(entity_id);
  perform private.write_league_audit(target_league_id,'league.finance_invoice_saved','finance_invoice',entity_id,jsonb_build_object('invoice_number',invoice_number_value));
  return entity_id;
end;
$$;

create or replace function public.update_league_finance_invoice_status(target_league_id uuid,target_invoice_id uuid,next_status text,status_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_status text := lower(trim(coalesce(next_status,'')));
  actor_id uuid := auth.uid();
  invoice_total integer;
  existing_payment_count integer;
  existing_credit_count integer;
begin
  if not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  if safe_status not in ('draft','issued','void') then raise exception 'Invalid manual invoice status' using errcode='22023'; end if;
  select invoice.total_pence,
    (select count(*) from public.league_finance_payments payment where payment.invoice_id=invoice.id and payment.status<>'reversed'),
    (select count(*) from public.league_finance_credits credit where credit.invoice_id=invoice.id and credit.status<>'void')
    into invoice_total,existing_payment_count,existing_credit_count
  from public.league_finance_invoices invoice
  where invoice.id=target_invoice_id and invoice.league_id=target_league_id;
  if invoice_total is null then raise exception 'Invoice not found' using errcode='P0002'; end if;
  if safe_status='issued' and invoice_total<=0 then raise exception 'An invoice must contain a positive-value line before it can be issued' using errcode='22023'; end if;
  if safe_status='void' and (existing_payment_count>0 or existing_credit_count>0) then raise exception 'Reverse payments and credits before voiding this invoice' using errcode='22023'; end if;
  update public.league_finance_invoices invoice set status=safe_status,
    issue_on=case when safe_status='issued' then coalesce(invoice.issue_on,current_date) else invoice.issue_on end,
    due_on=case when safe_status='issued' then coalesce(invoice.due_on,current_date+30) else invoice.due_on end,
    issued_at=case when safe_status='issued' then coalesce(invoice.issued_at,now()) else invoice.issued_at end,
    voided_at=case when safe_status='void' then now() else null end,
    notes=case when trim(coalesce(status_note,''))<>'' then concat_ws(E'\n',invoice.notes,trim(status_note)) else invoice.notes end,
    updated_by=actor_id,updated_at=now()
    where invoice.id=target_invoice_id and invoice.league_id=target_league_id;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  perform private.recalculate_league_finance_invoice(target_invoice_id);
  perform private.write_league_audit(target_league_id,'league.finance_invoice_status_changed','finance_invoice',target_invoice_id,jsonb_build_object('status',safe_status));
end;
$$;

create or replace function public.record_league_finance_payment(target_league_id uuid,target_invoice_id uuid,payment_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  payment_id uuid;
  club_id uuid;
  outstanding_value integer;
  amount_value integer := greatest(1,coalesce((payment_data->>'amount_pence')::integer,0));
  method_value text := lower(trim(coalesce(payment_data->>'payment_method','bank_transfer')));
begin
  if not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  if method_value not in ('bank_transfer','card','cash','cheque','direct_debit','credit_offset','other') then raise exception 'Invalid payment method' using errcode='22023'; end if;
  select invoice.parent_club_id,
    greatest(invoice.total_pence
      - coalesce((select sum(payment.amount_pence) from public.league_finance_payments payment where payment.invoice_id=invoice.id and payment.status<>'reversed'),0)
      - coalesce((select sum(credit.amount_pence) from public.league_finance_credits credit where credit.invoice_id=invoice.id and credit.status<>'void'),0),0)
    into club_id,outstanding_value
  from public.league_finance_invoices invoice
  where invoice.id=target_invoice_id and invoice.league_id=target_league_id and invoice.status not in ('draft','void','paid');
  if club_id is null then raise exception 'An issued invoice with an outstanding balance is required' using errcode='P0002'; end if;
  if outstanding_value<=0 then raise exception 'This invoice has no outstanding balance' using errcode='22023'; end if;
  if amount_value>outstanding_value then raise exception 'Payment cannot exceed the outstanding invoice balance' using errcode='22023'; end if;
  insert into public.league_finance_payments(league_id,invoice_id,parent_club_id,amount_pence,paid_on,payment_method,reference,notes,status,created_by)
    values(target_league_id,target_invoice_id,club_id,amount_value,coalesce(nullif(payment_data->>'paid_on','')::date,current_date),method_value,nullif(trim(payment_data->>'reference'),''),nullif(trim(payment_data->>'notes'),''),'received',auth.uid())
    returning id into payment_id;
  perform private.recalculate_league_finance_invoice(target_invoice_id);
  perform private.write_league_audit(target_league_id,'league.finance_payment_recorded','finance_invoice',target_invoice_id,jsonb_build_object('payment_id',payment_id,'amount_pence',amount_value));
  return payment_id;
end;
$$;

create or replace function public.add_league_finance_credit(target_league_id uuid,target_invoice_id uuid,credit_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  credit_id uuid;
  club_id uuid;
  outstanding_value integer;
  amount_value integer := greatest(1,coalesce((credit_data->>'amount_pence')::integer,0));
begin
  if not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  select invoice.parent_club_id,
    greatest(invoice.total_pence
      - coalesce((select sum(payment.amount_pence) from public.league_finance_payments payment where payment.invoice_id=invoice.id and payment.status<>'reversed'),0)
      - coalesce((select sum(credit.amount_pence) from public.league_finance_credits credit where credit.invoice_id=invoice.id and credit.status<>'void'),0),0)
    into club_id,outstanding_value
  from public.league_finance_invoices invoice
  where invoice.id=target_invoice_id and invoice.league_id=target_league_id and invoice.status not in ('draft','void','paid');
  if club_id is null then raise exception 'An issued invoice with an outstanding balance is required' using errcode='P0002'; end if;
  if outstanding_value<=0 then raise exception 'This invoice has no outstanding balance' using errcode='22023'; end if;
  if amount_value>outstanding_value then raise exception 'Credit cannot exceed the outstanding invoice balance' using errcode='22023'; end if;
  if length(trim(coalesce(credit_data->>'reason','')))<2 then raise exception 'Credit reason is required' using errcode='22023'; end if;
  insert into public.league_finance_credits(league_id,invoice_id,parent_club_id,amount_pence,credit_on,reason,reference,status,created_by)
    values(target_league_id,target_invoice_id,club_id,amount_value,coalesce(nullif(credit_data->>'credit_on','')::date,current_date),trim(credit_data->>'reason'),nullif(trim(credit_data->>'reference'),''),'applied',auth.uid())
    returning id into credit_id;
  perform private.recalculate_league_finance_invoice(target_invoice_id);
  perform private.write_league_audit(target_league_id,'league.finance_credit_added','finance_invoice',target_invoice_id,jsonb_build_object('credit_id',credit_id,'amount_pence',amount_value));
  return credit_id;
end;
$$;

create or replace function public.invoice_league_discipline_fine(target_league_id uuid,target_sanction_id uuid,target_invoice_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  sanction_row record;
  invoice_id uuid := target_invoice_id;
  line_id uuid;
  actor_id uuid := auth.uid();
  fine_charge_type uuid;
begin
  if not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  select sanction.*,discipline.case_reference,discipline.respondent_club_id,club.name as club_name
    into sanction_row
  from public.league_case_sanctions sanction
  join public.league_discipline_cases discipline on discipline.id=sanction.case_id
  left join public.league_parent_clubs club on club.id=discipline.respondent_club_id
  where sanction.id=target_sanction_id and sanction.league_id=target_league_id and sanction.sanction_type='fine' and sanction.amount_pence>0;
  if sanction_row.id is null or sanction_row.respondent_club_id is null then raise exception 'Fine cannot be invoiced without a respondent club' using errcode='22023'; end if;
  if exists(select 1 from public.league_finance_invoice_lines line where line.league_id=target_league_id and line.source_type='discipline_sanction' and line.source_id=target_sanction_id) then raise exception 'This fine is already invoiced' using errcode='23505'; end if;
  select charge.id into fine_charge_type from public.league_finance_charge_types charge where charge.league_id=target_league_id and charge.category='fine' and charge.active order by charge.created_at limit 1;
  if invoice_id is null then
    insert into public.league_finance_invoices(league_id,parent_club_id,invoice_number,status,issue_on,due_on,period_label,notes,created_by,updated_by)
      values(target_league_id,sanction_row.respondent_club_id,private.next_league_invoice_number(target_league_id),'draft',current_date,coalesce(sanction_row.payment_due_on,current_date+30),'Discipline charges','Created from discipline case '||sanction_row.case_reference,actor_id,actor_id)
      returning id into invoice_id;
  else
    if not exists(select 1 from public.league_finance_invoices invoice where invoice.id=invoice_id and invoice.league_id=target_league_id and invoice.parent_club_id=sanction_row.respondent_club_id and invoice.status='draft') then raise exception 'Select a draft invoice for the same club' using errcode='22023'; end if;
  end if;
  insert into public.league_finance_invoice_lines(league_id,invoice_id,charge_type_id,description,quantity,unit_amount_pence,tax_rate,net_pence,tax_pence,total_pence,source_type,source_id,source_label,created_by)
    values(target_league_id,invoice_id,fine_charge_type,'Discipline fine '||sanction_row.case_reference||' — '||sanction_row.subject_label,1,sanction_row.amount_pence,0,sanction_row.amount_pence,0,sanction_row.amount_pence,'discipline_sanction',target_sanction_id,sanction_row.case_reference,actor_id)
    returning id into line_id;
  perform private.recalculate_league_finance_invoice(invoice_id);
  perform private.write_league_audit(target_league_id,'league.discipline_fine_invoiced','finance_invoice',invoice_id,jsonb_build_object('sanction_id',target_sanction_id,'line_id',line_id));
  return invoice_id;
end;
$$;

create or replace function public.upsert_league_finance_expense(target_league_id uuid,expense_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  entity_id uuid;
  actor_id uuid := auth.uid();
  safe_type text := lower(trim(coalesce(expense_data->>'expense_type','match_fee')));
  official_label text := trim(coalesce(expense_data->>'official_name',''));
begin
  if not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  if safe_type not in ('match_fee','assistant_fee','travel','mileage','parking','equipment','administration','other') then raise exception 'Invalid expense type' using errcode='22023'; end if;
  if length(official_label)<2 then raise exception 'Payee or official name is required' using errcode='22023'; end if;
  if nullif(expense_data->>'id','') is null then
    insert into public.league_finance_expenses(league_id,season_id,official_id,official_name,publication_fixture_id,fixture_label,expense_type,amount_pence,expense_on,status,payment_reference,notes,submitted_by,created_by,updated_by)
      values(target_league_id,nullif(expense_data->>'season_id','')::uuid,nullif(expense_data->>'official_id','')::uuid,official_label,nullif(expense_data->>'publication_fixture_id','')::uuid,nullif(trim(expense_data->>'fixture_label'),''),safe_type,greatest(1,coalesce((expense_data->>'amount_pence')::integer,0)),coalesce(nullif(expense_data->>'expense_on','')::date,current_date),coalesce(nullif(expense_data->>'status',''),'submitted'),nullif(trim(expense_data->>'payment_reference'),''),nullif(trim(expense_data->>'notes'),''),actor_id,actor_id,actor_id)
      returning id into entity_id;
  else
    entity_id := (expense_data->>'id')::uuid;
    update public.league_finance_expenses expense set season_id=nullif(expense_data->>'season_id','')::uuid,official_id=nullif(expense_data->>'official_id','')::uuid,official_name=official_label,
      publication_fixture_id=nullif(expense_data->>'publication_fixture_id','')::uuid,fixture_label=nullif(trim(expense_data->>'fixture_label'),''),expense_type=safe_type,
      amount_pence=greatest(1,coalesce((expense_data->>'amount_pence')::integer,0)),expense_on=coalesce(nullif(expense_data->>'expense_on','')::date,current_date),payment_reference=nullif(trim(expense_data->>'payment_reference'),''),notes=nullif(trim(expense_data->>'notes'),''),updated_by=actor_id,updated_at=now()
      where expense.id=entity_id and expense.league_id=target_league_id and expense.status in ('draft','submitted');
    if not found then raise exception 'Only draft or submitted expenses can be edited' using errcode='42501'; end if;
  end if;
  perform private.write_league_audit(target_league_id,'league.finance_expense_saved','finance_expense',entity_id,jsonb_build_object('expense_type',safe_type));
  return entity_id;
end;
$$;

create or replace function public.update_league_finance_expense_status(target_league_id uuid,target_expense_id uuid,next_status text,payment_reference_value text default '')
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_status text := lower(trim(coalesce(next_status,'')));
  actor_id uuid := auth.uid();
begin
  if not public.can_manage_league_finance(target_league_id) then raise exception 'League finance access required' using errcode='42501'; end if;
  if safe_status not in ('submitted','approved','rejected','paid','void') then raise exception 'Invalid expense status' using errcode='22023'; end if;
  update public.league_finance_expenses expense set status=safe_status,
    approved_by=case when safe_status='approved' then actor_id else expense.approved_by end,
    approved_at=case when safe_status='approved' then now() else expense.approved_at end,
    paid_by=case when safe_status='paid' then actor_id else expense.paid_by end,
    paid_at=case when safe_status='paid' then now() else expense.paid_at end,
    payment_reference=coalesce(nullif(trim(payment_reference_value),''),expense.payment_reference),updated_by=actor_id,updated_at=now()
    where expense.id=target_expense_id and expense.league_id=target_league_id;
  if not found then raise exception 'Expense not found' using errcode='P0002'; end if;
  perform private.write_league_audit(target_league_id,'league.finance_expense_status_changed','finance_expense',target_expense_id,jsonb_build_object('status',safe_status));
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['league_finance_charge_types','league_finance_invoices','league_finance_expenses'] loop
    if not exists(select 1 from pg_trigger where tgname=table_name||'_touch_updated_at') then
      execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',table_name||'_touch_updated_at',table_name);
    end if;
  end loop;
end;
$$;

revoke all on function public.can_view_league_finance(uuid) from public,anon;
revoke all on function public.can_manage_league_finance(uuid) from public,anon;
revoke all on function public.get_league_finance_data(uuid) from public,anon;
revoke all on function public.get_league_club_finance_data(uuid) from public,anon;
revoke all on function public.upsert_league_finance_charge_type(uuid,jsonb) from public,anon;
revoke all on function public.upsert_league_finance_invoice(uuid,jsonb,jsonb) from public,anon;
revoke all on function public.update_league_finance_invoice_status(uuid,uuid,text,text) from public,anon;
revoke all on function public.record_league_finance_payment(uuid,uuid,jsonb) from public,anon;
revoke all on function public.add_league_finance_credit(uuid,uuid,jsonb) from public,anon;
revoke all on function public.invoice_league_discipline_fine(uuid,uuid,uuid) from public,anon;
revoke all on function public.upsert_league_finance_expense(uuid,jsonb) from public,anon;
revoke all on function public.update_league_finance_expense_status(uuid,uuid,text,text) from public,anon;

grant execute on function public.can_view_league_finance(uuid) to authenticated;
grant execute on function public.can_manage_league_finance(uuid) to authenticated;
grant execute on function public.get_league_finance_data(uuid) to authenticated;
grant execute on function public.get_league_club_finance_data(uuid) to authenticated;
grant execute on function public.upsert_league_finance_charge_type(uuid,jsonb) to authenticated;
grant execute on function public.upsert_league_finance_invoice(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.update_league_finance_invoice_status(uuid,uuid,text,text) to authenticated;
grant execute on function public.record_league_finance_payment(uuid,uuid,jsonb) to authenticated;
grant execute on function public.add_league_finance_credit(uuid,uuid,jsonb) to authenticated;
grant execute on function public.invoice_league_discipline_fine(uuid,uuid,uuid) to authenticated;
grant execute on function public.upsert_league_finance_expense(uuid,jsonb) to authenticated;
grant execute on function public.update_league_finance_expense_status(uuid,uuid,text,text) to authenticated;

commit;
