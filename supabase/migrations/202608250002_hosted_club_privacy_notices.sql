-- Public, read-only club privacy notices. Only deliberately published privacy
-- fields are returned; no contacts, memberships or operational records leave RLS.
begin;

create or replace function public.get_public_club_privacy_notice(requested_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select jsonb_build_object(
    'club_name', club.name,
    'club_slug', club.slug,
    'controller_name', settings.controller_name,
    'privacy_contact_email', settings.privacy_contact_email,
    'lawful_basis', settings.lawful_basis,
    'purpose', settings.purpose,
    'retention_days', settings.retention_days,
    'dpia_status', settings.dpia_status,
    'last_reviewed_at', settings.last_reviewed_at
  )
  from public.clubs club
  join public.communication_privacy_settings settings on settings.club_id = club.id
  where club.slug = lower(trim(requested_slug))
    and club.status = 'active'
    and length(trim(settings.controller_name)) > 1
    and length(trim(settings.privacy_contact_email)) > 3
    and length(trim(settings.purpose)) >= 20
    and settings.lawful_basis in ('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests')
    and settings.dpia_status <> 'not_assessed'
  limit 1;
$$;

revoke all on function public.get_public_club_privacy_notice(text) from public, authenticated, anon;
grant execute on function public.get_public_club_privacy_notice(text) to anon, authenticated;

commit;
