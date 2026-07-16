# Ground Control v3.10.2.9 — Coach Hub Team Contact Authority Repair

## Fault confirmed

`list_team_contacts_v2` deliberately limits `additional_contacts` to assignments whose `source_slot` is `manual` or `directory`. Existing primary Coach Hub assignments created through the original `coach` or `assistant` slots therefore did not reach Settings → Teams.

The previous v3.10.2.8 installer also launched npm from the extracted download folder, and its repository change referenced the new merge helper without importing it.

## Repair

- Team contacts now merge the authoritative Coach Hub people and assignment workspace after the protected contacts RPC loads.
- Active `coach`, `assistant`, `manual`, and `directory` assignments are all recognised.
- The primary Coach Hub assignment overrides stale primary details stored in the older Team form.
- Assistant fields maintained in Settings → Teams remain available.
- `supabase.js` explicitly imports the contact merge helper.
- The installer runs npm with both an explicit project working directory and `--prefix C:\Development\hsm-scheduler`.

No Supabase migration is required.
