# Ground Control v3.10.5.3 — Request Refresh and Multi-Submit Repair

## Purpose

This maintenance release corrects two workflow defects found during Shared Calendar and Coach Request pilot testing.

## Repairs

- Annual Planner request polling now refreshes only the request queue instead of replacing the full planner workspace.
- Background refreshes compare a compact request fingerprint and do not update React state when nothing changed.
- The current browser scroll position is retained when new request data is appended.
- The visible manual Refresh action still performs a complete workspace reload when an operator explicitly requests it.
- Coach Hub submission now uses the same named pitch-area rules as availability checks and final booking approval.
- A second request can use another named half of the same shared pitch where capacity permits.
- Duplicate use of the same half, full pitch capacity and ordinary team clashes remain blocked.
- Submission failures remain visible inside the request wizard as well as through the existing toast notification.

## Database

Migration: `202607170004_request_shadow_refresh_and_multi_submit.sql`
