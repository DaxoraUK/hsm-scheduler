create or replace function public.prepare_club_invitation_delivery(target_club_id uuid, target_invitation_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' set row_security = off as $$
declare invitation public.club_invitations%rowtype; club_name text;
begin
  if auth.uid() is null or not public.can_manage_club(target_club_id) then raise exception 'Club administrator access required' using errcode='42501'; end if;
  select row_data.* into invitation from public.club_invitations row_data where row_data.id=target_invitation_id and row_data.club_id=target_club_id and row_data.status='pending' and row_data.expires_at>now();
  if invitation.id is null then raise exception 'Active club invitation not found' using errcode='P0002'; end if;
  select name into club_name from public.clubs where id=target_club_id and status='active';
  return jsonb_build_object('invitation_id',invitation.id,'email',invitation.email,'role',invitation.role,'club_name',club_name,'expires_at',invitation.expires_at);
end; $$;
revoke all on function public.prepare_club_invitation_delivery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_club_invitation_delivery(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
