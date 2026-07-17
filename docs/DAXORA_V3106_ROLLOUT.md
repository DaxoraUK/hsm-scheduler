# Daxora Ground Control v3.10.6 rollout

## Release type

Annual Planner module implementation release.

## Migration

`supabase/migrations/202607170005_full_pitch_weather_winter_analytics.sql`

The migration is additive and replaces affected guarded RPC functions. It creates winter-site inventory tables, extends planner bookings and coach requests, and introduces shared analytics and weather-disruption RPCs.

## Installation validation

The installer must run from `C:\Development\hsm-scheduler` and complete:

1. payload hash validation;
2. timestamped backup of affected files;
3. exact payload installation;
4. focused v3.10.6 tests;
5. complete regression suite;
6. lint with zero errors;
7. TypeScript and Vite production build;
8. linked Supabase migration dry run;
9. scoped Git commit;
10. linked Supabase migration push;
11. push to `origin/staging`.

## Acceptance checks after Vercel deploys

### Full Pitch

1. Configure Pitch 4 with capacity 2, Half A and Half B.
2. Create a Half A training booking.
3. Confirm Half B remains available.
4. Confirm Full Pitch is unavailable while Half A is occupied.
5. Create a Full Pitch friendly in a clear slot.
6. Confirm Half A and Half B are both unavailable during the friendly.
7. Confirm the friendly availability message does not report remaining training slots.

### Operator approval

1. Submit a Coach Hub request.
2. Open it in Annual Planner Requests.
3. Change the allocation to another pitch area or fixed winter slot.
4. Approve it.
5. Confirm the final booking and Coach Hub status show the chosen allocation.

### Weather

1. Open a confirmed training booking.
2. Select Weather.
3. Postpone it and confirm the original remains in history.
4. Rearrange another booking and confirm the original and replacement are linked.
5. Confirm affected coaches receive a Coach Hub message.
6. Confirm weather-lost and rearranged measures update in Insights.

### Winter sites

1. Add a winter site with availability dates, surface, floodlights and cost.
2. Add a fixed weekly slot.
3. Book the slot from the Winter sites workspace.
4. Confirm its capacity is independent from normal club pitches.
5. Confirm the booking appears in the calendar and analytics.

### Shared analytics

1. Compare the Annual Planner Insights headline measures with the main Analytics page.
2. Confirm planned, delivered, weather and winter totals match.
3. Confirm cost data is hidden from roles without cost permission.

## Rollback

The installer restores source files automatically if validation fails before commit. Once the database migration has been applied, do not manually delete the new tables or columns. Roll back application code only after taking a database backup and deciding how retained winter and weather records will be handled.

## Successful completion message

`COMPLETE - v3.10.6 FULL PITCH WEATHER WINTER ANALYTICS PUSHED`
