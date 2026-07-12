-- Daxora Ground Control: dedicated subscription and access launch-acceptance gate.
-- Requires the existing pilot/launch evidence tables and functions.

begin;

insert into public.platform_launch_gates (
  code,
  title,
  category,
  owner_label,
  metadata
)
values (
  'subscription_acceptance',
  'Core, Pro, Elite and restricted-access acceptance completed on staging',
  'product',
  'Daxora',
  jsonb_build_object(
    'required_scenarios', jsonb_build_array('core', 'pro', 'elite', 'read_only', 'suspended', 'invalid_plan'),
    'automatic_checks_required', true,
    'real_account_evidence_required', true
  )
)
on conflict (code) do update
set title = excluded.title,
    category = excluded.category,
    owner_label = excluded.owner_label,
    metadata = public.platform_launch_gates.metadata || excluded.metadata,
    updated_at = now();

commit;
