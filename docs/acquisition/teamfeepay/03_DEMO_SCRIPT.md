# TeamFeePay acquisition demo script

**Target duration:** 15 minutes
**Route:** `/teamfeepay-demo`
**Data:** entirely synthetic

## Before the call

- Use a clean browser profile.
- Confirm the demo loads without Supabase authentication.
- Confirm browser zoom is 100%.
- Reset the scenario.
- Close developer tools and unrelated tabs.
- Have the non-confidential teaser ready, but do not screen-share private valuation notes.

## Opening — 90 seconds

> TeamFeePay has already solved many of the hardest member, payment and club-administration problems. Daxora is the complementary operating layer: the physical pitches, bookings, disruption, coach actions, officials, leagues and utilisation evidence that sit behind those member-facing events.

State clearly:

- this is a working Daxora product demonstration;
- the club and people are fictional;
- it is not connected to TeamFeePay production;
- the integration boundary is designed to be agreed jointly.

## Strategic fit — 2 minutes

Open **Strategic fit**.

Focus on:

- TeamFeePay remains the source for authorised club/member records;
- Daxora enriches events with physical operating intelligence;
- TeamFeePay can return operational status to coaches, parents and administrators;
- unified facility evidence directly supports the facilities-development and grants proposition.

Do not spend time on raw file counts.

## Live scenario — 7 minutes

Open **Live scenario** and run each action.

### 1. Run data sync

Explain that the adapter maps an authorised partner payload into Daxora's stable club, team, person and event model. There is no duplicate club setup.

### 2. Build operating weekend

Explain that event records alone do not answer:

- which pitch can host them;
- whether time buffers are safe;
- whether the site and parking can cope;
- whether another booking consumes the same area;
- which officials or approvals are missing.

### 3. Close North Grass

Pause on the two affected events.

> A normal calendar records a change. Daxora understands the consequence.

Point out that teams, coaches, officials, alternatives, site capacity and communications are all known from the same event.

### 4. Approve recovery plan

Show that the U14 fixture moves to an earlier stadium slot and the reserves move to the external 3G venue. No cancellation is required.

### 5. Publish operational evidence

Show:

- 83.9% combined utilisation;
- 60 hours of unused monthly capacity;
- modelled administrative value;
- enriched status suitable for return to TeamFeePay.

## Integration API — 3 minutes

Open **Integration API**.

Explain the separation:

1. Daxora canonical model;
2. replaceable provider adapter;
3. authorised HTTP connector when TeamFeePay supplies its specification.

Run a mapping preview. Emphasise idempotency, minimisation and audit.

Do not claim the listed paths are TeamFeePay endpoints. They are the Daxora Partner API proposed for the transaction.

## Buyer readiness — 90 seconds

Open **Buyer readiness**.

State that detailed code and architecture are available through a controlled diligence process after strategic interest and NDA. Mention that the product contains a substantial source estate, regression suite and migration history, while avoiding an argument based only on code volume.

## Close

> The question is not whether TeamFeePay could build these capabilities. It is whether acquiring Daxora gives you a faster, lower-risk and more deeply validated route to the next operating layer of grassroots football.

Ask for:

- technical and product follow-up;
- confirmation of strategic interest;
- mutual NDA;
- named diligence contacts;
- agreement on the first data and API workshop.
