# Sort/filter coverage ledger

Default: named records A–Z; teams age then name; dated histories chronological; rankings and calendars retain domain order. Status is implementation status, not a claim of browser verification.

| Route/tab | Collection / render file | Default / filters | Status / evidence |
| --- | --- | --- | --- |
| Settings / Teams | TeamSettingsPanel | Age; age/day/format + existing coach search | Integrated; settings runtime test; original index/contact preserved |
| Settings / Pitches | PitchSettingsPanel | Name; site/format/surface + existing search | Integrated; settings runtime test; edit index preserved |
| Settings / Officials | RefereeSettingsPanel | Name; role/search | Integrated; settings runtime test |
| Settings / Sources | IntegrationSettingsPanel | Name; existing server source search/status | Integrated; settings runtime test; source index preserved |
| Settings / Venues | VenueSettingsPanel | Name; primary/search | Integrated; settings runtime test |
| Settings / History | HistorySettingsPanel | Saved date descending; search; date/count headings | Integrated; load-target runtime test |
| Settings / Coach Hub | CoachHubSettingsPanel contacts/request queue | Contact name; verification/access; request date/team/status | Integrated; existing contact regressions; final runtime audit pending |
| Settings / Access | AccessSecurityPanel members/pending invitations | Name/email; role; expiry | Integrated; final runtime audit pending |
| Settings team pickers | AccessSecurityPanel, CoachHubSettingsPanel | Age; retain stable IDs/keys | Integrated; shared comparator tests; final runtime audit pending |
| Settings access audit/support sessions | AccessSecurityPanel | Date descending; status | Pending |
| Operations Sat/Sun/Midweek | shared/MatchdayScheduleCard | Team age/name; time/pitch/status | Pending |
| Operations officials/action lists | shared/OfficialsIntelligenceCard and MatchdayPage | Priority retained; team/status | Pending |
| Annual Planner | AnnualPlannerPage, AnnualPlannerCompletionWorkspace | Names A–Z, dated lists chronological | Pending |
| Coach Hub | CoachHubPage lists, selectors | Team age/name; date/status | Pending |
| Communications | CommunicationsPage message queue/history | Team age/name; history chronological; existing day/readiness/search | Pending |
| Analytics | UnifiedFacilityAnalyticsDashboard / FacilityNonPitchActivity | Facility name; numeric headings; existing date/site/team/type | Pending |
| Analytics funding/evidence | FundingWorkspacePanel / FundingApplicationTracker / FundingImpactEvidencePanel / GrantImpactDashboard | Named records A–Z; status; charts ranked | Pending |
| Reports | ReportsPage / print documents | Named choices A–Z; print scope preserved | Pending |
| League Manager collections | League workspaces listed in implementation plan | Domain hierarchy/rank retained; named lists A–Z; existing filters | Pending; paging/access scope audit required |
| Daxora Admin | PlatformAdminPage | Name; server search/status/plan | Pending; 100-row club pagination must be reconciled through existing offset interface |
| Dashboard/Command lists | DashboardPage / EliteCommandCentrePage / OperationsCentrePage | Priority alerts retained | Pending actual collection audit |
| Timeline/calendar geometry | OperationsTimelinePage / CoachSharedCalendar / planner calendar | Chronological geometry | Intentionally exempt from arbitrary sorting; reuse meaningful calendar filters |
| FixturesPage | Placeholder page, no records or routed scheduling list | None | Exempt; real fixture work is MatchdayPage/MatchdayScheduleCard |
| Legacy unused components | HistoryPanel / RefManager / PitchClosuresSettingsPanel | None | Exempt: no consumers found under src; do not refactor dead code |
| Public/privacy/landing/detail forms | Public pages; fixed detail/configuration fields | None | Exempt: not record collections |
| Print-only documents | reports/ReportDocument / UnifiedFacilityReportDocument | Existing export scope | Controls intentionally omitted; final print test pending |

Remaining inventory pass: enumerate record-bearing tabs within League Manager, funding, planner, Admin and command views; expand this ledger rather than marking entire modules complete from one toolbar. Never treat API-limited records as an all-record collection without proof.
