-- League Operations v3.5.1
-- Canonical competition hierarchy for divisions created in arbitrary CSV order.

create or replace function private.league_division_name_rank(target_name text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalised text := lower(trim(coalesce(target_name, '')));
  tier_token text;
  tier_number integer;
begin
  if normalised = '' then return 100000; end if;
  if normalised ~ '\m(premier|premiership|prem)\M' then return 0; end if;
  if normalised ~ '\mchampionship\M' then return 50; end if;

  tier_token := (regexp_match(normalised, '\m(?:division|div|tier|section)[[:space:]]+([a-z0-9]+)\M'))[1];
  if tier_token is not null then
    if tier_token ~ '^[0-9]+$' then
      tier_number := tier_token::integer;
    else
      tier_number := case tier_token
        when 'one' then 1 when 'first' then 1
        when 'two' then 2 when 'second' then 2
        when 'three' then 3 when 'third' then 3
        when 'four' then 4 when 'fourth' then 4
        when 'five' then 5 when 'fifth' then 5
        when 'six' then 6 when 'sixth' then 6
        when 'seven' then 7 when 'seventh' then 7
        when 'eight' then 8 when 'eighth' then 8
        when 'nine' then 9 when 'ninth' then 9
        when 'ten' then 10 when 'tenth' then 10
        when 'eleven' then 11 when 'eleventh' then 11
        when 'twelve' then 12 when 'twelfth' then 12
        when 'thirteen' then 13 when 'thirteenth' then 13
        when 'fourteen' then 14 when 'fourteenth' then 14
        when 'fifteen' then 15 when 'fifteenth' then 15
        when 'sixteen' then 16 when 'sixteenth' then 16
        when 'seventeen' then 17 when 'seventeenth' then 17
        when 'eighteen' then 18 when 'eighteenth' then 18
        when 'nineteen' then 19 when 'nineteenth' then 19
        when 'twenty' then 20 when 'twentieth' then 20
        else null
      end;
    end if;
    if tier_number is not null then return 100 + tier_number; end if;
    return 500;
  end if;

  if normalised ~ '\m(reserve|reserves)\M' then return 700; end if;
  if normalised ~ '\m(development|academy)\M' then return 750; end if;
  if normalised ~ '\m(veteran|veterans|vets)\M' then return 800; end if;
  return 1000;
end;
$$;

create or replace function private.resequence_league_divisions_internal(
  target_league_id uuid,
  target_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  affected integer := 0;
begin
  with ordered as (
    select
      division.id,
      row_number() over (
        partition by division.season_id
        order by
          private.league_division_name_rank(division.name),
          division.sort_order,
          lower(division.name),
          division.id
      ) - 1 as next_sort_order
    from public.league_divisions division
    where division.league_id = target_league_id
      and (target_season_id is null or division.season_id = target_season_id)
  )
  update public.league_divisions division
  set sort_order = ordered.next_sort_order
  from ordered
  where division.id = ordered.id
    and division.sort_order is distinct from ordered.next_sort_order;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.resequence_league_divisions(
  target_league_id uuid,
  target_season_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  affected integer;
begin
  if not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;

  if target_season_id is not null then
    perform private.assert_league_reference(target_league_id, 'season', target_season_id);
  end if;

  affected := private.resequence_league_divisions_internal(target_league_id, target_season_id);
  perform private.write_league_audit(
    target_league_id,
    'league.divisions_resequenced',
    'division',
    null,
    jsonb_build_object('season_id', target_season_id, 'rows_updated', affected)
  );

  return jsonb_build_object('rows_updated', affected);
end;
$$;

-- Repair existing imported structures. The helper keeps unrecognised competitions in
-- their existing relative order while placing Premier/Championship/numbered divisions
-- in the expected sporting hierarchy.
do $$
declare
  league_row record;
begin
  for league_row in
    select distinct league_id, season_id
    from public.league_divisions
  loop
    perform private.resequence_league_divisions_internal(league_row.league_id, league_row.season_id);
  end loop;
end;
$$;

revoke all on function public.resequence_league_divisions(uuid, uuid) from public, anon;
grant execute on function public.resequence_league_divisions(uuid, uuid) to authenticated;
