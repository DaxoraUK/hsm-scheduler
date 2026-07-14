import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCopy,
  FileSpreadsheet,
  LockKeyhole,
  MapPin,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Table2,
  Trash2,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "../lib/notifications/daxoraNotifications.js";
import { DB } from "../lib/supabase.js";
import LeagueScheduleWorkspace from "../components/league/LeagueScheduleWorkspace.jsx";
import LeagueCupWorkspace from "../components/league/LeagueCupWorkspace.jsx";
import LeagueFixtureCommandWorkspace from "../components/league/LeagueFixtureCommandWorkspace.jsx";
import LeagueOfficialsWorkspace from "../components/league/LeagueOfficialsWorkspace.jsx";
import LeagueClubOperationsWorkspace from "../components/league/LeagueClubOperationsWorkspace.jsx";
import LeagueClubPortalPage from "../components/league/LeagueClubPortalPage.jsx";
import LeagueResultsWorkspace from "../components/league/LeagueResultsWorkspace.jsx";
import LeagueCommandCentreWorkspace from "../components/league/LeagueCommandCentreWorkspace.jsx";
import LeagueCommandSearch from "../components/league/LeagueCommandSearch.jsx";
import LeagueDisciplineWorkspace from "../components/league/LeagueDisciplineWorkspace.jsx";
import LeagueRegistrationsWorkspace from "../components/league/LeagueRegistrationsWorkspace.jsx";
import LeagueAnalyticsWorkspace from "../components/league/LeagueAnalyticsWorkspace.jsx";
import { usePersistedWorkspaceState } from "../hooks/usePersistedWorkspaceState.js";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard.js";
import { useDaxoraConfirm } from "../contexts/DaxoraInteractionContext.jsx";
import {
  getBlackoutScopeOptions,
  getCurrentLeagueSeason,
  getEntityName,
  getLeagueReadiness,
  normaliseLeagueWorkspace,
  parseLeagueFixtureCsv,
  parseLeagueStructureCsv,
  serialiseLeagueEntity,
} from "../lib/league/leagueManagerModel.js";
import { normaliseLeagueOperationsData } from "../lib/league/leagueOperationsEngine.js";
import { normaliseLeagueClubPortalData } from "../lib/league/leagueClubOperations.js";

const INPUT = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500";
const BUTTON = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50";

const STRUCTURE_SECTIONS = Object.freeze([
  ["season", "Seasons"],
  ["division", "Divisions"],
  ["parent_club", "Parent clubs"],
  ["team", "Teams"],
]);

const VENUE_SECTIONS = Object.freeze([
  ["playing_date", "Playing dates"],
  ["venue", "Venues"],
  ["blackout", "Blackout dates"],
]);

const FIXTURE_VIEWS = Object.freeze([
  ["all", "All fixtures"],
  ["postponed", "Postponed bank"],
  ["unplaced", "Unplaced"],
]);

const TABS = Object.freeze([
  ["overview", "Command centre", ShieldCheck],
  ["analytics", "Analytics & reports", BarChart3],
  ["command", "Fixture Command", CalendarDays],
  ["schedule", "Schedule builder", RefreshCw],
  ["cups", "Cups", Trophy],
  ["officials", "Match officials", Users],
  ["clubs", "Club operations", Megaphone],
  ["results", "Results & tables", Table2],
  ["registrations", "Registrations & eligibility", Users],
  ["discipline", "Discipline & compliance", ShieldAlert],
  ["structure", "League structure", Building2],
  ["availability", "Venues & availability", MapPin],
  ["fixtures", "Fixture records", FileSpreadsheet],
  ["access", "Access & audit", LockKeyhole],
]);

const NAV_GROUPS = Object.freeze([
  ["command-centre", "Command", ShieldCheck, ["overview", "analytics"]],
  ["fixtures", "Fixtures", CalendarDays, ["command", "schedule", "fixtures", "availability", "officials"]],
  ["competitions", "Competitions", Trophy, ["results", "cups", "registrations", "discipline"]],
  ["clubs", "Clubs", Megaphone, ["clubs"]],
  ["administration", "Administration", Building2, ["structure", "access"]],
]);

const TAB_LOOKUP = new Map(TABS.map((item) => [item[0], item]));
const TAB_GROUP = new Map(NAV_GROUPS.flatMap(([groupKey, , , tabKeys]) => tabKeys.map((tabKey) => [tabKey, groupKey])));

function readLeagueNavigation() {
  if (typeof window === "undefined") return { tab: "overview", child: "" };
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("lm_area") || "overview";
  return {
    tab: TAB_LOOKUP.has(tab) ? tab : "overview",
    child: params.get("lm_view") || "",
  };
}

function writeLeagueNavigation(tab, child = "", { replace = false } = {}) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("lm_area", tab);
  if (child) url.searchParams.set("lm_view", child);
  else url.searchParams.delete("lm_view");
  window.history?.[replace ? "replaceState" : "pushState"]?.({}, "", url);
}

function tabQueueCount(tab, counts = {}) {
  if (tab === "overview") return Number(counts.openActions || 0);
  if (tab === "results") return Number(counts.pendingResults || 0) + Number(counts.missingResults || 0);
  if (tab === "clubs") return Number(counts.openChangeRequests || 0) + Number(counts.pendingAcknowledgements || 0);
  if (tab === "officials") return Number(counts.officialGaps || 0) + Number(counts.replacementAssignments || 0) + Number(counts.overduePostponements || 0);
  if (tab === "schedule") return Number(counts.unplacedFixtures || 0);
  if (tab === "registrations") return Number(counts.pendingRegistrations || 0) + Number(counts.registrationCorrections || 0) + Number(counts.pendingTransfers || 0) + Number(counts.openEligibilityExceptions || 0) + Number(counts.invalidTeamSheets || 0);
  if (tab === "discipline") return Number(counts.openDisciplineCases || 0) + Number(counts.overdueDisciplineResponses || 0) + Number(counts.overdueDisciplineFines || 0);
  if (tab === "structure") return Number(counts.setupGaps || 0);
  return 0;
}

function currentSeasonDefaults() {
  const today = new Date();
  const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    name: `${startYear}/${String(startYear + 1).slice(-2)}`,
    startsOn: `${startYear}-08-01`,
    endsOn: `${startYear + 1}-06-30`,
    defaultKickOff: "",
    primaryWeekday: 6,
    maxConsecutiveHomeAway: 2,
  };
}

function Field({ label, children, className = "" }) {
  return (
    <label className={className}>
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

function Panel({ children, className = "" }) {
  return <section className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    navy: "border-slate-950 bg-slate-950 text-white",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[tone] || tones.slate}`}>{children}</span>;
}


function LoadingCard({ label = "League Manager" }) {
  return (
    <div className="flex min-h-[460px] items-center justify-center">
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
        <RefreshCw className="mx-auto animate-spin text-emerald-600" size={28} />
        <div className="mt-4 text-sm font-black text-slate-900">Loading {label}…</div>
      </div>
    </div>
  );
}

function ErrorCard({ error, onRetry }) {
  return (
    <Panel className="p-7">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700"><AlertTriangle size={22} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black text-slate-950">League Manager could not load</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{error || "The secure league workspace could not be verified."}</p>
          <button type="button" onClick={onRetry} className={`${BUTTON} mt-5 bg-slate-950 text-white`}><RefreshCw size={16} /> Retry</button>
        </div>
      </div>
    </Panel>
  );
}

function SectionTabs({ items, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
      {items.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${value === key ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function registryMeta(type, row, workspace) {
  if (type === "season") return `${row.status || "draft"}${row.isCurrent ? " · Current" : ""}`;
  if (type === "division") return `${getEntityName(workspace, "season", row.seasonId)} · ${row.meetingsPerPairing || 2} meeting${Number(row.meetingsPerPairing || 2) === 1 ? "" : "s"} per pairing${row.startsOn ? ` · Starts ${row.startsOn}` : ""}`;
  if (type === "parent_club") return row.shortName || row.externalRef || row.status || "Active";
  if (type === "team") return `${getEntityName(workspace, "division", row.divisionId)} · ${getEntityName(workspace, "club", row.parentClubId)}`;
  if (type === "venue") return `${getEntityName(workspace, "club", row.parentClubId)}${row.groundShareKey ? ` · Share ${row.groundShareKey}` : ""}`;
  if (type === "blackout") return `${row.startsOn}${row.endsOn && row.endsOn !== row.startsOn ? ` – ${row.endsOn}` : ""} · ${row.scopeType}`;
  if (type === "playing_date") return `${getEntityName(workspace, "season", row.seasonId)}${row.divisionId ? ` · ${getEntityName(workspace, "division", row.divisionId)}` : " · Whole league"}`;
  if (type === "fixture") return `${getEntityName(workspace, "team", row.homeTeamId)} v ${getEntityName(workspace, "team", row.awayTeamId)}`;
  return "";
}

function registryTitle(type, row) {
  if (type === "blackout") return row.reason || "Blackout date";
  if (type === "playing_date") return row.playingDate || "Playing date";
  if (type === "fixture") return row.scheduledDate || "Unplaced fixture";
  return row.name || "Untitled record";
}

function entityItems(type, workspace) {
  const map = {
    season: workspace.seasons,
    division: workspace.divisions,
    parent_club: workspace.clubs,
    team: workspace.teams,
    venue: workspace.venues,
    blackout: workspace.blackouts,
    playing_date: workspace.playingDates,
    fixture: workspace.fixtures,
  };
  return Array.isArray(map[type]) ? map[type] : [];
}

function createDraft(type, workspace) {
  const season = getCurrentLeagueSeason(workspace);
  const division = workspace.divisions?.[0];
  const club = workspace.clubs?.[0];
  const venue = workspace.venues?.[0];
  const defaults = currentSeasonDefaults();
  if (type === "season") return { ...defaults, status: workspace.seasons?.length ? "draft" : "active", isCurrent: !workspace.seasons?.length };
  if (type === "division") return { seasonId: season?.id || "", name: "", code: "", sortOrder: workspace.divisions?.length || 0, teamLimit: "", startsOn: season?.startsOn || "", endsOn: season?.endsOn || "", meetingsPerPairing: 2, defaultKickOff: "", playingWeekday: "", maxConsecutiveHomeAway: season?.maxConsecutiveHomeAway || 2, extraHomeRotationOffset: 0, winPoints: 3, drawPoints: 1, lossPoints: 0, walkoverScore: 3 };
  if (type === "parent_club") return { name: "", shortName: "", externalRef: "", status: "active" };
  if (type === "team") return { seasonId: season?.id || "", divisionId: division?.id || "", parentClubId: club?.id || "", homeVenueId: venue?.id || "", name: "", shortName: "", externalRef: "", status: "active" };
  if (type === "venue") return { parentClubId: club?.id || "", name: "", address: "", postcode: "", surface: "Grass", capacity: "", groundShareKey: "", simultaneousFixtureLimit: 1, status: "active" };
  if (type === "blackout") return { seasonId: season?.id || "", scopeType: "league", scopeId: "", startsOn: "", endsOn: "", reason: "", source: "manual" };
  if (type === "playing_date") return { seasonId: season?.id || "", divisionId: "", playingDate: "", defaultKickOff: season?.defaultKickOff || "", status: "available", notes: "" };
  if (type === "fixture") return { seasonId: season?.id || "", divisionId: division?.id || "", homeTeamId: "", awayTeamId: "", venueId: venue?.id || "", scheduledDate: "", kickOff: "", status: "draft", locked: false, source: "manual", externalRef: "", notes: "" };
  return {};
}

function EntityEditorFields({ type, draft, setDraft, workspace, disabled }) {
  const update = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setDraft((current) => ({ ...current, [key]: value }));
  };

  if (type === "season") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Season name" className="sm:col-span-2"><input className={INPUT} value={draft.name || ""} onChange={update("name")} disabled={disabled} placeholder="2026/27" /></Field>
        <Field label="Starts"><input type="date" className={INPUT} value={draft.startsOn || ""} onChange={update("startsOn")} disabled={disabled} /></Field>
        <Field label="Ends"><input type="date" className={INPUT} value={draft.endsOn || ""} onChange={update("endsOn")} disabled={disabled} /></Field>
        <Field label="League default kick-off"><input type="time" className={INPUT} value={draft.defaultKickOff || ""} onChange={update("defaultKickOff")} disabled={disabled} /><span className="mt-2 block text-[11px] font-semibold leading-5 text-slate-500">This is the authoritative fallback for every division and cup unless that competition overrides it.</span></Field>
        <Field label="Primary league day"><select className={INPUT} value={draft.primaryWeekday ?? 6} onChange={update("primaryWeekday")} disabled={disabled}><option value={6}>Saturday</option><option value={0}>Sunday</option><option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option></select></Field>
        <Field label="Home/away run target"><input type="number" min="1" max="6" className={INPUT} value={draft.maxConsecutiveHomeAway ?? 2} onChange={update("maxConsecutiveHomeAway")} disabled={disabled} /><span className="mt-2 block text-[11px] font-semibold leading-5 text-slate-500">The generator actively works toward this maximum before it reports warnings.</span></Field>
        <Field label="Status"><select className={INPUT} value={draft.status || "draft"} onChange={update("status")} disabled={disabled}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></Field>
        <label className="flex h-11 items-center gap-3 self-end rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700"><input type="checkbox" checked={Boolean(draft.isCurrent)} onChange={update("isCurrent")} disabled={disabled} /> Current season</label>
      </div>
    );
  }

  if (type === "division") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Season" className="sm:col-span-2"><select className={INPUT} value={draft.seasonId || ""} onChange={update("seasonId")} disabled={disabled}><option value="">Select season</option>{workspace.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Division name"><input className={INPUT} value={draft.name || ""} onChange={update("name")} disabled={disabled} placeholder="Premier Division" /></Field>
        <Field label="Short code"><input className={INPUT} value={draft.code || ""} onChange={update("code")} disabled={disabled} placeholder="PREM" /></Field>
        <Field label="Division starts"><input type="date" className={INPUT} value={draft.startsOn || ""} onChange={update("startsOn")} disabled={disabled} /></Field>
        <Field label="Division ends"><input type="date" className={INPUT} value={draft.endsOn || ""} onChange={update("endsOn")} disabled={disabled} /></Field>
        <Field label="Meetings per pairing"><select className={INPUT} value={draft.meetingsPerPairing ?? 2} onChange={update("meetingsPerPairing")} disabled={disabled}><option value={1}>1 meeting</option><option value={2}>2 meetings — home and away</option><option value={3}>3 meetings</option><option value={4}>4 meetings</option></select></Field>
        <Field label="Odd-meeting home cycle"><select className={INPUT} value={draft.extraHomeRotationOffset ?? 0} onChange={update("extraHomeRotationOffset")} disabled={disabled}><option value={0}>Automatic season rotation</option><option value={1}>Invert automatic rotation</option></select><span className="mt-2 block text-[11px] font-semibold leading-5 text-slate-500">For one or three meetings, the extra home fixture swaps automatically between consecutive seasons. Use invert only to correct an inherited cycle.</span></Field>
        <Field label="Kick-off override"><input type="time" className={INPUT} value={draft.defaultKickOff || ""} onChange={update("defaultKickOff")} disabled={disabled} /><span className="mt-2 block text-[11px] font-semibold leading-5 text-slate-500">Leave blank to inherit the league setting.</span></Field>
        <Field label="Playing-day override"><select className={INPUT} value={draft.playingWeekday ?? ""} onChange={update("playingWeekday")} disabled={disabled}><option value="">Use league day</option><option value={6}>Saturday</option><option value={0}>Sunday</option><option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option></select></Field>
        <Field label="Home/away run target"><input type="number" min="1" max="6" className={INPUT} value={draft.maxConsecutiveHomeAway ?? 2} onChange={update("maxConsecutiveHomeAway")} disabled={disabled} /></Field>
        <Field label="Sort order"><input type="number" min="0" className={INPUT} value={draft.sortOrder ?? 0} onChange={update("sortOrder")} disabled={disabled} /></Field>
        <Field label="Team limit"><input type="number" min="1" className={INPUT} value={draft.teamLimit ?? ""} onChange={update("teamLimit")} disabled={disabled} placeholder="Optional" /></Field>
        <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4"><div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Result and table rules</div></div>
        <Field label="Points for win"><input type="number" min="0" max="10" className={INPUT} value={draft.winPoints ?? 3} onChange={update("winPoints")} disabled={disabled} /></Field>
        <Field label="Points for draw"><input type="number" min="0" max="10" className={INPUT} value={draft.drawPoints ?? 1} onChange={update("drawPoints")} disabled={disabled} /></Field>
        <Field label="Points for loss"><input type="number" min="-10" max="10" className={INPUT} value={draft.lossPoints ?? 0} onChange={update("lossPoints")} disabled={disabled} /></Field>
        <Field label="Walkover score"><input type="number" min="1" max="20" className={INPUT} value={draft.walkoverScore ?? 3} onChange={update("walkoverScore")} disabled={disabled} /><span className="mt-2 block text-[11px] font-semibold leading-5 text-slate-500">A home walkover becomes this score to nil; away walkovers are reversed.</span></Field>
      </div>
    );
  }

  if (type === "parent_club") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Parent club name" className="sm:col-span-2"><input className={INPUT} value={draft.name || ""} onChange={update("name")} disabled={disabled} placeholder="Horwich St Mary's FC" /></Field>
        <Field label="Short name"><input className={INPUT} value={draft.shortName || ""} onChange={update("shortName")} disabled={disabled} /></Field>
        <Field label="External reference"><input className={INPUT} value={draft.externalRef || ""} onChange={update("externalRef")} disabled={disabled} placeholder="Full-Time ID" /></Field>
        <Field label="Status" className="sm:col-span-2"><select className={INPUT} value={draft.status || "active"} onChange={update("status")} disabled={disabled}><option value="active">Active</option><option value="inactive">Inactive</option><option value="withdrawn">Withdrawn</option></select></Field>
      </div>
    );
  }

  if (type === "team") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Team name" className="sm:col-span-2"><input className={INPUT} value={draft.name || ""} onChange={update("name")} disabled={disabled} placeholder="Horwich St Mary's Reserves" /></Field>
        <Field label="Season"><select className={INPUT} value={draft.seasonId || ""} onChange={(event) => { const seasonId = event.target.value; setDraft((current) => ({ ...current, seasonId, divisionId: workspace.divisions.some((row) => row.id === current.divisionId && row.seasonId === seasonId) ? current.divisionId : "" })); }} disabled={disabled}><option value="">Select season</option>{workspace.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Division"><select className={INPUT} value={draft.divisionId || ""} onChange={update("divisionId")} disabled={disabled}><option value="">Select division</option>{workspace.divisions.filter((row) => !draft.seasonId || row.seasonId === draft.seasonId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Parent club"><select className={INPUT} value={draft.parentClubId || ""} onChange={update("parentClubId")} disabled={disabled}><option value="">Select parent club</option>{workspace.clubs.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Home venue"><select className={INPUT} value={draft.homeVenueId || ""} onChange={update("homeVenueId")} disabled={disabled}><option value="">Select venue</option>{workspace.venues.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Short name"><input className={INPUT} value={draft.shortName || ""} onChange={update("shortName")} disabled={disabled} /></Field>
        <Field label="External reference"><input className={INPUT} value={draft.externalRef || ""} onChange={update("externalRef")} disabled={disabled} /></Field>
        <Field label="Status" className="sm:col-span-2"><select className={INPUT} value={draft.status || "active"} onChange={update("status")} disabled={disabled}><option value="active">Active</option><option value="inactive">Inactive</option><option value="withdrawn">Withdrawn</option></select></Field>
      </div>
    );
  }

  if (type === "venue") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Venue name" className="sm:col-span-2"><input className={INPUT} value={draft.name || ""} onChange={update("name")} disabled={disabled} placeholder="Scholes Bank" /></Field>
        <Field label="Owning club"><select className={INPUT} value={draft.parentClubId || ""} onChange={update("parentClubId")} disabled={disabled}><option value="">League or neutral venue</option>{workspace.clubs.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Surface"><input className={INPUT} value={draft.surface || ""} onChange={update("surface")} disabled={disabled} placeholder="Grass / 3G" /></Field>
        <Field label="Address" className="sm:col-span-2"><input className={INPUT} value={draft.address || ""} onChange={update("address")} disabled={disabled} /></Field>
        <Field label="Postcode"><input className={INPUT} value={draft.postcode || ""} onChange={update("postcode")} disabled={disabled} /></Field>
        <Field label="Capacity"><input type="number" min="0" className={INPUT} value={draft.capacity ?? ""} onChange={update("capacity")} disabled={disabled} placeholder="Optional" /></Field>
        <Field label="Ground-share group"><input className={INPUT} value={draft.groundShareKey || ""} onChange={update("groundShareKey")} disabled={disabled} placeholder="Shared-ground-01" /></Field>
        <Field label="Simultaneous fixtures"><input type="number" min="1" max="20" className={INPUT} value={draft.simultaneousFixtureLimit ?? 1} onChange={update("simultaneousFixtureLimit")} disabled={disabled} /><span className="mt-2 block text-[11px] font-semibold leading-5 text-slate-500">Maximum fixtures this venue or shared-ground group can host at the same kick-off time.</span></Field>
        <Field label="Status"><select className={INPUT} value={draft.status || "active"} onChange={update("status")} disabled={disabled}><option value="active">Active</option><option value="inactive">Inactive</option><option value="unavailable">Unavailable</option></select></Field>
      </div>
    );
  }

  if (type === "blackout") {
    const scopeOptions = getBlackoutScopeOptions(workspace, draft.scopeType || "league");
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Season"><select className={INPUT} value={draft.seasonId || ""} onChange={update("seasonId")} disabled={disabled}><option value="">All seasons</option>{workspace.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Scope"><select className={INPUT} value={draft.scopeType || "league"} onChange={(event) => setDraft((current) => ({ ...current, scopeType: event.target.value, scopeId: "" }))} disabled={disabled}><option value="league">Whole league</option><option value="division">Division</option><option value="club">Parent club</option><option value="team">Team</option><option value="venue">Venue</option></select></Field>
        {draft.scopeType !== "league" ? <Field label="Applies to" className="sm:col-span-2"><select className={INPUT} value={draft.scopeId || ""} onChange={update("scopeId")} disabled={disabled}><option value="">Select record</option>{scopeOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field> : null}
        <Field label="Starts"><input type="date" className={INPUT} value={draft.startsOn || ""} onChange={update("startsOn")} disabled={disabled} /></Field>
        <Field label="Ends"><input type="date" className={INPUT} value={draft.endsOn || ""} onChange={update("endsOn")} disabled={disabled} /></Field>
        <Field label="Reason" className="sm:col-span-2"><input className={INPUT} value={draft.reason || ""} onChange={update("reason")} disabled={disabled} placeholder="County cup weekend, ground unavailable…" /></Field>
        <Field label="Source" className="sm:col-span-2"><select className={INPUT} value={draft.source || "manual"} onChange={update("source")} disabled={disabled}><option value="manual">Manual</option><option value="club_request">Club request</option><option value="league_rule">League rule</option><option value="import">Import</option></select></Field>
      </div>
    );
  }

  if (type === "playing_date") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Season"><select className={INPUT} value={draft.seasonId || ""} onChange={update("seasonId")} disabled={disabled}><option value="">Select season</option>{workspace.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Division"><select className={INPUT} value={draft.divisionId || ""} onChange={update("divisionId")} disabled={disabled}><option value="">Whole league</option>{workspace.divisions.filter((row) => !draft.seasonId || row.seasonId === draft.seasonId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Playing date"><input type="date" className={INPUT} value={draft.playingDate || ""} onChange={update("playingDate")} disabled={disabled} /></Field>
        <Field label="Default kick-off"><input type="time" className={INPUT} value={String(draft.defaultKickOff || "").slice(0, 5)} onChange={update("defaultKickOff")} disabled={disabled} /></Field>
        <Field label="Status"><select className={INPUT} value={draft.status || "available"} onChange={update("status")} disabled={disabled}><option value="available">Available</option><option value="reserved">Reserved</option><option value="closed">Closed</option></select></Field>
        <Field label="Notes"><input className={INPUT} value={draft.notes || ""} onChange={update("notes")} disabled={disabled} placeholder="Bank holiday round, cup reserve date…" /></Field>
      </div>
    );
  }

  if (type === "fixture") {
    const availableTeams = workspace.teams.filter((row) => !draft.seasonId || row.seasonId === draft.seasonId);
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Season"><select className={INPUT} value={draft.seasonId || ""} onChange={(event) => { const seasonId = event.target.value; setDraft((current) => ({ ...current, seasonId, divisionId: workspace.divisions.some((row) => row.id === current.divisionId && row.seasonId === seasonId) ? current.divisionId : "", homeTeamId: workspace.teams.some((row) => row.id === current.homeTeamId && row.seasonId === seasonId) ? current.homeTeamId : "", awayTeamId: workspace.teams.some((row) => row.id === current.awayTeamId && row.seasonId === seasonId) ? current.awayTeamId : "" })); }} disabled={disabled}><option value="">Select season</option>{workspace.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Division"><select className={INPUT} value={draft.divisionId || ""} onChange={(event) => { const divisionId = event.target.value; setDraft((current) => ({ ...current, divisionId, homeTeamId: workspace.teams.some((row) => row.id === current.homeTeamId && row.divisionId === divisionId) ? current.homeTeamId : "", awayTeamId: workspace.teams.some((row) => row.id === current.awayTeamId && row.divisionId === divisionId) ? current.awayTeamId : "" })); }} disabled={disabled}><option value="">Select division</option>{workspace.divisions.filter((row) => !draft.seasonId || row.seasonId === draft.seasonId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Home team"><select className={INPUT} value={draft.homeTeamId || ""} onChange={(event) => {
          const team = workspace.teams.find((row) => row.id === event.target.value);
          setDraft((current) => ({ ...current, homeTeamId: event.target.value, awayTeamId: current.awayTeamId === event.target.value ? "" : current.awayTeamId, divisionId: team?.divisionId || current.divisionId || "", venueId: team?.homeVenueId || current.venueId || "" }));
        }} disabled={disabled}><option value="">Select home team</option>{availableTeams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Away team"><select className={INPUT} value={draft.awayTeamId || ""} onChange={update("awayTeamId")} disabled={disabled}><option value="">Select away team</option>{availableTeams.filter((row) => row.id !== draft.homeTeamId && (!draft.divisionId || row.divisionId === draft.divisionId)).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Venue"><select className={INPUT} value={draft.venueId || ""} onChange={update("venueId")} disabled={disabled}><option value="">Unassigned</option>{workspace.venues.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Field label="Status"><select className={INPUT} value={draft.status || "draft"} onChange={update("status")} disabled={disabled}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="postponed">Postponed</option><option value="rearranged">Rearranged</option><option value="played">Played</option><option value="cancelled">Cancelled</option></select></Field>
        <Field label="Date"><input type="date" className={INPUT} value={draft.scheduledDate || ""} onChange={update("scheduledDate")} disabled={disabled} /></Field>
        <Field label="Kick-off"><input type="time" className={INPUT} value={String(draft.kickOff || "").slice(0, 5)} onChange={update("kickOff")} disabled={disabled} /></Field>
        <Field label="External fixture ID"><input className={INPUT} value={draft.externalRef || ""} onChange={update("externalRef")} disabled={disabled} /></Field>
        <label className="flex h-11 items-center gap-3 self-end rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700"><input type="checkbox" checked={Boolean(draft.locked)} onChange={update("locked")} disabled={disabled} /> Lock fixture</label>
        <Field label="Notes" className="sm:col-span-2"><textarea className={`${INPUT} h-24 resize-y py-3`} value={draft.notes || ""} onChange={update("notes")} disabled={disabled} /></Field>
      </div>
    );
  }

  return null;
}

function RegistryWorkspace({ type, workspace, itemsOverride = null, canEdit, busy, onSave, onDelete, onDirtyChange }) {
  const items = Array.isArray(itemsOverride) ? itemsOverride : entityItems(type, workspace);
  const initialDraft = useMemo(() => createDraft(type, workspace), [type, workspace]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(initialDraft);
  const [baseline, setBaseline] = useState(initialDraft);
  const dirty = canEdit && JSON.stringify(draft) !== JSON.stringify(baseline);
  const confirmLeave = useUnsavedChangesGuard(dirty, "This league record has unsaved changes. Discard them and continue?");

  useEffect(() => {
    const next = createDraft(type, workspace);
    setSelectedId("");
    setDraft(next);
    setBaseline(next);
  }, [type, workspace.league?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  const selectRecord = async (record) => {
    if (!(await confirmLeave())) return;
    const next = { ...record };
    setSelectedId(record.id);
    setDraft(next);
    setBaseline(next);
  };

  const startNew = async () => {
    if (!(await confirmLeave())) return;
    const next = createDraft(type, workspace);
    setSelectedId("");
    setDraft(next);
    setBaseline(next);
  };

  const titleMap = {
    season: "Season registry",
    division: "Division registry",
    parent_club: "Parent club registry",
    team: "Team registry",
    venue: "Venue registry",
    blackout: "Availability restrictions",
    playing_date: "Playing-date calendar",
    fixture: "Fixture registry",
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.85fr)_minmax(480px,1.4fr)]">
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-sm font-black text-slate-950">{titleMap[type]}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-slate-500"><span>{items.length} record{items.length === 1 ? "" : "s"}</span>{dirty ? <Badge tone="blue">Unsaved</Badge> : null}</div>
          </div>
          {canEdit ? <button type="button" onClick={startNew} className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white"><Plus size={14} /> Add</button> : null}
        </div>
        <div className="max-h-[620px] space-y-2 overflow-y-auto p-3">
          {!items.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">No records yet.</div>
          ) : items.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => selectRecord(row)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedId === row.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
            >
              <div className="truncate text-sm font-black">{registryTitle(type, row)}</div>
              <div className={`mt-1 truncate text-xs font-semibold ${selectedId === row.id ? "text-slate-300" : "text-slate-500"}`}>{registryMeta(type, row, workspace)}</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">{selectedId ? "Edit record" : "New record"}</div>
            <h3 className="mt-1 text-xl font-black text-slate-950">{selectedId ? registryTitle(type, draft) : `Add ${titleMap[type].replace(" registry", "").toLowerCase()}`}</h3>
          </div>
          {selectedId && canEdit ? <button type="button" onClick={async () => { const deleted = await onDelete(type, selectedId); if (deleted) startNew(); }} disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700"><Trash2 size={14} /> Delete</button> : null}
        </div>
        <div className="pt-5">
          <EntityEditorFields type={type} draft={draft} setDraft={setDraft} workspace={workspace} disabled={!canEdit || busy} />
          {canEdit ? (
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={async () => {
                const id = await onSave(type, draft);
                if (id) {
                  const saved = { ...draft, id: String(id) };
                  setSelectedId(String(id));
                  setDraft(saved);
                  setBaseline(saved);
                }
              }} disabled={busy} className={`${BUTTON} bg-emerald-600 text-white hover:bg-emerald-700`}>
                {busy ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                {selectedId ? "Save changes" : "Add record"}
              </button>
            </div>
          ) : <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">Your League Manager role is read only.</div>}
        </div>
      </Panel>
    </div>
  );
}

function CreatePilotCard({ platformContext, onCreated }) {
  const defaults = currentSeasonDefaults();
  const [form, setForm] = useState({ name: "", countryCode: "GB-ENG", governingBody: "", timezone: "Europe/London", seasonName: defaults.name, seasonStart: defaults.startsOn, seasonEnd: defaults.endsOn, defaultKickOff: "", primaryWeekday: 6 });
  const [busy, setBusy] = useState(false);
  const canCreate = platformContext?.isPlatformAdmin || platformContext?.platformRole === "admin";
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  if (!canCreate) {
    return (
      <Panel className="p-7">
        <div className="flex items-start gap-4">
          <LockKeyhole className="mt-1 shrink-0 text-slate-500" size={24} />
          <div><h2 className="text-xl font-black text-slate-950">No league workspace assigned</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">A League Manager administrator needs to invite this account before the pilot workspace can be opened.</p></div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-950 px-6 py-6 text-white sm:px-8">
        <Badge tone="green">Pilot foundation</Badge>
        <h2 className="mt-4 text-2xl font-black">Create the first League Manager workspace</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Start with the real league name and season. Divisions, parent clubs, teams, venues, blackout dates and fixtures are configured inside the secure workspace.</p>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
        <Field label="League name" className="sm:col-span-2"><input className={INPUT} value={form.name} onChange={update("name")} placeholder="Lancashire Amateur League" /></Field>
        <Field label="Country / home nation"><select className={INPUT} value={form.countryCode} onChange={update("countryCode")}><option value="GB-ENG">England</option><option value="GB-SCT">Scotland</option><option value="GB-WLS">Wales</option><option value="GB-NIR">Northern Ireland</option></select></Field>
        <Field label="Governing body"><input className={INPUT} value={form.governingBody} onChange={update("governingBody")} placeholder="Lancashire FA" /></Field>
        <Field label="Initial season"><input className={INPUT} value={form.seasonName} onChange={update("seasonName")} /></Field>
        <Field label="Timezone"><input className={INPUT} value={form.timezone} onChange={update("timezone")} /></Field>
        <Field label="Season starts"><input type="date" className={INPUT} value={form.seasonStart} onChange={update("seasonStart")} /></Field>
        <Field label="Season ends"><input type="date" className={INPUT} value={form.seasonEnd} onChange={update("seasonEnd")} /></Field>
        <Field label="League default kick-off"><input type="time" className={INPUT} value={form.defaultKickOff} onChange={update("defaultKickOff")} /><span className="mt-2 block text-[11px] font-semibold leading-5 text-slate-500">Required. This becomes the league-controlled default, not a system assumption.</span></Field>
        <Field label="Primary league day"><select className={INPUT} value={form.primaryWeekday} onChange={update("primaryWeekday")}><option value={6}>Saturday</option><option value={0}>Sunday</option><option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option></select></Field>
        <div className="sm:col-span-2 flex justify-end pt-2">
          <button type="button" disabled={busy || form.name.trim().length < 2 || !form.defaultKickOff} onClick={async () => {
            setBusy(true);
            try {
              const result = await DB.createLeaguePilot(form);
              toast.success("League Manager pilot created");
              await onCreated(result?.league_id || result?.leagueId || "");
            } catch (error) {
              toast.error("League pilot could not be created", { description: error?.message });
            } finally {
              setBusy(false);
            }
          }} className={`${BUTTON} bg-emerald-600 text-white hover:bg-emerald-700`}>
            {busy ? <RefreshCw className="animate-spin" size={16} /> : <Trophy size={16} />} Create pilot workspace
          </button>
        </div>
      </div>
    </Panel>
  );
}

export default function LeagueManagerPage({
  leagues = [],
  activeLeague = null,
  activeLeagueId = "",
  leagueStatus = "idle",
  leagueError = "",
  onRefreshLeagues,
  onSelectLeague,
  platformContext = null,
}) {
  const daxoraConfirm = useDaxoraConfirm();
  const [workspace, setWorkspace] = useState(null);
  const [operations, setOperations] = useState(() => normaliseLeagueOperationsData({}));
  const initialNavigation = useRef(readLeagueNavigation());
  const [workspaceStatus, setWorkspaceStatus] = useState("idle");
  const [workspaceError, setWorkspaceError] = useState("");
  const [tab, setTab] = useState(initialNavigation.current.tab);
  const [childView, setChildView] = useState(initialNavigation.current.child);
  const [commandSummary, setCommandSummary] = useState(null);
  const [navigationToken, setNavigationToken] = useState(0);
  const [structureSection, setStructureSection] = usePersistedWorkspaceState(`daxora:league:${activeLeagueId || "none"}:structure-section`, "season");
  const [venueSection, setVenueSection] = usePersistedWorkspaceState(`daxora:league:${activeLeagueId || "none"}:venue-section`, "venue");
  const [fixtureView, setFixtureView] = usePersistedWorkspaceState(`daxora:league:${activeLeagueId || "none"}:fixture-view`, "all");
  const [dirtyAreas, setDirtyAreas] = useState({});
  const [busy, setBusy] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "viewer" });
  const [lastInviteLink, setLastInviteLink] = useState("");
  const fileInputRef = useRef(null);
  const structureFileInputRef = useRef(null);
  const isClubPortal = ["club_secretary", "team_contact", "club_viewer"].includes(activeLeague?.role || "");

  const loadWorkspace = useCallback(async () => {
    if (!activeLeagueId) {
      setWorkspace(null);
      setOperations(normaliseLeagueOperationsData({}));
      setWorkspaceStatus("idle");
      setWorkspaceError("");
      return null;
    }
    setWorkspaceStatus("loading");
    setWorkspaceError("");
    try {
      if (isClubPortal) {
        const portalPayload = await DB.getLeagueClubPortalData(activeLeagueId);
        const nextPortal = normaliseLeagueClubPortalData(portalPayload);
        setWorkspace(nextPortal);
        setOperations(normaliseLeagueOperationsData({}));
        setWorkspaceStatus("ready");
        return nextPortal;
      }
      const [payload, operationsPayload] = await Promise.all([
        DB.getLeagueWorkspace(activeLeagueId),
        DB.getLeagueOperationsData(activeLeagueId),
      ]);
      const next = normaliseLeagueWorkspace(payload);
      setWorkspace(next);
      setOperations(normaliseLeagueOperationsData(operationsPayload));
      setWorkspaceStatus("ready");
      return next;
    } catch (error) {
      setWorkspace(null);
      setWorkspaceStatus("error");
      setWorkspaceError(error?.message || "The league workspace could not be loaded.");
      return null;
    }
  }, [activeLeagueId, isClubPortal]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const refreshOperations = useCallback(async () => {
    if (!activeLeagueId) return normaliseLeagueOperationsData({});
    const next = normaliseLeagueOperationsData(await DB.getLeagueOperationsData(activeLeagueId));
    setOperations(next);
    return next;
  }, [activeLeagueId]);

  const readiness = useMemo(() => getLeagueReadiness(workspace || {}), [workspace]);

  const setAreaDirty = useCallback((area, dirty) => {
    setDirtyAreas((current) => {
      if (Boolean(current[area]) === Boolean(dirty)) return current;
      const next = { ...current };
      if (dirty) next[area] = true;
      else delete next[area];
      return next;
    });
  }, []);

  const confirmAreaLeave = useCallback(async (area = tab) => {
    if (!dirtyAreas[area]) return true;
    return daxoraConfirm({
      title: "Discard unsaved League Manager changes?",
      description: "The changes in this workspace have not been saved and will be lost if you continue.",
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
      tone: "danger",
    });
  }, [confirm, dirtyAreas, tab]);

  const handleStructureDirty = useCallback((dirty) => setAreaDirty("structure", dirty), [setAreaDirty]);
  const handleAvailabilityDirty = useCallback((dirty) => setAreaDirty("availability", dirty), [setAreaDirty]);
  const handleFixturesDirty = useCallback((dirty) => setAreaDirty("fixtures", dirty), [setAreaDirty]);
  const handleScheduleDirty = useCallback((dirty) => setAreaDirty("schedule", dirty), [setAreaDirty]);

  const navigateLeague = useCallback(async (nextTab, nextChild = "", options = {}) => {
    if (!TAB_LOOKUP.has(nextTab)) return;
    if ((nextTab !== tab || nextChild !== childView) && !(await confirmAreaLeave(tab))) return;
    setTab(nextTab);
    setChildView(nextChild);
    setNavigationToken((current) => current + 1);
    writeLeagueNavigation(nextTab, nextChild, options);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  }, [childView, confirmAreaLeave, tab]);

  useEffect(() => {
    const handleHistoryNavigation = async () => {
      if (!(await confirmAreaLeave(tab))) {
        writeLeagueNavigation(tab, childView, { replace: true });
        return;
      }
      const next = readLeagueNavigation();
      setTab(next.tab);
      setChildView(next.child);
      setNavigationToken((current) => current + 1);
    };
    window.addEventListener?.("popstate", handleHistoryNavigation);
    return () => window.removeEventListener?.("popstate", handleHistoryNavigation);
  }, [childView, confirmAreaLeave, tab]);

  useEffect(() => {
    if (tab === "structure" && STRUCTURE_SECTIONS.some(([key]) => key === childView)) setStructureSection(childView);
    if (tab === "availability" && VENUE_SECTIONS.some(([key]) => key === childView)) setVenueSection(childView);
    if (tab === "fixtures" && FIXTURE_VIEWS.some(([key]) => key === childView)) setFixtureView(childView);
  }, [childView, setFixtureView, setStructureSection, setVenueSection, tab]);

  const canViewDiscipline = ["owner", "admin", "discipline"].includes(workspace?.access?.role || "");
  const canViewRegistrations = ["owner", "admin", "registrations"].includes(workspace?.access?.role || "");

  useEffect(() => {
    if (!workspace || isClubPortal) return;
    const authorised = tab !== "discipline" && tab !== "registrations"
      || (tab === "discipline" && canViewDiscipline)
      || (tab === "registrations" && canViewRegistrations);
    if (authorised) return;
    setTab("overview");
    setChildView("");
    writeLeagueNavigation("overview", "", { replace: true });
  }, [canViewDiscipline, canViewRegistrations, isClubPortal, tab, workspace]);

  const visibleNavGroups = NAV_GROUPS.map(([groupKey, label, Icon, tabKeys]) => [
    groupKey,
    label,
    Icon,
    tabKeys.filter((tabKey) => (
      (tabKey !== "discipline" || canViewDiscipline)
      && (tabKey !== "registrations" || canViewRegistrations)
    )),
  ]).filter(([, , , tabKeys]) => tabKeys.length > 0);
  const activeGroup = TAB_GROUP.get(tab) || "command-centre";
  const activeGroupDefinition = visibleNavGroups.find(([groupKey]) => groupKey === activeGroup) || visibleNavGroups[0];
  const activeGroupTabs = activeGroupDefinition[3].map((tabKey) => TAB_LOOKUP.get(tabKey)).filter(Boolean);

  const changeRegistrySection = async (area, setter, nextValue) => {
    if (!(await confirmAreaLeave(area))) return;
    setter(nextValue);
    setChildView(nextValue);
    writeLeagueNavigation(area, nextValue, { replace: true });
  };

  const saveEntity = async (type, draft) => {
    if (!workspace || !activeLeagueId) return null;
    const data = serialiseLeagueEntity(type, draft);
    if (["season", "division", "parent_club", "team", "venue"].includes(type) && !data.name) {
      toast.error("A name is required");
      return null;
    }
    if (type === "season" && (!data.starts_on || !data.ends_on || !data.default_kick_off)) {
      toast.error("Season dates and the league default kick-off are required");
      return null;
    }
    if (type === "fixture" && (!data.home_team_id || !data.away_team_id)) {
      toast.error("Select both teams");
      return null;
    }
    if (type === "blackout" && (!data.starts_on || !data.reason)) {
      toast.error("Add the blackout date and reason");
      return null;
    }
    if (type === "playing_date" && (!data.season_id || !data.playing_date)) {
      toast.error("Select the season and playing date");
      return null;
    }

    setBusy(true);
    try {
      const id = await DB.upsertLeagueEntity(activeLeagueId, type, data);
      if (type === "venue" && id) {
        await DB.setLeagueVenueSchedulingCapacity(activeLeagueId, id, data.simultaneous_fixture_limit || 1);
      }
      await loadWorkspace();
      toast.success("League record saved");
      return id;
    } catch (error) {
      toast.error("League record could not be saved", { description: error?.message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const deleteEntity = async (type, id) => {
    if (!(await daxoraConfirm({ title: "Delete league record?", description: "This record will be removed. Linked fixtures, registrations or competition records may prevent deletion.", confirmLabel: "Delete record", tone: "danger" }))) return false;
    setBusy(true);
    try {
      await DB.deleteLeagueEntity(activeLeagueId, type, id);
      await loadWorkspace();
      toast.success("League record deleted");
      return true;
    } catch (error) {
      toast.error("Record could not be deleted", { description: error?.message || "Remove linked records first." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handlePilotCreated = async (leagueId) => {
    const nextLeagues = await onRefreshLeagues?.();
    if (leagueId) onSelectLeague?.(leagueId, nextLeagues);
  };

  if (["idle", "loading"].includes(leagueStatus)) return <LoadingCard label="league access" />;
  if (leagueStatus === "error") return <ErrorCard error={leagueError} onRetry={onRefreshLeagues} />;
  if (!activeLeagueId) return <CreatePilotCard platformContext={platformContext} onCreated={handlePilotCreated} />;
  if (workspaceStatus === "loading" || !workspace) {
    if (workspaceStatus === "error") return <ErrorCard error={workspaceError} onRetry={loadWorkspace} />;
    return <LoadingCard />;
  }

  if (isClubPortal) {
    return <LeagueClubPortalPage leagueId={activeLeagueId} portal={workspace} onRefresh={loadWorkspace} />;
  }

  const canManage = workspace.access.canManage;
  const canOperate = workspace.access.canOperate;
  const league = workspace.league;
  const visibleFixtures = fixtureView === "postponed"
    ? workspace.fixtures.filter((fixture) => fixture.status === "postponed")
    : fixtureView === "unplaced"
      ? workspace.fixtures.filter((fixture) => !fixture.scheduledDate)
      : workspace.fixtures;

  const downloadStructureTemplate = () => {
    const text = "division,division_code,parent_club,club_short_name,club_external_ref,team,team_short_name,team_external_ref,home_venue,address,postcode,surface,ground_share_key\nPremier Division,PREM,Example FC,Example,CLUB-001,Example First,Example,FIRST-001,Example Ground,1 Football Road,BL1 1AA,Grass,GROUND-01";
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "league-manager-setup-import-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const importStructureCsv = async (file) => {
    if (!file) return;
    const currentSeason = getCurrentLeagueSeason(workspace);
    if (!currentSeason) {
      toast.error("Create a current season before importing league setup");
      return;
    }
    const parsed = parseLeagueStructureCsv(await file.text());
    if (parsed.errors.length) {
      toast.error("Setup CSV needs attention", { description: parsed.errors.slice(0, 5).join(" ") });
      return;
    }
    setBusy(true);
    try {
      const result = await DB.importLeagueStructure(activeLeagueId, currentSeason.id, parsed.records);
      await DB.resequenceLeagueDivisions(activeLeagueId, currentSeason.id);
      await loadWorkspace();
      toast.success(`${Number(result?.rows || parsed.records.length)} team rows imported`, {
        description: `${Number(result?.clubs_created || 0)} clubs, ${Number(result?.venues_created || 0)} venues and ${Number(result?.teams_created || 0)} new teams created.`,
      });
    } catch (error) {
      toast.error("League setup import failed", { description: error?.message || "No setup records were changed." });
    } finally {
      setBusy(false);
      if (structureFileInputRef.current) structureFileInputRef.current.value = "";
    }
  };

  const downloadCsvTemplate = () => {
    const configuredKickOff = String(getCurrentLeagueSeason(workspace)?.defaultKickOff || "").slice(0, 5);
    const text = `division,home_team,away_team,date,kick_off,venue,status,external_ref,locked,notes\nPremier Division,Home Team,Away Team,2026-08-15,${configuredKickOff},Home Ground,draft,FIX-001,false,`;
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "league-manager-fixture-import-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseLeagueFixtureCsv(text, workspace);
    if (parsed.errors.length) {
      toast.error("CSV import needs attention", { description: parsed.errors.slice(0, 4).join(" ") });
      return;
    }
    if (!parsed.records.length) {
      toast.error("No valid fixture rows were found");
      return;
    }
    setBusy(true);
    let imported = 0;
    try {
      const result = await DB.importLeagueFixtures(activeLeagueId, parsed.records);
      imported = Number(result?.fixtures || parsed.records.length);
      await loadWorkspace();
      toast.success(`${imported} fixture${imported === 1 ? "" : "s"} imported`);
    } catch (error) {
      toast.error("Fixture import failed", { description: error?.message || "No fixtures were changed." });
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const createInvite = async () => {
    setBusy(true);
    try {
      const invitation = await DB.createLeagueInvitation(activeLeagueId, inviteForm);
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set("league_invite", invitation.token);
      setLastInviteLink(url.toString());
      setInviteForm({ email: "", role: "viewer" });
      await loadWorkspace();
      toast.success("League invitation created", { description: "Copy the secure invitation link and send it to the named user." });
    } catch (error) {
      toast.error("Invitation could not be created", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <Panel className="overflow-hidden">
        <div className="grid gap-6 bg-slate-950 px-6 py-7 text-white lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <div className="flex flex-wrap items-center gap-2"><Badge tone="green">League Manager</Badge><Badge tone="navy">{league.productStatus || "pilot"}</Badge><Badge tone={workspace.access.readOnly ? "amber" : "blue"}>{workspace.access.role.replaceAll("_", " ")}</Badge></div>
            <h1 className="mt-4 text-3xl font-black tracking-tight">{league.name || activeLeague?.name || "League workspace"}</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Fixtures, competitions, clubs, results, officials and governance in one secure league operations workspace.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
            {leagues.length > 1 ? <select className="h-11 min-w-[240px] rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-black text-white outline-none" value={activeLeagueId} onChange={(event) => onSelectLeague?.(event.target.value)}>{leagues.map((row) => <option key={row.leagueId} value={row.leagueId} className="text-slate-950">{row.name}</option>)}</select> : null}
            <button type="button" onClick={async () => { await onRefreshLeagues?.(); await loadWorkspace(); }} className={`${BUTTON} border border-white/15 bg-white/10 text-white hover:bg-white/15`}><RefreshCw size={16} /> Refresh workspace</button>
          </div>
        </div>
        <div className="grid gap-3 border-t border-white/10 bg-slate-900 px-6 py-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div className="text-xs font-bold text-slate-300"><span className="text-slate-500">Current season</span><div className="mt-1 text-sm font-black text-white">{readiness.season?.name || "Not configured"}</div></div>
          <div className="text-xs font-bold text-slate-300"><span className="text-slate-500">Home nation</span><div className="mt-1 text-sm font-black text-white">{league.countryCode || "GB-ENG"}</div></div>
          <div className="text-xs font-bold text-slate-300"><span className="text-slate-500">Governing body</span><div className="mt-1 text-sm font-black text-white">{league.governingBody || "Not recorded"}</div></div>
          <div className="text-xs font-bold text-slate-300"><span className="text-slate-500">Configuration readiness</span><div className="mt-1 text-sm font-black text-white">{readiness.percentage}%</div></div>
        </div>
      </Panel>

      <LeagueCommandSearch workspace={workspace} operations={operations} onNavigate={navigateLeague} />

      <nav aria-label="League Manager workspaces" className="rounded-[24px] border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {visibleNavGroups.map(([groupKey, label, Icon, tabKeys]) => {
            const selected = activeGroup === groupKey;
            return <button key={groupKey} type="button" onClick={() => navigateLeague(tabKeys[0])} aria-current={selected ? "page" : undefined} className={`flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-black transition ${selected ? "bg-slate-950 text-white shadow-sm" : "border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"}`}><Icon size={16} className={`shrink-0 ${selected ? "text-emerald-300" : "text-slate-400"}`} /><span className="min-w-0 leading-4">{label}</span></button>;
          })}
        </div>
        {activeGroupTabs.length > 1 ? <div className="mt-2 flex gap-2 overflow-x-auto border-t border-slate-100 pt-2 [scrollbar-width:thin]">{activeGroupTabs.map(([key, label]) => { const count = tabQueueCount(key, commandSummary?.counts); return <button key={key} type="button" onClick={() => navigateLeague(key)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${tab === key ? "bg-emerald-50 text-emerald-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><span>{label}</span>{count > 0 ? <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] ${tab === key ? "bg-emerald-200 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>{count > 99 ? "99+" : count}</span> : null}</button>; })}</div> : null}
      </nav>

      {tab === "overview" ? (
        <LeagueCommandCentreWorkspace
          leagueId={activeLeagueId}
          workspace={workspace}
          operations={operations}
          readiness={readiness}
          onNavigate={navigateLeague}
          onRefreshOperations={refreshOperations}
          onSummaryChange={setCommandSummary}
        />
      ) : null}

      {tab === "analytics" ? (
        <LeagueAnalyticsWorkspace
          leagueId={activeLeagueId}
          workspace={workspace}
          operations={operations}
          initialTab={childView || "executive"}
          focusToken={navigationToken}
        />
      ) : null}

      {tab === "command" ? (
        <LeagueFixtureCommandWorkspace
          leagueId={activeLeagueId}
          workspace={workspace}
          operations={operations}
          canManage={canManage}
          onRefreshOperations={refreshOperations}
          initialView={childView || "calendar"}
          focusToken={navigationToken}
        />
      ) : null}

      {tab === "structure" ? (
        <div className="space-y-5">
          <Panel className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Upload size={22} /></span><div><h2 className="text-xl font-black text-slate-950">Bulk league setup</h2><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">Load divisions, parent clubs, teams, home grounds and ground-share groups from one CSV. Existing names are matched safely and the whole import rolls back if any row fails.</p></div></div>
              <div className="flex flex-wrap gap-2"><button type="button" onClick={downloadStructureTemplate} className={`${BUTTON} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`}><FileSpreadsheet size={16} /> Download template</button><button type="button" disabled={!canManage || busy || !readiness.season} onClick={() => structureFileInputRef.current?.click()} className={`${BUTTON} bg-emerald-600 text-white`}><Upload size={16} /> Import setup CSV</button><input ref={structureFileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => importStructureCsv(event.target.files?.[0])} /></div>
            </div>
          </Panel>
          <SectionTabs items={STRUCTURE_SECTIONS} value={structureSection} onChange={(value) => changeRegistrySection("structure", setStructureSection, value)} />
          <RegistryWorkspace type={structureSection} workspace={workspace} canEdit={canManage} busy={busy} onSave={saveEntity} onDelete={deleteEntity} onDirtyChange={handleStructureDirty} />
        </div>
      ) : null}

      {tab === "availability" ? <div className="space-y-5"><SectionTabs items={VENUE_SECTIONS} value={venueSection} onChange={(value) => changeRegistrySection("availability", setVenueSection, value)} /><RegistryWorkspace type={venueSection} workspace={workspace} canEdit={venueSection === "blackout" ? canOperate : canManage} busy={busy} onSave={saveEntity} onDelete={deleteEntity} onDirtyChange={handleAvailabilityDirty} /></div> : null}

      {tab === "fixtures" ? (
        <div className="space-y-5">
          <Panel className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><FileSpreadsheet size={23} /></span><div><h2 className="text-xl font-black text-slate-950">Fixture CSV import</h2><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">Import existing league fixtures without waiting for the generation engine. Team, division and venue names are matched against this workspace and invalid rows are rejected before any write.</p></div></div>
              <div className="flex flex-wrap gap-2"><button type="button" onClick={downloadCsvTemplate} className={`${BUTTON} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`}><FileSpreadsheet size={16} /> Download template</button><button type="button" disabled={!canOperate || busy} onClick={() => fileInputRef.current?.click()} className={`${BUTTON} bg-slate-950 text-white`}><Upload size={16} /> Import CSV</button><input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => importCsv(event.target.files?.[0])} /></div>
            </div>
          </Panel>
          <SectionTabs items={FIXTURE_VIEWS} value={fixtureView} onChange={(value) => changeRegistrySection("fixtures", setFixtureView, value)} />
          <RegistryWorkspace type="fixture" workspace={workspace} itemsOverride={visibleFixtures} canEdit={canOperate} busy={busy} onSave={saveEntity} onDelete={deleteEntity} onDirtyChange={handleFixturesDirty} />
        </div>
      ) : null}


      {tab === "schedule" ? (
        <LeagueScheduleWorkspace
          leagueId={activeLeagueId}
          workspace={workspace}
          canOperate={canOperate}
          onWorkspaceRefresh={loadWorkspace}
          onDirtyChange={handleScheduleDirty}
        />
      ) : null}



      {tab === "cups" ? (
        <LeagueCupWorkspace
          leagueId={activeLeagueId}
          workspace={workspace}
          canOperate={canOperate}
          onWorkspaceRefresh={loadWorkspace}
        />
      ) : null}

      {tab === "officials" ? (
        <LeagueOfficialsWorkspace
          leagueId={activeLeagueId}
          workspace={workspace}
          operations={operations}
          canEdit={operations.access.canManageOfficials || canManage}
          onRefreshOperations={refreshOperations}
          initialTab={childView || "pool"}
          focusToken={navigationToken}
        />
      ) : null}

      {tab === "clubs" ? (
        <LeagueClubOperationsWorkspace
          leagueId={activeLeagueId}
          workspace={workspace}
          canManage={canManage}
          canOperate={canOperate}
          operations={operations}
          initialView={childView || "publication"}
          focusToken={navigationToken}
        />
      ) : null}

      {tab === "results" ? (
        <LeagueResultsWorkspace
          leagueId={activeLeagueId}
          workspace={workspace}
          initialTab={childView || "command"}
          focusToken={navigationToken}
        />
      ) : null}

      {tab === "registrations" && canViewRegistrations ? (
        <LeagueRegistrationsWorkspace
          leagueId={activeLeagueId}
          workspace={workspace}
          initialTab={childView || "command"}
          focusToken={navigationToken}
        />
      ) : null}

      {tab === "discipline" && canViewDiscipline ? (
        <LeagueDisciplineWorkspace
          leagueId={activeLeagueId}
          workspace={workspace}
          initialTab={childView || "command"}
          focusToken={navigationToken}
        />
      ) : null}

      {tab === "access" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel className="p-6">
            <div className="flex items-center gap-3"><ShieldCheck className="text-emerald-600" size={22} /><div><h2 className="text-xl font-black text-slate-950">League access</h2><p className="mt-1 text-sm font-semibold text-slate-500">Roles are separate from Ground Control club permissions.</p></div></div>
            <div className="mt-5 space-y-3">{workspace.members.map((member) => <div key={member.userId} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="truncate text-sm font-black text-slate-950">{member.displayName || member.email || "League member"}</div><div className="mt-1 truncate text-xs font-semibold text-slate-500">{member.email || "Email unavailable"}</div></div><div className="flex items-center gap-2">{canManage && member.role !== "owner" ? <select className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-black" value={member.role} disabled={busy} onChange={async (event) => { setBusy(true); try { await DB.updateLeagueMemberRole(activeLeagueId, member.userId, event.target.value); await loadWorkspace(); toast.success("League role updated"); } catch (error) { toast.error("Role could not be updated", { description: error?.message }); } finally { setBusy(false); } }}><option value="admin">Administrator</option><option value="fixtures">Fixture secretary</option><option value="officials">Referee appointments secretary</option><option value="results">Results secretary</option><option value="discipline">Discipline officer</option><option value="registrations">Registration secretary</option><option value="viewer">Viewer</option></select> : <Badge tone={member.role === "owner" ? "navy" : "slate"}>{member.role}</Badge>}{canManage && member.role !== "owner" ? <button type="button" aria-label="Remove member" onClick={async () => { if (!(await daxoraConfirm({ title: "Remove League Manager access?", description: "This user will immediately lose access to this league workspace.", confirmLabel: "Remove access", tone: "danger" }))) return; setBusy(true); try { await DB.removeLeagueMember(activeLeagueId, member.userId); await loadWorkspace(); toast.success("League member removed"); } catch (error) { toast.error("Member could not be removed", { description: error?.message }); } finally { setBusy(false); } }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700"><Trash2 size={14} /></button> : null}</div></div>)}</div>
            {canManage ? <div className="mt-6 border-t border-slate-200 pt-6"><h3 className="text-sm font-black text-slate-950">Invite a league user</h3><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_150px_auto]"><input type="email" className={INPUT} value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="secretary@league.org" /><select className={INPUT} value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}><option value="admin">Administrator</option><option value="fixtures">Fixture secretary</option><option value="officials">Referee appointments secretary</option><option value="results">Results secretary</option><option value="discipline">Discipline officer</option><option value="registrations">Registration secretary</option><option value="viewer">Viewer</option></select><button type="button" onClick={createInvite} disabled={busy || !inviteForm.email.includes("@")} className={`${BUTTON} bg-emerald-600 text-white`}><Plus size={16} /> Invite</button></div>{lastInviteLink ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-black text-emerald-900">Secure invitation link</div><div className="mt-2 flex gap-2"><input readOnly className={`${INPUT} min-w-0 bg-white`} value={lastInviteLink} /><button type="button" onClick={async () => { await navigator.clipboard.writeText(lastInviteLink); toast.success("Invitation link copied"); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><ClipboardCopy size={16} /></button></div></div> : null}</div> : null}
            {workspace.invitations.length ? <div className="mt-6 border-t border-slate-200 pt-6"><h3 className="text-sm font-black text-slate-950">Invitation history</h3><div className="mt-3 space-y-2">{workspace.invitations.slice(0, 10).map((invitation) => <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3"><div className="min-w-0"><div className="truncate text-xs font-black text-slate-900">{invitation.email}</div><div className="mt-0.5 text-[11px] font-semibold text-slate-500">{invitation.role} · {invitation.status}</div></div>{canManage && invitation.status === "pending" ? <button type="button" onClick={async () => { setBusy(true); try { await DB.revokeLeagueInvitation(activeLeagueId, invitation.id); await loadWorkspace(); toast.success("Invitation revoked"); } catch (error) { toast.error("Invitation could not be revoked", { description: error?.message }); } finally { setBusy(false); } }} className="text-xs font-black text-rose-700">Revoke</button> : null}</div>)}</div></div> : null}
          </Panel>

          <Panel className="p-6">
            <div className="flex items-center gap-3"><LockKeyhole className="text-slate-700" size={22} /><div><h2 className="text-xl font-black text-slate-950">Audit history</h2><p className="mt-1 text-sm font-semibold text-slate-500">Latest server-recorded League Manager actions.</p></div></div>
            <div className="mt-5 space-y-3">{workspace.audit.length ? workspace.audit.map((event) => <div key={event.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-black text-slate-950">{String(event.action || "league.action").replaceAll("league.", "").replaceAll("_", " ")}</div><div className="text-[11px] font-bold text-slate-400">{event.createdAt ? new Date(event.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : ""}</div></div><div className="mt-2 text-xs font-semibold text-slate-500">{event.actorLabel || "Authenticated user"} · {String(event.actorRole || "member").replaceAll("_", " ")}</div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">No league audit events yet.</div>}</div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
