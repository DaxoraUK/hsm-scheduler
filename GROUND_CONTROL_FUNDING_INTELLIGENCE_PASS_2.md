# Ground Control Funding Intelligence — Pass 2

**Verified:** 5 July 2026  
**Scope:** UK grassroots football funding intelligence, project-specific evidence readiness, and evidence-confidence UX correction.

## Purpose

This pass moves Ground Control away from a generic "grant-ready" dashboard and toward a traceable funding-intelligence system. It does not promise eligibility, award success, or exhaustive local coverage. It helps a club identify potentially relevant verified programmes, understand the evidence each project type needs, and see which operational records or manual documents are still missing.

## Evidence-confidence layout correction

The previous evidence-confidence panel was too wide, used narrow vertical cards, and allowed project-specific gaps such as weather to dominate a general record-quality score.

The replacement:

- uses a compact headline and balanced evidence rows;
- shows reporting period, matchday scope, and record count together;
- displays core evidence areas with readable progress bars;
- separates contextual evidence from the general confidence calculation;
- keeps weather and parking visible without reducing the general score unless the selected funding project needs them;
- identifies the highest-priority core evidence gap without presenting a funding eligibility score.

### Core evidence

- History depth
- Fixture identity
- Playing-format coverage
- Pitch and kick-off allocation coverage
- Officials coverage

### Contextual evidence

- Parking evidence
- Weather evidence

Contextual measures become relevant when a selected project or report requires them, for example drainage, climate resilience, parking, access, or site-safety work.

## Verified programme catalogue

A structured catalogue of **39 official-source programmes** has been added. Some UK-wide programmes cover more than one home nation, so nation totals overlap.

Coverage includes:

- England: 21 programme records
- Scotland: 5 programme records
- Wales: 11 programme records
- Northern Ireland: 5 programme records

Every programme record contains:

- stable programme identifier;
- funder and programme name;
- applicable home nation or nations;
- project categories;
- current catalogue status;
- amount description;
- match-funding or club-contribution notes;
- applicant and project eligibility notes;
- mapped Ground Control evidence requirements;
- manual-document requirements;
- official source URL;
- last verified date;
- coverage level and source type.

The catalogue includes open, rolling, upcoming, monitored, development-stage, and closed programmes. Closed programmes remain visible only when the user chooses to include all statuses, because they can indicate recurring funding routes or schemes worth monitoring without being misrepresented as currently available.

## Project categories

The funding workspace supports project-specific matching for:

1. All funding areas
2. Grass pitches, drainage, and maintenance
3. 3G and artificial pitches
4. Clubhouse, changing, and community facilities
5. Floodlights and evening capacity
6. Equipment, goals, and storage
7. Participation and new teams
8. Women and girls
9. Disability and inclusion
10. Coaches, officials, and volunteers
11. Parking, travel, and site access
12. Energy and environmental sustainability
13. Community programmes and wellbeing
14. Land, buildings, and asset transfer

Each project type maps to the operational evidence and manual requirements that matter for that project. A weather gap therefore matters for drainage or sustainability work but does not automatically weaken an equipment or coaching case.

## Programme status and freshness safeguards

Ground Control now resolves programme status from dates rather than trusting a static label alone.

- Upcoming schemes become open on their opening date.
- Open schemes become closed after their deadline.
- Rolling schemes remain marked as year-round, subject to verification.
- Closed and monitored schemes are not shown as open opportunities.
- Every programme displays its last verified date.
- Verification older than 45 days is marked **Re-check required**.
- Verification older than 21 days is marked **Review soon**.

The catalogue must be maintained as funding pages change. An official source link is always shown so clubs can confirm the current rules before applying.

## Funding-intelligence workspace

The former Funding Evidence screen has been redesigned around:

- home-nation selection;
- project-type selection;
- reporting period;
- matchday scope;
- current/all opportunity status;
- project-specific operational evidence coverage;
- four separate readiness dimensions;
- verified opportunity cards;
- relevance and evidence mapping;
- eligibility checks;
- club-contribution requirements;
- evidence gaps;
- verification freshness;
- official-source links;
- the existing twelve-area evidence framework;
- live matchweek context kept separate from historical evidence.

### Readiness dimensions

Ground Control no longer compresses everything into one misleading grant-readiness percentage.

1. **Operational evidence** — calculated from stored records relevant to the selected project.
2. **Organisation eligibility** — requires legal structure, affiliation, turnover, tenure, accreditation, and similar profile information.
3. **Documents** — requires an evidence library for constitutions, accounts, policies, permissions, quotations, and project documents.
4. **Project case** — requires project cost, beneficiaries, outcomes, delivery plan, risks, and monitoring measures.

Only the first dimension is currently measured automatically. The remaining dimensions are explicitly labelled as needing input or not yet tracked.

## Accuracy boundaries

This pass covers a verified national and UK-wide foundation. It does **not** claim complete coverage of:

- every County FA fund;
- every local-authority scheme;
- every community foundation;
- every charitable trust;
- every landfill-community fund location;
- every postcode-restricted programme;
- temporary sponsorship competitions;
- invitation-only or unpublished opportunities.

No match is an eligibility decision, application approval, legal opinion, or guarantee of funding. Clubs must review the official guidance and funder decision before committing expenditure.

## Validation

- 33 test files passed
- 185 tests passed
- TypeScript passed
- Production build passed
- Lint passed with 0 errors
- Initial application bundle: approximately 471.78 KB minified / 144.73 KB gzip
- Analytics route bundle: approximately 123.70 KB minified / 28.72 KB gzip

Regression coverage now checks:

- all four home nations are represented;
- every programme has an official source and verification metadata;
- opening and deadline status transitions are safe;
- current Wales results exclude closed legacy rounds;
- weather and parking do not distort general evidence confidence;
- verification freshness and contribution requirements remain visible in the funding UI.

## Next funding phase

The next phase should add:

1. Club funding profile and legal/eligibility fields
2. Project builder with cost, location, beneficiaries, outcomes, and delivery dates
3. Document evidence library
4. Postcode and geographic eligibility layer
5. County FA, local-authority, community-foundation, and local-trust discovery
6. Evidence snapshots that preserve the exact records used for an application
7. Application tracker and monitoring obligations
8. Scheduled re-verification and stale-opportunity review workflow

Only after those controls are present should Ground Control describe its coverage as comprehensive for a particular geography or funding category.
