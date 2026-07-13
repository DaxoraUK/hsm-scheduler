import { getClubSites, getPrimarySite, resolveSiteId } from "../siteAssignments.js";

const DAY_LABELS = Object.freeze({
  saturday: "Saturday",
  sunday: "Sunday",
  midweek: "Midweek",
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value ?? "").trim();
}

function activeFixture(fixture = {}) {
  const status = clean(fixture.status || fixture.fixtureStatus || fixture.outcome).toLowerCase();
  return !status.includes("postpon") && !status.includes("cancel");
}

function fixturePitchId(fixture = {}) {
  return clean(fixture.pitchId || fixture.pitch || fixture.pitchName || fixture.pitchLabel);
}

function fixtureTeamName(fixture = {}) {
  return clean(fixture.homeTeam || fixture.team || fixture.home || fixture.teamName);
}

function fixtureOfficialName(fixture = {}) {
  return clean(fixture.referee || fixture.official || fixture.ref || fixture.matchOfficial);
}

function getGovernance(club = {}) {
  const source = club.eliteGovernance && typeof club.eliteGovernance === "object"
    ? club.eliteGovernance
    : {};
  return {
    executiveSponsorName: clean(source.executiveSponsorName),
    executiveSponsorTitle: clean(source.executiveSponsorTitle),
    reportingCadence: clean(source.reportingCadence) || "monthly",
    riskReviewCadence: clean(source.riskReviewCadence) || "weekly",
    boardPackTitle: clean(source.boardPackTitle) || "Organisation operations and impact report",
  };
}

function getTeamSiteId(team = {}, sites = [], primarySiteId = "") {
  return resolveSiteId(
    team.homeSiteId || team.siteId || team.venueId || team.groundId,
    sites,
    primarySiteId,
  );
}

function getFixtureSiteId(fixture, pitchMap, teamMap, sites, primarySiteId) {
  const direct = clean(fixture?.siteId || fixture?.venueId || fixture?.groundId || fixture?.homeSiteId);
  if (direct) return resolveSiteId(direct, sites, primarySiteId);
  const pitchId = fixturePitchId(fixture);
  const pitchSite = pitchMap.get(pitchId)?.siteId;
  if (pitchSite) return pitchSite;
  const team = teamMap.get(fixtureTeamName(fixture).toLowerCase());
  return getTeamSiteId(team, sites, primarySiteId) || primarySiteId;
}

function unresolvedSiteId(item, pitchMap, teamMap, sites, primarySiteId) {
  const source = item?.fixture || item?.game || item || {};
  return getFixtureSiteId(source, pitchMap, teamMap, sites, primarySiteId);
}

function statusFromChecks({ unresolved, closedPitches, pitchCount, missingConfiguration, officialGaps }) {
  if (unresolved > 0 || pitchCount === 0 || (pitchCount > 0 && closedPitches >= pitchCount)) {
    return { key: "action", label: "Action required", tone: "rose" };
  }
  if (closedPitches > 0 || missingConfiguration > 0 || officialGaps > 0) {
    return { key: "review", label: "Review", tone: "amber" };
  }
  return { key: "ready", label: "Ready", tone: "emerald" };
}

function roleCount(memberships, ...roles) {
  const wanted = new Set(roles);
  return asArray(memberships).filter((membership) => wanted.has(clean(membership.role).toLowerCase())).length;
}

function membershipUserId(membership = {}) {
  return clean(membership.user_id || membership.userId || membership.id);
}

function membershipLabel(membership = {}) {
  return clean(membership.display_name || membership.displayName || membership.email || membershipUserId(membership)) || "Club member";
}

function fixtureRowsByDay({ satFinal, sunFinal, midweekFinal, midweekEnabled }) {
  return [
    ["saturday", asArray(satFinal)],
    ["sunday", asArray(sunFinal)],
    ...(midweekEnabled ? [["midweek", asArray(midweekFinal)]] : []),
  ].flatMap(([day, rows]) => rows.map((fixture) => ({ ...fixture, day, dayLabel: DAY_LABELS[day] })));
}

export function buildEliteCommandModel({
  club = {},
  teamCfg = [],
  pitchCfg = [],
  memberships = [],
  satFinal = [],
  sunFinal = [],
  midweekFinal = [],
  satUnresolved = [],
  sunUnresolved = [],
  midweekUnresolved = [],
  closedPitches = [],
  midweekEnabled = true,
  siteResponsibilities = [],
  periodStart = "",
  periodEnd = "",
  periodLabel = "Current matchweek",
} = {}) {
  const sites = getClubSites(club);
  const primarySite = getPrimarySite(sites);
  const primarySiteId = primarySite?.id || "main-ground";
  const governance = getGovernance(club);
  const memberMap = new Map(asArray(memberships).map((membership) => [membershipUserId(membership), membership]));
  const responsibilityRows = asArray(siteResponsibilities).filter((item) => item?.active !== false);
  const siteLeadMap = new Map(
    responsibilityRows
      .filter((item) => clean(item.responsibility) === "site_lead")
      .map((item) => [clean(item.siteId || item.site_id), item]),
  );
  const pitches = asArray(pitchCfg).map((pitch) => ({
    ...pitch,
    id: clean(pitch.id || pitch.pitchId || pitch.label),
    siteId: resolveSiteId(pitch.siteId || pitch.venueId || pitch.groundId, sites, primarySiteId) || primarySiteId,
  }));
  const pitchMap = new Map(pitches.map((pitch) => [pitch.id, pitch]));
  const teams = asArray(teamCfg);
  const teamMap = new Map(teams.map((team) => [clean(team.name || team.teamName || team.id).toLowerCase(), team]));
  const fixtures = fixtureRowsByDay({ satFinal, sunFinal, midweekFinal, midweekEnabled });
  const activeFixtures = fixtures.filter(activeFixture);
  const unresolved = [
    ...asArray(satUnresolved),
    ...asArray(sunUnresolved),
    ...(midweekEnabled ? asArray(midweekUnresolved) : []),
  ];
  const closed = new Set(asArray(closedPitches).map((item) => clean(item?.pitchId || item?.id || item)).filter(Boolean));
  const parkingEnabled = club?.features?.parkingEnabled !== false;
  const siteModels = sites.map((site) => {
    const sitePitches = pitches.filter((pitch) => pitch.siteId === site.id);
    const siteTeams = teams.filter((team) => getTeamSiteId(team, sites, primarySiteId) === site.id);
    const siteFixtures = activeFixtures.filter((fixture) => getFixtureSiteId(fixture, pitchMap, teamMap, sites, primarySiteId) === site.id);
    const siteUnresolved = unresolved.filter((item) => unresolvedSiteId(item, pitchMap, teamMap, sites, primarySiteId) === site.id);
    const closedAtSite = sitePitches.filter((pitch) => closed.has(pitch.id));
    const siteLead = siteLeadMap.get(site.id) || null;
    const siteLeadMember = siteLead ? memberMap.get(clean(siteLead.userId || siteLead.user_id)) : null;
    const siteLeadName = siteLead ? membershipLabel(siteLeadMember || { userId: siteLead.userId || siteLead.user_id }) : "";
    const configurationChecks = [
      !site.postcode,
      parkingEnabled && site.carParkSpaces <= 0,
      !siteLeadName,
    ];
    const missingConfiguration = configurationChecks.filter(Boolean).length;
    const status = statusFromChecks({
      unresolved: siteUnresolved.length,
      closedPitches: closedAtSite.length,
      pitchCount: sitePitches.length,
      missingConfiguration,
      officialGaps: siteFixtures.filter((fixture) => !fixtureOfficialName(fixture)).length,
    });
    const issues = [
      ...(sitePitches.length === 0 ? ["No pitches assigned"] : []),
      ...(siteUnresolved.length ? [`${siteUnresolved.length} unresolved fixture${siteUnresolved.length === 1 ? "" : "s"}`] : []),
      ...(closedAtSite.length ? [`${closedAtSite.length} closed pitch${closedAtSite.length === 1 ? "" : "es"}`] : []),
      ...(!site.postcode ? ["Weather postcode missing"] : []),
      ...(parkingEnabled && site.carParkSpaces <= 0 ? ["Parking capacity missing"] : []),
      ...(siteFixtures.some((fixture) => !fixtureOfficialName(fixture)) ? [`${siteFixtures.filter((fixture) => !fixtureOfficialName(fixture)).length} official gap${siteFixtures.filter((fixture) => !fixtureOfficialName(fixture)).length === 1 ? "" : "s"}`] : []),
      ...(!siteLeadName ? ["Site lead not assigned"] : []),
    ];

    return Object.freeze({
      ...site,
      pitches: sitePitches.length,
      teams: siteTeams.length,
      fixtures: siteFixtures.length,
      unresolved: siteUnresolved.length,
      closedPitches: closedAtSite.length,
      officialGaps: siteFixtures.filter((fixture) => !fixtureOfficialName(fixture)).length,
      leadName: siteLeadName,
      leadRole: siteLead ? "Site lead" : "",
      issues: Object.freeze(issues),
      status: Object.freeze(status),
    });
  });

  const roleCounts = Object.freeze({
    owners: roleCount(memberships, "owner"),
    admins: roleCount(memberships, "admin"),
    operators: roleCount(memberships, "operator"),
    viewers: roleCount(memberships, "viewer"),
  });
  const siteLeadCount = siteModels.filter((site) => site.leadName).length;
  const governanceChecks = Object.freeze([
    Object.freeze({
      id: "executive-sponsor",
      label: "Executive sponsor assigned",
      passed: Boolean(governance.executiveSponsorName),
      detail: governance.executiveSponsorName
        ? `${governance.executiveSponsorName}${governance.executiveSponsorTitle ? ` · ${governance.executiveSponsorTitle}` : ""}`
        : "Add a named senior owner in Organisation governance.",
    }),
    Object.freeze({
      id: "owner-coverage",
      label: "Club owner access confirmed",
      passed: roleCounts.owners >= 1,
      detail: roleCounts.owners ? `${roleCounts.owners} owner account${roleCounts.owners === 1 ? "" : "s"}` : "No owner membership is visible.",
    }),
    Object.freeze({
      id: "admin-resilience",
      label: "Administrative resilience",
      passed: roleCounts.owners + roleCounts.admins >= 2,
      detail: `${roleCounts.owners + roleCounts.admins} owner/admin account${roleCounts.owners + roleCounts.admins === 1 ? "" : "s"}`,
    }),
    Object.freeze({
      id: "site-leads",
      label: "Every site has an accountable lead",
      passed: siteLeadCount === siteModels.length,
      detail: `${siteLeadCount}/${siteModels.length} sites assigned`,
    }),
  ]);

  const actions = Object.freeze([
    ...(unresolved.length ? [{ id: "unresolved", priority: "high", label: `${unresolved.length} unresolved fixture${unresolved.length === 1 ? "" : "s"}`, destination: "operations" }] : []),
    ...(closed.size ? [{ id: "closures", priority: "high", label: `${closed.size} pitch closure${closed.size === 1 ? "" : "s"} require cross-site review`, destination: "operations" }] : []),
    ...(activeFixtures.some((fixture) => !fixtureOfficialName(fixture)) ? [{ id: "official-gaps", priority: "medium", label: `${activeFixtures.filter((fixture) => !fixtureOfficialName(fixture)).length} fixture${activeFixtures.filter((fixture) => !fixtureOfficialName(fixture)).length === 1 ? "" : "s"} still need an official`, destination: "operations" }] : []),
    ...siteModels.filter((site) => !site.leadName).map((site) => ({ id: `lead-${site.id}`, priority: "medium", label: `Assign a site lead for ${site.name}`, destination: "governance" })),
    ...siteModels.filter((site) => !site.postcode).map((site) => ({ id: `weather-${site.id}`, priority: "medium", label: `Add a weather postcode for ${site.name}`, destination: "venues" })),
    ...(parkingEnabled ? siteModels.filter((site) => site.carParkSpaces <= 0).map((site) => ({ id: `parking-${site.id}`, priority: "medium", label: `Set parking capacity for ${site.name}`, destination: "venues" })) : []),
  ]);

  const dayCounts = Object.freeze({
    saturday: asArray(satFinal).filter(activeFixture).length,
    sunday: asArray(sunFinal).filter(activeFixture).length,
    midweek: midweekEnabled ? asArray(midweekFinal).filter(activeFixture).length : 0,
  });
  const readySites = siteModels.filter((site) => site.status.key === "ready").length;
  const boardRows = Object.freeze(siteModels.map((site) => Object.freeze({
    site: site.name,
    status: site.status.label,
    teams: site.teams,
    pitches: site.pitches,
    fixtures: site.fixtures,
    unresolved: site.unresolved,
    closedPitches: site.closedPitches,
    officialGaps: site.officialGaps,
    parkingSpaces: site.carParkSpaces,
    lead: site.leadName || "Not assigned",
  })));

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    periodStart: clean(periodStart),
    periodEnd: clean(periodEnd),
    periodLabel: clean(periodLabel) || "Current matchweek",
    organisationName: clean(club.name) || "Club organisation",
    governance: Object.freeze(governance),
    sites: Object.freeze(siteModels),
    siteCount: siteModels.length,
    readySites,
    teamCount: teams.length,
    pitchCount: pitches.length,
    fixtureCount: activeFixtures.length,
    unresolvedCount: unresolved.length,
    closedPitchCount: closed.size,
    officialGapCount: activeFixtures.filter((fixture) => !fixtureOfficialName(fixture)).length,
    dayCounts,
    roleCounts,
    governanceChecks,
    governanceScore: Math.round((governanceChecks.filter((item) => item.passed).length / Math.max(governanceChecks.length, 1)) * 100),
    actions,
    boardRows,
  });
}

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildEliteBoardCsv(model) {
  const columns = [
    ["Site", "site"],
    ["Status", "status"],
    ["Teams", "teams"],
    ["Pitches", "pitches"],
    ["Scheduled fixtures", "fixtures"],
    ["Unresolved", "unresolved"],
    ["Closed pitches", "closedPitches"],
    ["Official gaps", "officialGaps"],
    ["Parking spaces", "parkingSpaces"],
    ["Site lead", "lead"],
  ];
  return [
    columns.map(([label]) => escapeCsv(label)).join(","),
    ...asArray(model?.boardRows).map((row) => columns.map(([, key]) => escapeCsv(row[key])).join(",")),
  ].join("\r\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildEliteBoardHtml(model, release = {}) {
  const generated = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" }).format(new Date(model.generatedAt));
  const rows = asArray(model.boardRows).map((row) => `
    <tr>
      <td>${escapeHtml(row.site)}</td><td>${escapeHtml(row.status)}</td><td>${row.teams}</td><td>${row.pitches}</td>
      <td>${row.fixtures}</td><td>${row.unresolved}</td><td>${row.closedPitches}</td><td>${row.officialGaps}</td>
      <td>${row.parkingSpaces}</td><td>${escapeHtml(row.lead)}</td>
    </tr>`).join("");
  const governance = asArray(model.governanceChecks).map((item) => `<li><strong>${item.passed ? "Ready" : "Action"}:</strong> ${escapeHtml(item.label)} — ${escapeHtml(item.detail)}</li>`).join("");
  const actions = asArray(model.actions).length
    ? asArray(model.actions).map((item) => `<li><strong>${escapeHtml(item.priority)}:</strong> ${escapeHtml(item.label)}</li>`).join("")
    : "<li>No organisation-wide actions were open when this pack was generated.</li>";
  const period = [model.periodStart, model.periodEnd].filter(Boolean).join(model.periodStart && model.periodEnd && model.periodStart !== model.periodEnd ? " to " : "");
  const approval = release.authorisation || {};
  const snapshot = release.snapshot || {};
  const releaseStatus = approval.approvalRequired
    ? `Approved ${approval.approvedAt ? escapeHtml(new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(approval.approvedAt))) : "before release"}`
    : "Approval not required by current policy";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(model.organisationName)} executive operations summary</title>
<style>
body{font-family:Arial,sans-serif;color:#0f172a;margin:36px;line-height:1.45}h1{font-size:28px;margin:0}.muted{color:#64748b}.release{margin:18px 0;border:1px solid #a7f3d0;background:#ecfdf5;border-radius:12px;padding:14px}.release div{margin:3px 0}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:24px 0}.metric{border:1px solid #cbd5e1;border-radius:12px;padding:14px}.metric b{display:block;font-size:22px;margin-top:6px}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top}th{background:#f1f5f9}h2{margin-top:28px;font-size:18px}footer{margin-top:28px;border-top:1px solid #cbd5e1;padding-top:12px;font-size:11px;color:#64748b}@media print{body{margin:12mm}.metrics{grid-template-columns:repeat(5,1fr)}}
</style></head><body>
<p class="muted">Daxora Ground Control · Elite organisation report</p>
<h1>${escapeHtml(model.governance.boardPackTitle || model.organisationName)}</h1>
<p><strong>${escapeHtml(model.organisationName)}</strong></p>
<p class="muted">${escapeHtml(model.periodLabel || "Current matchweek")}${period ? ` · ${escapeHtml(period)}` : ""} · Generated ${escapeHtml(generated)} · ${escapeHtml(model.governance.reportingCadence)} reporting cadence</p>
<div class="release"><strong>Release control</strong><div>${releaseStatus}</div><div>Snapshot: ${escapeHtml(snapshot.contentHash || approval.contentHash || "Not recorded")}</div><div>Report key: ${escapeHtml(snapshot.type ? `${snapshot.type}:${snapshot.contentHash || ""}` : "Not recorded")}</div></div>
<div class="metrics"><div class="metric">Sites<b>${model.siteCount}</b></div><div class="metric">Teams<b>${model.teamCount}</b></div><div class="metric">Pitches<b>${model.pitchCount}</b></div><div class="metric">Scheduled fixtures<b>${model.fixtureCount}</b></div><div class="metric">Open actions<b>${model.actions.length}</b></div></div>
<h2>Executive summary</h2><p>${model.readySites} of ${model.siteCount} sites were ready. ${model.unresolvedCount} unresolved fixture(s), ${model.closedPitchCount} closed pitch(es) and ${model.officialGapCount} official gap(s) were recorded for the selected period.</p>
<h2>Site portfolio</h2><table><thead><tr><th>Site</th><th>Status</th><th>Teams</th><th>Pitches</th><th>Fixtures</th><th>Unresolved</th><th>Closed pitches</th><th>Official gaps</th><th>Parking</th><th>Site lead</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Senior actions</h2><ul>${actions}</ul>
<h2>Governance readiness</h2><ul>${governance}</ul>
<footer>Operational evidence only. Scheduled fixtures do not prove completed activity, attendance or beneficiaries. Approval confirms release of this exact snapshot; it does not certify the underlying data as independently audited.</footer>
</body></html>`;
}
