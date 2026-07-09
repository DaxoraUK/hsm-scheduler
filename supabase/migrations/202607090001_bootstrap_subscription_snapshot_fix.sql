-- Daxora Ground Control: allow the one-time workspace bootstrap to see the
-- subscription row created earlier in the same RPC transaction.
--
-- The subscription/entitlement helper functions were declared STABLE. During
-- bootstrap, PostgreSQL could therefore evaluate them against the snapshot
-- from the start of the RPC and miss the Core trial inserted by the club
-- creation trigger. The write guard then incorrectly reported the new club as
-- read-only and rolled the whole workspace claim back.

begin;

alter function private.club_subscription_access_state(uuid) volatile;
alter function private.club_subscription_allows_write(uuid) volatile;
alter function private.club_has_entitlement(uuid, text) volatile;
alter function private.club_subscription_limit(uuid, text, integer) volatile;

commit;
