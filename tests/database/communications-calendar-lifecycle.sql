-- Run against a staging database with the real routine bodies substituted at
-- the marker. The runner redirects table references to isolated temporary
-- tables, substitutes only external authorization/audit boundaries, and rolls
-- everything back. No actual fixture, calendar, contact or message is changed.
begin;
do $$ declare table_name text; begin
  foreach table_name in array array['annual_planner_bookings','annual_planner_blackouts','annual_planner_closure_impacts','coach_hub_team_assignments','coach_hub_calendar_feeds','coach_hub_messages','pitch_closures','pitches','clubs'] loop
    execute format('create temporary table %I (like public.%I including defaults including constraints including indexes)', table_name, table_name);
  end loop;
end $$;
alter table pg_temp.annual_planner_bookings add column if not exists fixture_venue_role text;
alter table pg_temp.annual_planner_bookings add column if not exists fixture_time_known boolean not null default true;
alter table pg_temp.annual_planner_bookings alter column created_by set default '00000000-0000-0000-0000-000000000002'::uuid;
alter table pg_temp.annual_planner_bookings alter column updated_by set default '00000000-0000-0000-0000-000000000002'::uuid;
create temporary table calendar_checks(name text, passed boolean, detail jsonb);
-- ROUTINE_BODIES
create trigger test_calendar_notifications after insert or update on pg_temp.annual_planner_bookings
  for each row execute function pg_temp.notify_coach_hub_booking_change();
insert into pg_temp.coach_hub_team_assignments(club_id, person_id, team_key, team_name)
values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','cobras','Cobras');
insert into pg_temp.coach_hub_calendar_feeds(club_id,person_id,token_hash)
values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',encode(extensions.digest('regression-token','sha256'),'hex'));
do $$
declare
  club uuid := '00000000-0000-0000-0000-000000000001';
  fixtures jsonb := '[
    {"sourceId":"home","title":"Home match","teamKey":"cobras","teamName":"Cobras","status":"confirmed","fixtureVenueRole":"home","pitchId":"P1","startAt":"2026-10-10T09:00:00Z","endAt":"2026-10-10T10:00:00Z"},
    {"sourceId":"away","title":"Away match","teamKey":"cobras","teamName":"Cobras","status":"confirmed","fixtureVenueRole":"away","pitchId":"P1","startAt":"2026-10-10T11:00:00Z","endAt":"2026-10-10T12:00:00Z"},
    {"sourceId":"postponed","title":"Postponed match","teamKey":"cobras","teamName":"Cobras","status":"postponed","fixtureVenueRole":"home","pitchId":"P1","startAt":"2026-10-10T13:00:00Z","endAt":"2026-10-10T14:00:00Z"},
    {"sourceId":"cancelled","title":"Cancelled match","teamKey":"cobras","teamName":"Cobras","status":"cancelled","fixtureVenueRole":"away","pitchId":"P1","fixtureTimeKnown":false,"startAt":"2026-10-10T15:00:00Z","endAt":"2026-10-10T16:00:00Z"},
    {"sourceId":"draft","title":"Unallocated match","teamKey":"cobras","teamName":"Cobras","status":"provisional","fixtureVenueRole":"home","startAt":"2026-10-10T17:00:00Z","endAt":"2026-10-10T18:00:00Z"}
  ]';
  payload jsonb;
  first_id uuid;
  rejected boolean := false;
  iteration integer;
begin
  perform pg_temp.sync_matchday_calendar(club,'saturday','2026-10-10',fixtures);
  select id into first_id from pg_temp.annual_planner_bookings where source_id='home';
  for iteration in 1..5 loop perform pg_temp.sync_matchday_calendar(club,'saturday','2026-10-10',fixtures); end loop;
  insert into calendar_checks select 'idempotent upsert and stable calendar UID',count(*)=5 and bool_and(case when source_id='home' then id=first_id else true end),jsonb_build_object('rows',count(*)) from pg_temp.annual_planner_bookings;
  insert into calendar_checks select 'inactive lifecycle retained',count(*)=2,jsonb_build_object('inactive_rows',count(*)) from pg_temp.annual_planner_bookings where source_id in('postponed','cancelled') and status in('postponed','cancelled');
  insert into calendar_checks select 'Away and inactive reserve no club pitch',count(*)=3,jsonb_build_object('unallocated_rows',count(*)) from pg_temp.annual_planner_bookings where source_id in('away','postponed','cancelled') and pitch_id is null;
  insert into calendar_checks select 'Away annotation and unknown KO persist',fixture_venue_role='away' and fixture_time_known=false,to_jsonb(booking) from pg_temp.annual_planner_bookings booking where source_id='cancelled';
  payload := pg_temp.get_coach_hub_calendar_context(club,'2026-10-01','2026-10-31');
  insert into calendar_checks values('signed-in calendar retains four published/lifecycle rows but hides draft',jsonb_array_length(payload->'bookings')=4,jsonb_build_object('rows',jsonb_array_length(payload->'bookings')));
  payload := pg_temp.get_coach_hub_calendar_by_token('regression-token');
  insert into calendar_checks values('subscribed calendar matches signed-in publication rules',jsonb_array_length(payload->'bookings')=4,jsonb_build_object('rows',jsonb_array_length(payload->'bookings')));
  insert into calendar_checks select 'Away generates no coach message or acknowledgement',count(*)=0,jsonb_build_object('messages',count(*)) from pg_temp.coach_hub_messages message join pg_temp.annual_planner_bookings booking on message.related_id=booking.id::text where booking.source_id in ('away','cancelled');
  begin
    perform pg_temp.sync_matchday_calendar(club,'saturday','2026-10-10',jsonb_build_array(fixtures->0,fixtures->0));
  exception when sqlstate '22023' then rejected:=true; end;
  insert into calendar_checks select 'duplicate canonical identities abort before deleting anything',rejected and count(*)=5,jsonb_build_object('rejected',rejected,'rows_remaining',count(*)) from pg_temp.annual_planner_bookings;
end $$;
-- Display names must not override explicit team access boundaries.
insert into pg_temp.coach_hub_team_assignments(club_id, person_id, team_key, team_name)
values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','other-cobras','Cobras');
insert into pg_temp.annual_planner_bookings(club_id,source_type,source_id,title,booking_type,status,team_key,team_name,start_at,end_at)
values ('00000000-0000-0000-0000-000000000001','matchday_saturday','different-team','Different explicit team','match','confirmed','other-cobras','Cobras','2026-10-10T19:00:00Z','2026-10-10T20:00:00Z'),
('00000000-0000-0000-0000-000000000001','matchday_saturday','ambiguous-legacy','Ambiguous legacy team','match','confirmed',null,'Cobras','2026-10-10T19:00:00Z','2026-10-10T20:00:00Z');
do $$ declare payload jsonb; begin
  payload := pg_temp.get_coach_hub_calendar_by_token('regression-token');
  insert into calendar_checks values('feed rejects explicit mismatched keys and ambiguous legacy names',
    not exists(select 1 from jsonb_array_elements(payload->'bookings') row_data where row_data->>'source_id' in ('different-team','ambiguous-legacy')),null);
  payload := pg_temp.get_coach_hub_calendar_context('00000000-0000-0000-0000-000000000001','2026-10-01','2026-10-31');
  insert into calendar_checks values('signed-in calendar rejects explicit mismatched keys and ambiguous legacy names',
    not exists(select 1 from jsonb_array_elements(payload->'bookings') row_data where row_data->>'source_id' in ('different-team','ambiguous-legacy')),null);
  insert into calendar_checks select 'messages respect explicit team identity',count(*)=0,null from pg_temp.coach_hub_messages message join pg_temp.annual_planner_bookings booking on message.related_id=booking.id::text where booking.source_id in ('different-team','ambiguous-legacy') and message.person_id='00000000-0000-0000-0000-000000000002';
end $$;
select name,passed,detail from calendar_checks order by name;
rollback;
