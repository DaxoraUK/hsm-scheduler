# Ground Control Funding Workspace — Pass 3

## Purpose

This phase turns Funding Intelligence into a working club funding preparation workspace. It does not guarantee eligibility or award success. It helps clubs define a project, identify missing requirements, understand how to complete them, store supporting evidence and preserve a dated application record.

## What has been added

### 1. Project brief

Clubs can create and maintain a funding project with:

- project title and category;
- project status;
- postcode;
- estimated project cost and target grant amount;
- legal structure;
- governing-body affiliation or accreditation;
- site tenure;
- selected funding programme;
- project need and proposed solution;
- intended beneficiaries;
- intended outcomes;
- delivery plan.

### 2. Guided readiness checklist

The checklist combines:

- the selected programme's eligibility and evidence requirements;
- project-specific requirements;
- organisation and facility information;
- documents already linked to each requirement;
- notes, status and due dates recorded by the club.

Missing items are shown first. Each requirement explains:

- why it matters;
- practical steps to complete it;
- examples of suitable supporting evidence;
- when it should be reviewed;
- the current status;
- the linked evidence documents.

Checklist states are:

- Missing
- In progress
- Ready
- Not applicable

Ground Control does not silently mark a legal, financial or governance requirement as complete merely because operational fixture data exists.

### 3. Supporting document library

Documents can be uploaded and linked directly to a requirement. Supported file types include PDF, Word, Excel, CSV, text and common image formats. The maximum file size is 15 MB.

Examples include:

- constitution and governing documents;
- annual accounts and bank evidence;
- safeguarding and equality policies;
- insurance certificates;
- affiliation or accreditation records;
- leases, licences and landlord consent;
- planning permissions;
- contractor quotations;
- project budgets and business plans;
- maintenance plans and PitchPower reports;
- site photographs and plans;
- consultation evidence and letters of support;
- monitoring plans and baseline evidence.

### 4. Evidence snapshots

A club can create a dated, immutable application snapshot containing:

- the project brief;
- selected programme;
- checklist status;
- document manifest;
- operational evidence summary;
- creation timestamp.

Snapshots provide a reproducible record of what evidence existed when an application or internal review was prepared. Files are referenced in the manifest rather than duplicated.

## Storage modes

### Shared Supabase mode

After the included migration is applied, projects, checklist records, document metadata and snapshots are shared securely within the club workspace.

Files are stored in the private `funding-documents` Supabase Storage bucket. Opening a file uses a short-lived signed URL. Database and storage policies restrict access by club ID.

Users with club-management permission can create and update records. Read-only users can review the workspace. Support sessions remain read-only.

### Local draft fallback

When the funding workspace migration or remote connection is unavailable, Ground Control falls back to a local browser draft:

- metadata is stored in localStorage;
- file contents are stored in IndexedDB;
- the draft is available only in that browser profile;
- it is not shared with other users or devices;
- clearing browser data can remove it.

Local draft mode is suitable for development and temporary preparation only. It is not a production document repository or backup.

## Database migration

Apply:

`supabase/migrations/202607050008_funding_workspace.sql`

The migration creates:

- `funding_projects`
- `funding_requirement_records`
- `funding_documents`
- `funding_evidence_snapshots`
- private Storage bucket `funding-documents`
- row-level security policies
- storage access policies
- audit triggers

The migration expects the existing Ground Control club membership, permission and audit functions to be present. Apply migrations in timestamp order.

Using the Supabase CLI from the linked project:

```powershell
supabase db push
```

For staging, apply it to the staging Supabase project before testing uploads. Do not test document uploads against production first.

## Security notes

- The Storage bucket is private.
- File paths begin with the club UUID and are checked by policy.
- Signed URLs are generated only for authorised reads.
- Table RLS is forced.
- Club reads use `public.can_read_club`.
- Club writes use `public.can_manage_club`.
- Evidence snapshots cannot be edited or deleted after creation.
- File type and 15 MB size limits are enforced in the bucket configuration and client.
- This phase stores operational and application evidence; clubs should still avoid uploading unnecessary personal or special-category data.

## Manual acceptance checks

1. Open Analytics and select Funding Intelligence.
2. Create a new funding project.
3. Complete only part of the project brief and confirm missing requirements appear first.
4. Open several requirements and confirm the explanation, completion steps and suitable evidence are clear.
5. Change a requirement from Missing to In progress and add a due date and note.
6. Upload a document and link it to the relevant requirement.
7. Open the document and confirm it uses authorised access.
8. Delete a test document and confirm the branded confirmation dialog appears.
9. Select a verified funding programme and confirm programme-specific requirements are added.
10. Complete additional project fields and confirm readiness changes.
11. Create an evidence snapshot and confirm it cannot be edited.
12. Sign in as a read-only user and confirm editing and uploads are unavailable.
13. Test a second club and confirm it cannot view the first club's projects or documents.
14. Temporarily use an environment without the migration and confirm the interface clearly identifies local draft mode.

## Automated validation

At packaging time:

- 34 test files passed;
- 189 tests passed;
- TypeScript passed;
- production build passed;
- lint completed with 0 errors;
- existing non-blocking warnings remained.

## Next funding phase

The next phase should add:

- club-level document expiry and renewal reminders;
- programme deadline reminders;
- postcode-led local funding discovery;
- document review/approval status;
- application tasks and owners;
- funder-specific application pack exports;
- outcome and monitoring plans linked to post-award reporting;
- controlled retention and archival rules.
