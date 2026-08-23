-- Club-wide, auditable feedback for explainable operational intelligence.

create table if not exists public.intelligence_feedback (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  day_scope text not null,
  issue_key text not null,
  issue_title text not null,
  response text not null check (response in ('useful','dismissed')),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, actor_id, day_scope, issue_key)
);

alter table public.intelligence_feedback enable row level security;

drop policy if exists intelligence_feedback_member_read on public.intelligence_feedback;
create policy intelligence_feedback_member_read on public.intelligence_feedback
for select to authenticated using (public.is_club_member(club_id));

revoke all on table public.intelligence_feedback from public, anon, authenticated;

create or replace function public.list_intelligence_feedback(target_club_id uuid, target_day_scope text)
returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
begin
  if not public.is_club_member(target_club_id) then raise exception 'Club access required' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'issue_key', grouped.issue_key,
      'useful_count', grouped.useful_count,
      'dismissed_count', grouped.dismissed_count,
      'my_response', grouped.my_response,
      'updated_at', grouped.updated_at
    ) order by grouped.updated_at desc)
    from (
      select feedback.issue_key,
        count(*) filter (where feedback.response='useful')::integer useful_count,
        count(*) filter (where feedback.response='dismissed')::integer dismissed_count,
        max(feedback.response) filter (where feedback.actor_id=auth.uid()) my_response,
        max(feedback.updated_at) updated_at
      from public.intelligence_feedback feedback
      where feedback.club_id=target_club_id and feedback.day_scope=left(trim(coalesce(target_day_scope,'')),80)
      group by feedback.issue_key
    ) grouped
  ), '[]'::jsonb);
end; $$;

create or replace function public.record_intelligence_feedback(
  target_club_id uuid, target_day_scope text, target_issue_key text,
  target_issue_title text, target_response text, target_context jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
declare actor_id uuid := auth.uid(); saved public.intelligence_feedback%rowtype;
begin
  if actor_id is null or not public.can_publish_club_matchweek(target_club_id) then raise exception 'Operational access required' using errcode = '42501'; end if;
  if lower(trim(coalesce(target_response,''))) not in ('useful','dismissed') then raise exception 'Unsupported feedback response' using errcode = '22023'; end if;
  if nullif(trim(coalesce(target_day_scope,'')),'') is null or nullif(trim(coalesce(target_issue_key,'')),'') is null then raise exception 'Feedback scope and issue are required' using errcode = '22023'; end if;
  insert into public.intelligence_feedback(club_id,actor_id,day_scope,issue_key,issue_title,response,context)
  values(target_club_id,actor_id,left(trim(target_day_scope),80),left(trim(target_issue_key),180),left(trim(coalesce(target_issue_title,'Recommendation')),240),lower(trim(target_response)),coalesce(target_context,'{}'::jsonb))
  on conflict(club_id,actor_id,day_scope,issue_key) do update set issue_title=excluded.issue_title,response=excluded.response,context=excluded.context,updated_at=now()
  returning * into saved;
  perform public.record_audit_event(target_club_id,'intelligence.feedback.'||saved.response,'intelligence_recommendation',saved.issue_key,jsonb_build_object('day_scope',saved.day_scope,'title',saved.issue_title));
  return jsonb_build_object('issue_key',saved.issue_key,'response',saved.response,'updated_at',saved.updated_at);
end; $$;

create or replace function public.clear_intelligence_feedback(target_club_id uuid, target_day_scope text)
returns integer language plpgsql security definer set search_path = '' set row_security = off as $$
declare current_actor_id uuid := auth.uid(); removed integer;
begin
  if current_actor_id is null or not public.can_publish_club_matchweek(target_club_id) then raise exception 'Operational access required' using errcode = '42501'; end if;
  delete from public.intelligence_feedback feedback where feedback.club_id=target_club_id and feedback.actor_id=current_actor_id and feedback.day_scope=left(trim(coalesce(target_day_scope,'')),80);
  get diagnostics removed = row_count;
  if removed > 0 then perform public.record_audit_event(target_club_id,'intelligence.feedback.cleared','intelligence_recommendation',current_actor_id::text,jsonb_build_object('day_scope',target_day_scope,'removed',removed)); end if;
  return removed;
end; $$;

revoke all on function public.list_intelligence_feedback(uuid,text) from public, anon;
revoke all on function public.record_intelligence_feedback(uuid,text,text,text,text,jsonb) from public, anon;
revoke all on function public.clear_intelligence_feedback(uuid,text) from public, anon;
grant execute on function public.list_intelligence_feedback(uuid,text) to authenticated;
grant execute on function public.record_intelligence_feedback(uuid,text,text,text,text,jsonb) to authenticated;
grant execute on function public.clear_intelligence_feedback(uuid,text) to authenticated;
