# Ground Control v3.10.6

## Full Pitch, weather disruption, winter sites and shared analytics

v3.10.6 is the first implementation release from the committed Annual Planner, Shared Calendar and Coach Requests roadmap.

## Delivered

### Full Pitch authority

Every pitch with named training areas now offers an explicit Full Pitch allocation.

- Full Pitch blocks all overlapping named areas.
- Any occupied named area blocks Full Pitch.
- Different named areas may operate simultaneously within configured capacity.
- Friendlies default to Full Pitch.
- Training may use Full Pitch or a named area.
- Availability, request submission, operator approval and final database saving use the same rules.
- Availability messages describe the selected resource rather than reporting irrelevant remaining training capacity.

### Operator request allocation

Club operators can approve or offer alternatives using saved club resources.

- Change date and time.
- Change pitch.
- Select Full Pitch or a named area.
- Allocate a fixed winter-site slot.
- Recheck the final allocation transactionally before approval.

### Weather disruption foundation

Confirmed Annual Planner bookings can be:

- postponed and marked as awaiting rearrangement;
- cancelled due to weather;
- rearranged to another date, pitch, area or winter slot.

The original booking remains in history. A rearrangement creates a linked replacement booking. The action records the reason, public coach message, operator, timestamps and audit event, and creates Coach Hub messages for affected active team assignments.

### Winter-site inventory

Annual Planner includes a Winter sites workspace for separate seasonal facilities.

A site records:

- name and address;
- availability dates;
- club, partner or external-provider status;
- surface and floodlights;
- base cost;
- access and keyholder notes;
- restrictions and cancellation terms.

Each site can contain fixed weekly slots with day, start, finish, capacity, named area and cost. Winter bookings use their own site and slot identifiers so normal grass-pitch inventory does not supply their capacity.

### Shared analytics foundation

One analytics engine supplies both:

- Annual Planner Insights; and
- the main club-wide Analytics page.

Initial measures include planned hours, delivered hours, weather-lost hours, rearranged sessions, winter hours, active winter sites, fixed winter slots and external winter cost. The same model creates grant-evidence narratives, facility rows and team rows.

## Security and data integrity

- New winter inventory tables use forced RLS.
- Coaches receive only active winter inventory without protected cost or cancellation details.
- Operators manage winter inventory through guarded RPC functions.
- Full Pitch and winter capacity are rechecked in PostgreSQL.
- Weather actions require club-operator access and write audit events.
- Costs continue to respect the Annual Planner cost-visibility rules.

## Deferred to the next phase

v3.10.7 will focus on smart summer and winter team allocation:

- Manual, Assisted and Automatic Draft modes;
- preferred and historic slots;
- age-group and format suitability;
- coach availability and shared-coach clashes;
- fixed winter-site slot assignment;
- fairness, cost and club priorities;
- locks, explainable scoring, confidence and conflict lists;
- unpublished review before any allocation is released.

Later work will deepen weather reinstatement, closure-impact handling, notification delivery tracking, winter provider data and grant analytics.
