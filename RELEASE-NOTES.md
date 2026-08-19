# Daxora Ground Control v3.10.42 - Dashboard and Club Command Simplification

## Purpose

Mission Control remains the primary operational home. The former Organisation Command surface is now presented consistently as Club Command: an Elite leadership, governance and cross-site view rather than a competing dashboard.

## Changes

- Adds one shared workspace-page access rule combining subscription entitlement with the effective v3.10.41 multi-role permission object.
- Shows Club Command only to entitled users with effective audit/governance permission.
- Excludes read-only support sessions and operational-only roles from Club Command navigation and rendering.
- Renames the user-facing Organisation Command navigation and page surface to Club Command while retaining stable internal route and entitlement identifiers.
- Adds one conditional Mission Control handoff to Club Command instead of duplicating executive cards.
- Updates existing Elite and TeamFeePay regression expectations and adds focused v3.10.42 coverage.

## Deliberately unchanged

- Full-Time FA integration remains a separate release.
- No database migration is included.
- No subscription catalogue, API, Vercel or release-engine change is included.
