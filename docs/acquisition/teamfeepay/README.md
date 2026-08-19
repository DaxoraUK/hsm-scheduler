# TeamFeePay acquisition readiness pack

**Status:** private founder working pack
**Prepared:** 21 July 2026
**Product:** Daxora Ground Control

This directory supports a controlled strategic-acquisition approach to TeamFeePay. It is not evidence of a relationship, endorsement or authorised technical connection.

## Included

1. `01_NON_CONFIDENTIAL_TEASER.md` — two-page-equivalent first-contact narrative.
2. `02_STRATEGIC_FIT.md` — TeamFeePay-to-Daxora capability map.
3. `03_DEMO_SCRIPT.md` — repeatable 15-minute demonstration.
4. `04_TECHNICAL_ARCHITECTURE.md` — high-level technical diligence summary.
5. `05_IP_ASSET_SCHEDULE.md` — draft asset inventory for legal review.
6. `06_DISCLOSURE_AND_DATA_ROOM_PLAN.md` — staged disclosure controls.
7. `07_CONTACT_AND_NEGOTIATION_PLAYBOOK.md` — approach and meeting plan.
8. `08_READINESS_REGISTER.md` — outstanding founder and technical actions.
9. `09_API_DISCOVERY_WORKSHOP.md` — authorised integration-discovery agenda.
10. `10_INITIAL_OUTREACH.md` — controlled email and LinkedIn approach.
11. `../../integrations/teamfeepay/openapi.yaml` — Daxora Partner API sandbox contract.

## Demo routes and commands

Run the private visual demo:

```powershell
npm run demo:teamfeepay
```

In development, open:

```text
/teamfeepay-demo
```

Production and preview deployments keep this route disabled unless the protected demo deployment has:

```text
VITE_ENABLE_ACQUISITION_DEMO=true
```

Run the local synthetic partner API:

```powershell
npm run demo:teamfeepay-api
```

Default sandbox header:

```text
X-Daxora-Demo-Key: daxora-teamfeepay-demo
```

Do not expose the demo route publicly without access controls when it begins to contain confidential commercial material.
