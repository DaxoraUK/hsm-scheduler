# Ground Control v3.10.5.2

## Pitch-area split-session and calendar-legend repair

### Faults corrected

1. A team-level overlap rule ran after pitch capacity checks and always rejected a second simultaneous booking, even when the same training group was deliberately split across two different named areas of a shared pitch.
2. Calendar cards and calendar legends used separate colour definitions. Confirmed bookings could therefore render green while the key described booked activity as violet.
3. Calendar React keys relied mainly on the upstream record identifier. The replacement identity also includes the team, pitch, named area and start time so Half A and Half B remain distinct.
4. Shared pitches with named areas still allowed an unallocated/blank area selection, which made capacity and calendar display ambiguous.

### Behaviour after the repair

- Pitch 4 can host simultaneous training on Half A and Half B when its simultaneous training capacity is at least two.
- The same team may run a split training session across different named areas of the same pitch.
- A duplicate booking on the same named area remains blocked.
- A same-team overlap on another pitch, or without two distinct named areas, remains blocked.
- Coach Hub requests must select a named area when the chosen training pitch has named areas configured.
- Annual Planner and Coach Hub calendars use one shared colour/status map.
- The shared key includes Approved booking, Booked/provisional, Pending request, Fixture/friendly and Closed/unavailable.

### Database migration

`202607170003_pitch_area_split_session_and_calendar_legend.sql`

The migration replaces the area-aware availability, operator save and Coach Hub approval functions. It relaxes team overlap only when all of these are true:

- both records are training bookings;
- both use the same pitch;
- both have explicit named area IDs;
- the two area IDs are different;
- pitch capacity and same-area checks still pass.

No broader team double-booking permission is introduced.
