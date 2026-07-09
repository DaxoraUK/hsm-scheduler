-- Daxora Ground Control
-- Fix first-workspace bootstrap failing with:
--   "The club subscription is read only"
--
-- PostgreSQL runs triggers of the same timing/event in trigger-name order.
-- The onboarding trigger was named before the subscription trigger, so a new
-- club attempted to insert its onboarding row before its default subscription
-- existed. The subscription write guard therefore rejected the onboarding
-- insert and rolled back the entire workspace claim.
--
-- Ensure the default subscription trigger always runs before onboarding.

begin;

-- Remove both the original name and this migration's idempotent replacement.
drop trigger if exists ground_control_create_club_subscription on public.clubs;
drop trigger if exists ground_control_00_create_club_subscription on public.clubs;

create trigger ground_control_00_create_club_subscription
after insert on public.clubs
for each row execute function private.create_default_club_subscription();

commit;
