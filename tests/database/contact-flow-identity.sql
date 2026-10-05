-- Inject actual routine bodies at the marker, redirected to pg_temp. Only
-- external auth boundaries are substituted; all contact validation is real.
-- No persistent record or delivery is created.
begin;
do $$ declare table_name text; begin
  foreach table_name in array array['team_config','team_contacts','coach_hub_people','coach_hub_team_assignments'] loop
    execute format('create temporary table %I (like public.%I including defaults including constraints including indexes)',table_name,table_name);
  end loop;
end $$;
create temporary table contact_checks(name text,passed boolean);
-- ROUTINE_BODIES
insert into pg_temp.team_config(id,club_id,data) values
  ('team-config','00000000-0000-0000-0000-000000000001','{"name":"U14 Spartans"}');
insert into pg_temp.team_contacts(club_id,team_key,team_name,privacy_notice_provided_at) values
  ('00000000-0000-0000-0000-000000000001','u14-spartans','U14 Spartans',now());
insert into pg_temp.coach_hub_people(id,club_id,identity_key,display_name,email,status) values
  ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','email:coach@example.org','Coach','coach@example.org','active');
insert into pg_temp.coach_hub_team_assignments(id,club_id,person_id,team_key,team_name,staff_role) values
  ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','U14 Spartans','U14 Spartans','manager');
do $$ declare
  club uuid:='00000000-0000-0000-0000-000000000001';
  rows jsonb; recipient jsonb; legacy_recipient jsonb; rejected boolean; valid boolean;
begin
  rows:=pg_temp.list_team_contacts_v2(club);
  insert into contact_checks values('one canonical team contact row',jsonb_array_length(rows)=1);
  insert into contact_checks values('active assigned coach joins canonical team',exists(select 1 from jsonb_array_elements(rows) r where r->>'team_key'='u14-spartans' and jsonb_array_length(r->'additional_contacts')=1));
  recipient:=jsonb_build_object('teamKey','u14-spartans','assignmentId','00000000-0000-0000-0000-000000000004','personId','00000000-0000-0000-0000-000000000003','channel','email','destination','coach@example.org');
  valid:=false;
  begin valid:=pg_temp.validate_communication_delivery_recipients(club,jsonb_build_array(recipient)); exception when sqlstate '22023' then null; end;
  insert into contact_checks values('saved active directory recipient authorised',valid);
  update pg_temp.coach_hub_people set preferred_channel='in_app';
  update pg_temp.team_contacts set coach_email='coach@example.org';
  legacy_recipient:=recipient-'personId'-'assignmentId';
  rejected:=false;
  begin perform pg_temp.validate_communication_delivery_recipients(club,jsonb_build_array(legacy_recipient)); exception when sqlstate '22023' then rejected:=true; end;
  insert into contact_checks values('omitting IDs cannot bypass Coach Hub-only preference',rejected);
  rejected:=false;
  begin perform pg_temp.validate_communication_delivery_recipients(club,jsonb_build_array(recipient)); exception when sqlstate '22023' then rejected:=true; end;
  insert into contact_checks values('Coach Hub-only preference enforced',rejected);
  update pg_temp.coach_hub_people set preferred_channel='email';
  rejected:=false;
  begin perform pg_temp.validate_communication_delivery_recipients(club,jsonb_build_array(recipient||'{"destination":"intruder@example.org"}')); exception when sqlstate '22023' then rejected:=true; end;
  insert into contact_checks values('altered destination rejected',rejected);
  update pg_temp.team_contacts set receive_matchday_messages=false;
  rejected:=false;
  begin perform pg_temp.validate_communication_delivery_recipients(club,jsonb_build_array(recipient)); exception when sqlstate '22023' then rejected:=true; end;
  insert into contact_checks values('team opt-out enforced',rejected);
  update pg_temp.team_contacts set receive_matchday_messages=true,privacy_notice_provided_at=null;
  rejected:=false;
  begin perform pg_temp.validate_communication_delivery_recipients(club,jsonb_build_array(recipient)); exception when sqlstate '22023' then rejected:=true; end;
  insert into contact_checks values('privacy requirement enforced',rejected);
  update pg_temp.team_contacts set privacy_notice_provided_at=now();
  update pg_temp.coach_hub_team_assignments set status='inactive';
  rejected:=false;
  begin perform pg_temp.validate_communication_delivery_recipients(club,jsonb_build_array(legacy_recipient)); exception when sqlstate '22023' then rejected:=true; end;
  insert into contact_checks values('omitting IDs cannot bypass inactive directory assignment',rejected);
  rows:=pg_temp.list_team_contacts_v2(club);
  insert into contact_checks values('inactive assignment excluded',jsonb_array_length(rows->0->'additional_contacts')=0);
  rejected:=false;
  begin perform pg_temp.validate_communication_delivery_recipients(club,jsonb_build_array(recipient)); exception when sqlstate '22023' then rejected:=true; end;
  insert into contact_checks values('inactive assignment cannot receive',rejected);
  update pg_temp.coach_hub_team_assignments set status='active';
  update pg_temp.coach_hub_people set status='inactive';
  rejected:=false;
  begin perform pg_temp.validate_communication_delivery_recipients(club,jsonb_build_array(recipient)); exception when sqlstate '22023' then rejected:=true; end;
  insert into contact_checks values('inactive person cannot receive',rejected);
  update pg_temp.coach_hub_people set status='active',club_id='00000000-0000-0000-0000-000000000009';
  rejected:=false;
  begin perform pg_temp.validate_communication_delivery_recipients(club,jsonb_build_array(recipient)); exception when sqlstate '22023' then rejected:=true; end;
  insert into contact_checks values('cross-club person cannot receive',rejected);
  update pg_temp.coach_hub_people set club_id=club;
  update pg_temp.coach_hub_team_assignments set team_key='different-id';
  rows:=pg_temp.list_team_contacts_v2(club);
  insert into contact_checks values('opaque ID cannot join another same-name team',not exists(select 1 from jsonb_array_elements(rows) r where r->>'team_key'='u14-spartans' and jsonb_array_length(r->'additional_contacts')>0));
  rejected:=false;
  begin perform pg_temp.validate_communication_delivery_recipients(club,jsonb_build_array(recipient)); exception when sqlstate '22023' then rejected:=true; end;
  insert into contact_checks values('different team assignment cannot receive',rejected);
end $$;
select * from contact_checks;
rollback;
