import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Filter,
  Grid3X3,
  List,
  Map as MapIcon,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import LeagueVenueMap from "./LeagueVenueMap.jsx";
import { DB } from "../../lib/supabase.js";
import { usePersistedWorkspaceState } from "../../hooks/usePersistedWorkspaceState.js";
import { normaliseScheduleVersion, normaliseScheduleVersionPayload } from "../../lib/league/leagueSchedulingEngine.js";
import {
  buildLeagueOperationalFixtures,
  getFixtureOfficialRequirement,
  getLeagueOfficialCoverage,
  getRequiredOfficialRoles,
  ROLE_LABELS,
} from "../../lib/league/leagueOperationsEngine.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const VIEWS = [
  ["calendar", "Calendar", CalendarDays],
  ["grid", "Season grid", Grid3X3],
  ["map", "Venue map", MapIcon],
  ["list", "Fixture list", List],
  ["exceptions", "Exceptions", ShieldAlert],
];

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    navy: "border-slate-950 bg-slate-950 text-white",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.11em] ${tones[tone] || tones.slate}`}>{children}</span>;
}

function Metric({ label, value, detail, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}><div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="mt-1 text-2xl font-black text-slate-950">{value}</div>{detail ? <div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div> : null}</div>;
}

function dateLabel(value, options = {}) {
  if (!value) return "Unplaced";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", options);
}

function startOfMonth(value) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isoDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function monthCells(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function fixtureAssignmentSummary(fixture, operations) {
  const requirement = getFixtureOfficialRequirement(fixture, operations.requirements);
  const roles = getRequiredOfficialRoles(requirement);
  const assigned = roles.filter((role) => operations.assignments.some((row) => row.targetType === fixture.targetType && row.targetId === fixture.targetId && row.role === role && !["declined", "withdrawn"].includes(row.status)));
  return { required: roles.length, assigned: assigned.length, complete: roles.length === assigned.length };
}

function FixtureLine({ fixture, operations, compact = false, onSelect }) {
  const coverage = fixtureAssignmentSummary(fixture, operations);
  return (
    <button type="button" onClick={() => onSelect?.(fixture)} className={`w-full rounded-xl border border-slate-200 bg-white text-left transition hover:border-slate-300 hover:shadow-sm ${compact ? "px-2.5 py-2" : "p-3"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`${compact ? "text-[11px]" : "text-xs"} truncate font-black text-slate-950`}>{fixture.homeTeamName} <span className="text-slate-400">v</span> {fixture.awayTeamName}</div>
          <div className="mt-1 truncate text-[10px] font-bold text-slate-500">{fixture.kickOff || "TBC"} · {fixture.venueName}</div>
        </div>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${coverage.complete ? "bg-emerald-500" : "bg-amber-500"}`} title={`${coverage.assigned}/${coverage.required} official roles filled`} />
      </div>
    </button>
  );
}

function FixtureDrawer({ fixture, operations, onClose }) {
  if (!fixture) return null;
  const requirement = getFixtureOfficialRequirement(fixture, operations.requirements);
  const roles = getRequiredOfficialRoles(requirement);
  const officialName = (id) => operations.officials.find((row) => row.id === id)?.name || "Official";
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/30 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><Pill tone={fixture.competitionType === "cup" ? "amber" : "blue"}>{fixture.competitionName}</Pill><h3 className="mt-3 text-2xl font-black text-slate-950">{fixture.homeTeamName} v {fixture.awayTeamName}</h3><p className="mt-2 text-sm font-semibold text-slate-500">{dateLabel(fixture.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {fixture.kickOff || "Kick-off TBC"}</p></div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Close</button></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><Metric label="Venue" value={fixture.venueName} /><Metric label="Status" value={fixture.status || fixture.placementStatus} /></div>
        <div className="mt-6 rounded-2xl border border-slate-200 p-4"><div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Match officials</div><div className="mt-3 space-y-2">{roles.length ? roles.map((role) => { const assignment = operations.assignments.find((row) => row.targetType === fixture.targetType && row.targetId === fixture.targetId && row.role === role && !["declined", "withdrawn"].includes(row.status)); return <div key={role} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"><span className="text-xs font-black text-slate-700">{ROLE_LABELS[role]}</span>{assignment ? <span className="text-xs font-black text-emerald-700">{officialName(assignment.officialId)} · {assignment.status}</span> : <span className="text-xs font-black text-amber-700">Unassigned</span>}</div>; }) : <div className="text-sm font-semibold text-slate-500">No official requirement has been configured.</div>}</div></div>
        <div className="mt-6 rounded-2xl border border-slate-200 p-4"><div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Operational flags</div><div className="mt-3 flex flex-wrap gap-2">{fixture.locked ? <Pill tone="navy">Locked</Pill> : null}{!fixture.date ? <Pill tone="rose">Unplaced</Pill> : null}{!fixture.venueId ? <Pill tone="rose">No venue</Pill> : null}{fixture.status === "postponed" ? <Pill tone="rose">Postponed</Pill> : null}{roles.length && !fixtureAssignmentSummary(fixture, operations).complete ? <Pill tone="amber">Officials incomplete</Pill> : null}</div></div>
      </aside>
    </div>
  );
}

function CalendarView({ fixtures, month, setMonth, operations, onSelect }) {
  const cells = monthCells(month);
  const grouped = useMemo(() => fixtures.reduce((map, fixture) => { if (!fixture.date) return map; const rows = map.get(fixture.date) || []; rows.push(fixture); map.set(fixture.date, rows); return map; }, new globalThis.Map()), [fixtures]);
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-4"><div><div className="text-lg font-black text-slate-950">{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div><div className="text-xs font-semibold text-slate-500">League and cup fixtures share one operational calendar.</div></div><div className="flex gap-2"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><ChevronLeft size={17} /></button><button type="button" onClick={() => setMonth(startOfMonth())} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}>Today</button><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><ChevronRight size={17} /></button></div></div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{day}</div>)}</div>
      <div className="grid grid-cols-7">{cells.map((date) => { const key = isoDate(date); const rows = grouped.get(key) || []; const inside = date.getMonth() === month.getMonth(); return <div key={key} className={`min-h-[150px] border-b border-r border-slate-100 p-2 ${inside ? "bg-white" : "bg-slate-50/60"}`}><div className={`text-xs font-black ${inside ? "text-slate-700" : "text-slate-300"}`}>{date.getDate()}</div><div className="mt-2 space-y-1.5">{rows.slice(0, 4).map((fixture) => <FixtureLine key={`${fixture.targetType}-${fixture.targetId}`} fixture={fixture} operations={operations} compact onSelect={onSelect} />)}{rows.length > 4 ? <div className="px-2 text-[10px] font-black text-slate-500">+{rows.length - 4} more</div> : null}</div></div>; })}</div>
    </Panel>
  );
}

function SeasonGridView({ fixtures, workspace, operations, onSelect }) {
  const dates = [...new Set(fixtures.filter((row) => row.date).map((row) => row.date))].sort();
  const [offset, setOffset] = useState(0);
  const visibleDates = dates.slice(offset, offset + 12);
  const activeTeams = workspace.teams.filter((team) => !["inactive", "withdrawn"].includes(team.status));
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-lg font-black text-slate-950">Season grid</div><div className="text-xs font-semibold text-slate-500">Spot fixture gaps, long home/away sequences, cups and missing officials across the season.</div></div><div className="flex items-center gap-2"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 12))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="text-xs font-black text-slate-600">{dates.length ? `${offset + 1}–${Math.min(offset + 12, dates.length)} of ${dates.length} dates` : "No dates"}</span><button type="button" disabled={offset + 12 >= dates.length} onClick={() => setOffset(offset + 12)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
      <div className="overflow-x-auto"><table className="min-w-full border-collapse text-xs"><thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 min-w-[230px] border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-left font-black text-slate-700">Team</th>{visibleDates.map((date) => <th key={date} className="min-w-[92px] border-b border-r border-slate-200 px-2 py-3 text-center font-black text-slate-600">{dateLabel(date, { day: "2-digit", month: "short" })}</th>)}</tr></thead><tbody>{activeTeams.map((team) => <tr key={team.id}><th className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-2 text-left font-black text-slate-800">{team.name}</th>{visibleDates.map((date) => { const fixture = fixtures.find((row) => row.date === date && [row.homeTeamId, row.awayTeamId].includes(team.id)); if (!fixture) return <td key={date} className="border-b border-r border-slate-100 p-1 text-center text-slate-200">—</td>; const home = fixture.homeTeamId === team.id; const officialComplete = fixtureAssignmentSummary(fixture, operations).complete; return <td key={date} className="border-b border-r border-slate-100 p-1"><button type="button" onClick={() => onSelect(fixture)} className={`w-full rounded-lg px-1.5 py-2 text-center text-[10px] font-black ${fixture.competitionType === "cup" ? "bg-amber-100 text-amber-900" : home ? "bg-emerald-100 text-emerald-900" : "bg-sky-100 text-sky-900"}`}><div>{fixture.competitionType === "cup" ? "CUP" : home ? "H" : "A"}</div><div className="mt-0.5 truncate opacity-70">{home ? fixture.awayTeamName : fixture.homeTeamName}</div>{!officialComplete ? <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-rose-500" /> : null}</button></td>; })}</tr>)}</tbody></table></div>
    </Panel>
  );
}

function ListView({ fixtures, operations, onSelect }) {
  const grouped = fixtures.reduce((map, fixture) => { const key = fixture.date || "unplaced"; const rows = map.get(key) || []; rows.push(fixture); map.set(key, rows); return map; }, new globalThis.Map());
  return <div className="space-y-4">{[...grouped.entries()].map(([date, rows]) => <Panel key={date} className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><div className="text-sm font-black text-slate-900">{date === "unplaced" ? "Unplaced fixtures" : dateLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div><Pill tone={date === "unplaced" ? "rose" : "slate"}>{rows.length}</Pill></div><div className="divide-y divide-slate-100">{rows.map((fixture) => { const coverage = fixtureAssignmentSummary(fixture, operations); return <button type="button" key={`${fixture.targetType}-${fixture.targetId}`} onClick={() => onSelect(fixture)} className="grid w-full gap-2 px-4 py-3 text-left hover:bg-slate-50 sm:grid-cols-[90px_minmax(260px,1.5fr)_minmax(180px,1fr)_150px_120px] sm:items-center"><div className="text-xs font-black text-slate-700">{fixture.kickOff || "TBC"}</div><div><div className="text-sm font-black text-slate-950">{fixture.homeTeamName} <span className="text-slate-400">v</span> {fixture.awayTeamName}</div><div className="mt-0.5 text-[10px] font-bold text-slate-500">{fixture.competitionName}</div></div><div className="truncate text-xs font-bold text-slate-600">{fixture.venueName}</div><Pill tone={fixture.competitionType === "cup" ? "amber" : "blue"}>{fixture.competitionType}</Pill><Pill tone={coverage.complete ? "green" : "amber"}>{coverage.assigned}/{coverage.required} officials</Pill></button>; })}</div></Panel>)}</div>;
}

function ExceptionsView({ fixtures, operations, onSelect }) {
  const categories = [
    { id: "unplaced", label: "Unplaced fixtures", tone: "rose", rows: fixtures.filter((row) => !row.date), detail: "No valid playing date has been allocated." },
    { id: "venue", label: "Missing venues", tone: "rose", rows: fixtures.filter((row) => row.date && !row.venueId), detail: "Placed fixtures without a confirmed ground." },
    { id: "officials", label: "Missing officials", tone: "amber", rows: fixtures.filter((row) => row.date && !fixtureAssignmentSummary(row, operations).complete), detail: "At least one required official role is still unfilled." },
    { id: "postponed", label: "Postponed fixtures", tone: "amber", rows: fixtures.filter((row) => row.status === "postponed"), detail: "Fixtures awaiting a rearrangement or closure." },
    { id: "replacement", label: "Replacement required", tone: "rose", rows: fixtures.filter((fixture) => operations.assignments.some((row) => row.targetType === fixture.targetType && row.targetId === fixture.targetId && row.status === "replacement_required")), detail: "An appointed official has withdrawn or declined." },
  ];
  return <div className="grid gap-5 xl:grid-cols-2">{categories.map((category) => <Panel key={category.id} className="overflow-hidden"><div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4"><div><div className="text-base font-black text-slate-950">{category.label}</div><div className="mt-1 text-xs font-semibold text-slate-500">{category.detail}</div></div><Pill tone={category.tone}>{category.rows.length}</Pill></div><div className="max-h-[420px] space-y-2 overflow-y-auto p-3">{category.rows.length ? category.rows.map((fixture) => <FixtureLine key={`${fixture.targetType}-${fixture.targetId}`} fixture={fixture} operations={operations} onSelect={onSelect} />) : <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-400">No exceptions in this category.</div>}</div></Panel>)}</div>;
}

export default function LeagueFixtureCommandWorkspace({ leagueId, workspace, operations, canManage = false, onRefreshOperations, initialView = "calendar", focusToken = 0 }) {
  const [view, setView] = usePersistedWorkspaceState(`daxora:league:${leagueId}:fixture-command-view`, initialView);
  const [versions, setVersions] = useState([]);
  const [versionPayload, setVersionPayload] = useState(null);
  const [versionId, setVersionId] = useState("");
  const [status, setStatus] = useState("loading");
  const [month, setMonth] = useState(startOfMonth());
  const [selectedFixture, setSelectedFixture] = useState(null);
  const [filters, setFilters] = usePersistedWorkspaceState(`daxora:league:${leagueId}:fixture-command-filters`, { competition: "all", division: "all", venue: "all", query: "" });

  const loadSchedule = useCallback(async () => {
    setStatus("loading");
    try {
      const rows = (await DB.listLeagueScheduleVersions(leagueId)).map(normaliseScheduleVersion);
      setVersions(rows);
      const selected = rows.find((row) => row.id === versionId) || rows.find((row) => row.status === "published") || rows[0];
      if (!selected) { setVersionPayload({ version: null, entries: [] }); setVersionId(""); setStatus("ready"); return; }
      const payload = normaliseScheduleVersionPayload(await DB.getLeagueScheduleVersion(leagueId, selected.id));
      setVersionPayload(payload);
      setVersionId(selected.id);
      const firstDate = payload.entries.find((row) => row.scheduledDate)?.scheduledDate;
      if (firstDate) setMonth(startOfMonth(firstDate));
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      toast.error("Fixture Command could not load", { description: error?.message });
    }
  }, [leagueId, versionId]);

  useEffect(() => { loadSchedule(); }, [leagueId]);
  useEffect(() => { if (VIEWS.some(([key]) => key === initialView)) setView(initialView); }, [initialView, focusToken]);
  useEffect(() => { if (versionId && versions.some((row) => row.id === versionId)) { DB.getLeagueScheduleVersion(leagueId, versionId).then((payload) => setVersionPayload(normaliseScheduleVersionPayload(payload))).catch((error) => toast.error("Schedule version could not be loaded", { description: error?.message })); } }, [versionId]);

  const fixtures = useMemo(() => buildLeagueOperationalFixtures(workspace, versionPayload), [workspace, versionPayload]);
  const filtered = useMemo(() => fixtures.filter((fixture) => {
    if (filters.competition !== "all" && fixture.competitionType !== filters.competition) return false;
    if (filters.division !== "all" && fixture.divisionId !== filters.division) return false;
    if (filters.venue !== "all" && fixture.venueId !== filters.venue) return false;
    const query = filters.query.trim().toLowerCase();
    if (query && !`${fixture.homeTeamName} ${fixture.awayTeamName} ${fixture.venueName} ${fixture.competitionName}`.toLowerCase().includes(query)) return false;
    return true;
  }), [fixtures, filters]);
  const coverage = useMemo(() => getLeagueOfficialCoverage(filtered, operations.requirements, operations.assignments), [filtered, operations.requirements, operations.assignments]);
  const postponed = filtered.filter((row) => row.status === "postponed").length;
  const unplaced = filtered.filter((row) => !row.date).length;

  if (status === "loading") return <Panel className="flex min-h-[440px] items-center justify-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-emerald-600" size={28} /><div className="mt-3 text-sm font-black text-slate-700">Loading Fixture Command…</div></div></Panel>;
  if (status === "error") return <Panel className="p-7"><div className="flex items-start gap-4"><CircleAlert className="text-rose-600" size={26} /><div><div className="text-xl font-black text-slate-950">Fixture Command could not load</div><button type="button" onClick={loadSchedule} className={`${BUTTON} mt-4 bg-slate-950 text-white`}><RefreshCw size={15} /> Retry</button></div></div></Panel>;

  return (
    <div className="space-y-5">
      <Panel className="p-5 sm:p-6"><div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white"><CalendarDays size={23} /></span><div><h2 className="text-2xl font-black text-slate-950">Fixture Command</h2><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">One operational picture across league fixtures, cups, grounds, officials and exceptions.</p></div></div></div><div className="grid gap-3 sm:grid-cols-2 xl:min-w-[430px]"><label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Schedule version</span><select className={`${INPUT} w-full`} value={versionId} onChange={(event) => setVersionId(event.target.value)}>{versions.map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} · {version.name} · {version.status}</option>)}</select></label><button type="button" onClick={loadSchedule} className={`${BUTTON} self-end border border-slate-200 bg-white text-slate-700`}><RefreshCw size={15} /> Refresh</button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Fixtures in view" value={filtered.length} detail={`${filtered.filter((row) => row.competitionType === "cup").length} cup ties`} /><Metric label="Official coverage" value={`${coverage.percentage}%`} detail={`${coverage.filled}/${coverage.required} roles`} tone={coverage.percentage === 100 ? "green" : "amber"} /><Metric label="Unplaced" value={unplaced} detail="Need a date" tone={unplaced ? "rose" : "green"} /><Metric label="Postponed" value={postponed} detail="Rearrangement queue" tone={postponed ? "amber" : "green"} /><Metric label="Venues" value={new Set(filtered.map((row) => row.venueId).filter(Boolean)).size} detail="In current filters" /></div></Panel>

      <Panel className="p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-wrap gap-2">{VIEWS.map(([key, label, Icon]) => <button type="button" key={key} onClick={() => setView(key)} className={`${BUTTON} ${view === key ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}><Icon size={15} /> {label}</button>)}</div><div className="grid flex-1 gap-2 sm:grid-cols-2 xl:max-w-[720px] xl:grid-cols-4"><div className="relative"><Filter size={14} className="absolute left-3 top-3 text-slate-400" /><input className={`${INPUT} w-full pl-9`} value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Team or venue" /></div><select className={`${INPUT} w-full`} value={filters.competition} onChange={(event) => setFilters((current) => ({ ...current, competition: event.target.value }))}><option value="all">All competitions</option><option value="league">League</option><option value="cup">Cups</option></select><select className={`${INPUT} w-full`} value={filters.division} onChange={(event) => setFilters((current) => ({ ...current, division: event.target.value }))}><option value="all">All divisions</option>{workspace.divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select><select className={`${INPUT} w-full`} value={filters.venue} onChange={(event) => setFilters((current) => ({ ...current, venue: event.target.value }))}><option value="all">All venues</option>{workspace.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></div></div></Panel>

      {view === "calendar" ? <CalendarView fixtures={filtered} month={month} setMonth={setMonth} operations={operations} onSelect={setSelectedFixture} /> : null}
      {view === "grid" ? <SeasonGridView fixtures={filtered} workspace={workspace} operations={operations} onSelect={setSelectedFixture} /> : null}
      {view === "map" ? <LeagueVenueMap fixtures={filtered.map((fixture) => ({ ...fixture, __officialComplete: fixtureAssignmentSummary(fixture, operations).complete }))} workspace={workspace} operations={operations} canManage={canManage} onRefreshOperations={onRefreshOperations} onSelectFixture={setSelectedFixture} /> : null}
      {view === "list" ? <ListView fixtures={filtered} operations={operations} onSelect={setSelectedFixture} /> : null}
      {view === "exceptions" ? <ExceptionsView fixtures={filtered} operations={operations} onSelect={setSelectedFixture} /> : null}
      {!filtered.length ? <Panel className="p-10 text-center"><AlertTriangle className="mx-auto text-slate-300" size={34} /><div className="mt-3 text-lg font-black text-slate-700">No fixtures match these filters</div></Panel> : null}
      <FixtureDrawer fixture={selectedFixture} operations={operations} onClose={() => setSelectedFixture(null)} />
    </div>
  );
}
