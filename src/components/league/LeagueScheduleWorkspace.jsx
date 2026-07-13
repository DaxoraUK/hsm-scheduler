import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArchiveRestore,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  GitCompareArrows,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DB } from "../../lib/supabase.js";
import { getCurrentLeagueSeason, getEntityName } from "../../lib/league/leagueManagerModel.js";
import {
  compareLeagueScheduleVersions,
  generateLeagueSchedule,
  getLeagueSchedulePreflight,
  leagueScheduleToCsv,
  normaliseScheduleVersion,
  normaliseScheduleVersionPayload,
  serialiseScheduleEntries,
  validateLeagueSchedule,
} from "../../lib/league/leagueSchedulingEngine.js";

const INPUT = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500";
const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Pill({ children, tone = "slate" }) {
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

function Metric({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
  };
  return <div className={`rounded-2xl border p-3 ${tones[tone] || tones.slate}`}><div className="text-[9px] font-black uppercase tracking-[0.17em] opacity-60">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>;
}

function formatDate(value) {
  if (!value) return "Unplaced";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function downloadText(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function VersionRow({ version, active, onSelect }) {
  const tone = version.status === "published" ? "green" : version.status === "draft" ? "blue" : "slate";
  const summary = version.validationSummary || {};
  return (
    <button type="button" onClick={onSelect} className={`w-full rounded-2xl border p-3.5 text-left transition ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
      <div className="flex items-center justify-between gap-2"><div className="truncate text-sm font-black">v{version.versionNumber} · {version.name}</div><Pill tone={active ? "navy" : tone}>{version.status}</Pill></div>
      <div className={`mt-2 text-[11px] font-semibold ${active ? "text-slate-300" : "text-slate-500"}`}>{version.createdAt ? new Date(version.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : ""}{summary.blockingCount !== undefined ? ` · ${summary.blockingCount} blocking` : ""}</div>
    </button>
  );
}

function EntryEditor({ entry, workspace, disabled, busy, highlighted, onSave }) {
  const [draft, setDraft] = useState(entry);
  useEffect(() => setDraft(entry), [entry]);
  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const homeName = getEntityName(workspace, "team", entry.homeTeamId);
  const awayName = getEntityName(workspace, "team", entry.awayTeamId);
  const divisionName = getEntityName(workspace, "division", entry.divisionId);

  return (
    <div className={`rounded-2xl border p-4 transition ${highlighted ? "border-rose-300 bg-rose-50/40 ring-2 ring-rose-100" : entry.scheduledDate ? "border-slate-200 bg-white" : "border-amber-300 bg-amber-50/50"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Pill tone={entry.scheduledDate ? "green" : "amber"}>{entry.scheduledDate ? "Placed" : "Unplaced"}</Pill><Pill>Round {entry.roundNumber || "—"}</Pill>{entry.locked ? <Pill tone="navy">Locked</Pill> : null}</div>
          <div className="mt-3 text-base font-black text-slate-950">{homeName} <span className="text-slate-400">v</span> {awayName}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">{divisionName} · {formatDate(entry.scheduledDate)}{entry.kickOff ? ` at ${entry.kickOff}` : ""}</div>
          {!entry.scheduledDate && entry.unresolvedReason ? <div className="mt-3 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">{entry.unresolvedReason}</div> : null}
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-[610px] lg:grid-cols-[150px_110px_minmax(180px,1fr)_90px_auto]">
          <input aria-label={`Date for ${homeName} v ${awayName}`} type="date" className={INPUT} value={draft.scheduledDate || ""} onChange={update("scheduledDate")} disabled={disabled || busy} />
          <input aria-label={`Kick-off for ${homeName} v ${awayName}`} type="time" className={INPUT} value={draft.kickOff || ""} onChange={update("kickOff")} disabled={disabled || busy || !draft.scheduledDate} />
          <select aria-label={`Venue for ${homeName} v ${awayName}`} className={INPUT} value={draft.venueId || ""} onChange={update("venueId")} disabled={disabled || busy}>
            <option value="">Select venue</option>
            {workspace.venues.filter((venue) => venue.status === "active").map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
          </select>
          <label className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 text-[11px] font-black text-slate-700"><input type="checkbox" checked={Boolean(draft.locked)} onChange={update("locked")} disabled={disabled || busy} /> Lock</label>
          <button type="button" onClick={() => onSave(entry.id, draft)} disabled={disabled || busy || !entry.id || !draft.venueId} className={`${BUTTON} bg-slate-950 text-white`}><Save size={14} /> Save</button>
        </div>
      </div>
    </div>
  );
}

export default function LeagueScheduleWorkspace({ leagueId, workspace, canOperate, onWorkspaceRefresh }) {
  const season = getCurrentLeagueSeason(workspace);
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [payload, setPayload] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ name: "Initial generated draft", meetings: 2, divisionId: "all" });
  const [calendarConfig, setCalendarConfig] = useState({ weekday: 6, defaultKickOff: "15:00" });
  const [filters, setFilters] = useState({ divisionId: "all", teamId: "all", venueId: "all", status: "all", query: "" });
  const [visibleLimit, setVisibleLimit] = useState(75);
  const [compareVersionId, setCompareVersionId] = useState("");
  const [comparePayload, setComparePayload] = useState(null);
  const [serverValidation, setServerValidation] = useState(null);

  const loadVersions = useCallback(async ({ selectVersionId = "", autoSelect = false } = {}) => {
    if (!leagueId || !season?.id) {
      setVersions([]);
      setPayload(null);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      const rows = await DB.listLeagueScheduleVersions(leagueId, season.id);
      const next = rows.map(normaliseScheduleVersion);
      setVersions(next);
      const desired = autoSelect
        ? next.find((version) => version.status === "draft")?.id || next.find((version) => version.status === "published")?.id || next[0]?.id || ""
        : selectVersionId || selectedVersionId || next.find((version) => version.status === "draft")?.id || next.find((version) => version.status === "published")?.id || next[0]?.id || "";
      setSelectedVersionId(desired);
      if (!desired) setPayload(null);
      return next;
    } catch (error) {
      toast.error("Schedule versions could not be loaded", { description: error?.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [leagueId, season?.id, selectedVersionId]);

  const loadVersion = useCallback(async (versionId) => {
    if (!versionId) {
      setPayload(null);
      return null;
    }
    setLoading(true);
    try {
      const next = normaliseScheduleVersionPayload(await DB.getLeagueScheduleVersion(leagueId, versionId));
      setPayload(next);
      setServerValidation(next.version.validationSummary || null);
      return next;
    } catch (error) {
      toast.error("Schedule version could not be opened", { description: error?.message });
      return null;
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    loadVersions();
  }, [leagueId, season?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedVersionId) loadVersion(selectedVersionId);
  }, [selectedVersionId, loadVersion]);

  useEffect(() => {
    setVisibleLimit(75);
  }, [filters, selectedVersionId]);

  useEffect(() => {
    if (!compareVersionId) {
      setComparePayload(null);
      return;
    }
    DB.getLeagueScheduleVersion(leagueId, compareVersionId)
      .then((result) => setComparePayload(normaliseScheduleVersionPayload(result)))
      .catch((error) => toast.error("Comparison version could not be loaded", { description: error?.message }));
  }, [compareVersionId, leagueId]);

  const validation = useMemo(() => {
    if (!payload) return { valid: false, blockingCount: 0, warningCount: 0, issues: [], totals: { fixtures: 0, placed: 0, unplaced: 0, locked: 0 } };
    return validateLeagueSchedule(workspace, payload.entries, payload.version.generationConfig || {});
  }, [payload, workspace]);

  const selectedDivisionIds = useMemo(() => (
    config.divisionId === "all"
      ? workspace.divisions.filter((division) => division.seasonId === season?.id).map((division) => division.id)
      : [config.divisionId]
  ), [config.divisionId, season?.id, workspace.divisions]);

  const preflight = useMemo(() => getLeagueSchedulePreflight(workspace, {
    seasonId: season?.id,
    divisionIds: selectedDivisionIds,
    meetings: Number(config.meetings),
  }), [config.meetings, season?.id, selectedDivisionIds, workspace]);

  const visibleValidationIssues = useMemo(() => {
    if (validation.issues.length <= 24) return validation.issues;
    const unplaced = validation.issues.filter((item) => item.code === "unplaced-fixture");
    const others = validation.issues.filter((item) => item.code !== "unplaced-fixture");
    const result = [];
    if (unplaced.length) {
      result.push({
        id: "unplaced-fixture-summary",
        code: "unplaced-fixture-summary",
        severity: "blocking",
        message: `${unplaced.length} fixtures are unplaced. Generate enough playing dates, then use “Rebuild unresolved only”; individual reasons remain available in the Unplaced schedule filter.`,
      });
    }
    return [...result, ...others.slice(0, 23)];
  }, [validation.issues]);

  const issueEntryIds = useMemo(() => new Set(validation.issues.filter((item) => item.severity === "blocking").flatMap((item) => item.entryIds || [])), [validation]);

  const filteredEntries = useMemo(() => {
    if (!payload) return [];
    const query = filters.query.trim().toLowerCase();
    return payload.entries.filter((entry) => {
      if (filters.divisionId !== "all" && entry.divisionId !== filters.divisionId) return false;
      if (filters.teamId !== "all" && ![entry.homeTeamId, entry.awayTeamId].includes(filters.teamId)) return false;
      if (filters.venueId !== "all" && entry.venueId !== filters.venueId) return false;
      if (filters.status === "placed" && !entry.scheduledDate) return false;
      if (filters.status === "unplaced" && entry.scheduledDate) return false;
      if (filters.status === "locked" && !entry.locked) return false;
      if (!query) return true;
      const text = [
        getEntityName(workspace, "team", entry.homeTeamId),
        getEntityName(workspace, "team", entry.awayTeamId),
        getEntityName(workspace, "division", entry.divisionId),
        getEntityName(workspace, "venue", entry.venueId),
        entry.scheduledDate,
      ].join(" ").toLowerCase();
      return text.includes(query);
    });
  }, [filters, payload, workspace]);

  const comparison = useMemo(() => {
    if (!payload || !comparePayload) return null;
    return compareLeagueScheduleVersions(comparePayload.entries, payload.entries);
  }, [comparePayload, payload]);

  const generateSeasonCalendar = async () => {
    if (!season?.id) return;
    setBusy(true);
    try {
      const result = await DB.generateLeaguePlayingDateCalendar(leagueId, {
        seasonId: season.id,
        weekday: calendarConfig.weekday,
        defaultKickOff: calendarConfig.defaultKickOff,
      });
      await onWorkspaceRefresh?.();
      toast.success("Season playing dates generated", {
        description: `${Number(result?.inserted || 0)} new dates added · ${Number(result?.total_available || 0)} available in the calendar.`,
      });
    } catch (error) {
      toast.error("Playing-date calendar could not be generated", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const createDraft = async ({ rebuildUnresolved = false } = {}) => {
    if (!season?.id) return;
    const selectedDivisions = selectedDivisionIds;
    const schedulePreflight = getLeagueSchedulePreflight(workspace, {
      seasonId: season.id,
      divisionIds: selectedDivisions,
      meetings: Number(config.meetings),
    });
    if (!schedulePreflight.ready) {
      const firstShortfall = schedulePreflight.dateShortfalls?.[0];
      const description = firstShortfall
        ? `${firstShortfall.name} has ${firstShortfall.availableDates} available playing date${firstShortfall.availableDates === 1 ? "" : "s"} but needs at least ${firstShortfall.requiredRounds}. Generate the season calendar first.`
        : schedulePreflight.errors?.[0] || "Complete the schedule setup before generating a draft.";
      toast.error("Season calendar is incomplete", { description });
      return;
    }
    const generated = generateLeagueSchedule(workspace, {
      seasonId: season.id,
      divisionIds: selectedDivisions,
      meetings: Number(config.meetings),
      baseEntries: rebuildUnresolved ? payload?.entries || [] : [],
      preservePlacedBaseEntries: rebuildUnresolved,
    });
    if (generated.errors.length) {
      toast.error("Schedule setup needs attention", { description: generated.errors.slice(0, 4).join(" ") });
      if (!generated.entries.length) return;
    }
    const clientValidation = validateLeagueSchedule(workspace, generated.entries, generated.config);
    const name = rebuildUnresolved
      ? `${payload?.version.name || "Schedule"} – unresolved rebuild`
      : config.name.trim();
    if (!name) {
      toast.error("Give this schedule version a name");
      return;
    }

    setBusy(true);
    try {
      const versionId = await DB.saveLeagueScheduleDraft(leagueId, {
        seasonId: season.id,
        name,
        generationConfig: generated.config,
        entries: serialiseScheduleEntries(generated.entries),
        parentVersionId: rebuildUnresolved ? payload?.version.id || null : null,
        source: rebuildUnresolved ? "restored" : "generated",
      });
      await loadVersions({ selectVersionId: versionId });
      setSelectedVersionId(versionId);
      toast.success("Schedule draft created", { description: `${generated.summary.placed} placed · ${generated.summary.unplaced} unresolved · ${clientValidation.warningCount} warnings` });
    } catch (error) {
      toast.error("Schedule draft could not be saved", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const saveEntry = async (entryId, draft) => {
    setBusy(true);
    try {
      await DB.updateLeagueScheduleEntry(leagueId, payload.version.id, entryId, {
        scheduledDate: draft.scheduledDate || null,
        kickOff: draft.scheduledDate ? draft.kickOff || "15:00" : null,
        venueId: draft.venueId || null,
        locked: draft.locked,
        notes: draft.notes || null,
      });
      await loadVersion(payload.version.id);
      await loadVersions({ selectVersionId: payload.version.id });
      toast.success("Fixture placement saved");
    } catch (error) {
      toast.error("Fixture could not be updated", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const validateOnServer = async () => {
    if (!payload) return null;
    setBusy(true);
    try {
      const result = await DB.validateLeagueScheduleVersion(leagueId, payload.version.id);
      setServerValidation(result);
      await loadVersions({ selectVersionId: payload.version.id });
      toast[result.valid ? "success" : "error"](result.valid ? "Schedule passed server validation" : "Schedule has blocking issues", { description: `${result.blockingCount || 0} blocking · ${result.warningCount || 0} warnings` });
      return result;
    } catch (error) {
      toast.error("Schedule validation failed", { description: error?.message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const exportSchedule = async () => {
    const result = await validateOnServer();
    if (!result?.valid) return;
    const filename = `${workspace.league.slug || "league"}-${season?.name || "season"}-schedule-v${payload.version.versionNumber}.csv`.replaceAll(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
    downloadText(filename, leagueScheduleToCsv(payload.entries, workspace, payload.version));
    toast.success("Validated schedule CSV downloaded");
  };

  const publishSchedule = async () => {
    if (!payload || !window.confirm("Publish this version as the official league schedule? The previously published generated schedule will be archived.")) return;
    setBusy(true);
    try {
      const result = await DB.publishLeagueScheduleVersion(leagueId, payload.version.id);
      await onWorkspaceRefresh?.();
      await loadVersions({ selectVersionId: payload.version.id });
      await loadVersion(payload.version.id);
      toast.success("League schedule published", { description: `${result?.fixtures || payload.entries.length} fixtures are now official.` });
    } catch (error) {
      toast.error("Schedule could not be published", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const restoreVersion = async () => {
    if (!payload) return;
    setBusy(true);
    try {
      const versionId = await DB.cloneLeagueScheduleVersion(leagueId, payload.version.id, `${payload.version.name} – restored`);
      await loadVersions({ selectVersionId: versionId });
      setSelectedVersionId(versionId);
      toast.success("Version restored as a new editable draft");
    } catch (error) {
      toast.error("Schedule version could not be restored", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const deleteVersion = async () => {
    if (!payload || payload.version.status !== "draft" || !window.confirm("Delete this draft schedule version?")) return;
    setBusy(true);
    try {
      await DB.deleteLeagueScheduleVersion(leagueId, payload.version.id);
      setSelectedVersionId("");
      setPayload(null);
      await loadVersions({ autoSelect: true });
      toast.success("Draft schedule deleted");
    } catch (error) {
      toast.error("Draft could not be deleted", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  if (!season) {
    return <Panel className="p-7"><div className="flex items-start gap-4"><AlertTriangle className="mt-1 text-amber-600" /><div><h2 className="text-xl font-black text-slate-950">Create a current season first</h2><p className="mt-2 text-sm font-semibold text-slate-600">The scheduling engine needs an active season, divisions, teams, venues and available playing dates.</p></div></div></Panel>;
  }

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <div className="grid gap-5 bg-slate-950 p-6 text-white lg:grid-cols-[1fr_auto] lg:items-center">
          <div><div className="flex flex-wrap gap-2"><Pill tone="green">Scheduling engine pass 1</Pill><Pill tone="navy">{season.name}</Pill></div><h2 className="mt-4 text-2xl font-black">Build, test and publish the league programme</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Generate a balanced fixture matrix, allocate it across valid dates, preserve locked games, explain exceptions and publish only after server validation.</p></div>
          <div className="grid min-w-[280px] gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <button type="button" disabled={!canOperate || busy || workspace.divisions.length === 0} onClick={() => createDraft()} className={`${BUTTON} h-11 bg-emerald-500 text-slate-950 hover:bg-emerald-400`}><Sparkles size={16} /> Generate draft</button>
            <button type="button" disabled={!canOperate || busy || !payload || payload.version.status !== "draft" || validation.totals.unplaced === 0} onClick={() => createDraft({ rebuildUnresolved: true })} className={`${BUTTON} h-11 border border-white/15 bg-white/10 text-white`}><RefreshCw size={16} /> Rebuild unresolved only</button>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1.3fr)_140px_minmax(190px,1fr)_auto]">
          <label><span className="mb-2 block text-[9px] font-black uppercase tracking-[0.17em] text-slate-500">Draft name</span><input className={INPUT} value={config.name} onChange={(event) => setConfig((current) => ({ ...current, name: event.target.value }))} disabled={!canOperate || busy} /></label>
          <label><span className="mb-2 block text-[9px] font-black uppercase tracking-[0.17em] text-slate-500">Meetings</span><select className={INPUT} value={config.meetings} onChange={(event) => setConfig((current) => ({ ...current, meetings: Number(event.target.value) }))} disabled={!canOperate || busy}><option value={2}>Home & away</option><option value={1}>Once</option></select></label>
          <label><span className="mb-2 block text-[9px] font-black uppercase tracking-[0.17em] text-slate-500">Generate</span><select className={INPUT} value={config.divisionId} onChange={(event) => setConfig((current) => ({ ...current, divisionId: event.target.value }))} disabled={!canOperate || busy}><option value="all">All divisions</option>{workspace.divisions.filter((division) => division.seasonId === season.id).map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></label>
          <div className="flex items-end"><div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-bold leading-5 text-sky-900">Dates, blackouts, team clashes and shared-ground capacity are enforced automatically.</div></div>
        </div>
      </Panel>

      <Panel className={`p-5 ${preflight.ready ? "border-emerald-200" : "border-amber-300"}`}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><Pill tone={preflight.ready ? "green" : "amber"}>Season calendar</Pill><Pill>{preflight.configuredDates} available</Pill><Pill>{preflight.minimumDates} minimum</Pill></div>
            <h3 className="mt-3 text-lg font-black text-slate-950">{preflight.ready ? "Enough playing dates are configured" : "Generate the full playing-date calendar before scheduling"}</h3>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{preflight.ready ? `${preflight.totalFixtures} fixtures can be allocated across the selected divisions.` : "The previous draft used only one available date, placed the opening round and correctly left the remaining fixtures unresolved."}</p>
            {!preflight.ready && preflight.dateShortfalls?.length ? <div className="mt-3 text-xs font-black text-amber-900">{preflight.dateShortfalls.slice(0, 3).map((division) => `${division.name}: ${division.availableDates}/${division.requiredRounds} dates`).join(" · ")}</div> : null}
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-[150px_140px_auto] xl:w-auto">
            <label><span className="mb-2 block text-[9px] font-black uppercase tracking-[0.17em] text-slate-500">Primary day</span><select className={INPUT} value={calendarConfig.weekday} onChange={(event) => setCalendarConfig((current) => ({ ...current, weekday: Number(event.target.value) }))} disabled={!canOperate || busy}><option value={6}>Saturday</option><option value={0}>Sunday</option><option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option></select></label>
            <label><span className="mb-2 block text-[9px] font-black uppercase tracking-[0.17em] text-slate-500">Default kick-off</span><input type="time" className={INPUT} value={calendarConfig.defaultKickOff} onChange={(event) => setCalendarConfig((current) => ({ ...current, defaultKickOff: event.target.value }))} disabled={!canOperate || busy} /></label>
            <div className="flex items-end"><button type="button" onClick={generateSeasonCalendar} disabled={!canOperate || busy} className={`${BUTTON} h-10 w-full bg-slate-950 text-white`}><CalendarClock size={15} /> Generate weekly dates</button></div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Panel className="overflow-hidden xl:sticky xl:top-5 xl:self-start">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4"><div><div className="text-sm font-black text-slate-950">Schedule versions</div><div className="mt-1 text-xs font-semibold text-slate-500">{versions.length} saved</div></div>{loading ? <RefreshCw className="animate-spin text-emerald-600" size={18} /> : <CalendarClock className="text-slate-400" size={18} />}</div>
          <div className="max-h-[540px] space-y-2 overflow-y-auto p-3">{versions.length ? versions.map((version) => <VersionRow key={version.id} version={version} active={version.id === selectedVersionId} onSelect={() => setSelectedVersionId(version.id)} />) : <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">Generate the first draft schedule.</div>}</div>
          {payload ? <div className="space-y-2 border-t border-slate-200 p-3">
            <button type="button" onClick={restoreVersion} disabled={!canOperate || busy} className={`${BUTTON} w-full border border-slate-200 bg-white text-slate-800`}><ArchiveRestore size={15} /> Restore as new draft</button>
            {payload.version.status === "draft" ? <button type="button" onClick={deleteVersion} disabled={!canOperate || busy} className={`${BUTTON} w-full border border-rose-200 bg-rose-50 text-rose-700`}><Trash2 size={15} /> Delete draft</button> : null}
          </div> : null}
        </Panel>

        <div className="min-w-0 space-y-5">
          {!payload ? <Panel className="p-10 text-center"><Sparkles className="mx-auto text-emerald-600" size={30} /><h3 className="mt-4 text-xl font-black text-slate-950">No schedule version selected</h3><p className="mt-2 text-sm font-semibold text-slate-500">Generate a draft to begin the pilot scheduling workflow.</p></Panel> : <>
            <Panel className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div><div className="flex flex-wrap gap-2"><Pill tone={payload.version.status === "published" ? "green" : payload.version.status === "draft" ? "blue" : "slate"}>{payload.version.status}</Pill><Pill>Version {payload.version.versionNumber}</Pill>{payload.version.source === "restored" ? <Pill tone="amber">Restored</Pill> : null}</div><h3 className="mt-3 text-2xl font-black text-slate-950">{payload.version.name}</h3><p className="mt-1 text-xs font-semibold text-slate-500">Created {payload.version.createdAt ? new Date(payload.version.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : ""}</p></div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={validateOnServer} disabled={busy} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}><CheckCircle2 size={15} /> Validate</button>
                  <button type="button" onClick={exportSchedule} disabled={busy || !payload.entries.length} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}><Download size={15} /> Export CSV</button>
                  {payload.version.status === "draft" ? <button type="button" onClick={publishSchedule} disabled={!canOperate || busy || !validation.valid} className={`${BUTTON} bg-emerald-600 text-white`}><Send size={15} /> Publish schedule</button> : null}
                </div>
              </div>
              <div className="mt-5 grid gap-3 grid-cols-2 lg:grid-cols-5"><Metric label="Fixtures" value={validation.totals.fixtures} /><Metric label="Placed" value={validation.totals.placed} tone="green" /><Metric label="Unplaced" value={validation.totals.unplaced} tone={validation.totals.unplaced ? "amber" : "green"} /><Metric label="Blocking" value={validation.blockingCount} tone={validation.blockingCount ? "rose" : "green"} /><Metric label="Warnings" value={validation.warningCount} tone={validation.warningCount ? "amber" : "green"} /></div>
              <div className={`mt-4 rounded-2xl border p-4 ${validation.valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}><div className="flex items-start gap-3">{validation.valid ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={18} /> : <AlertTriangle className="mt-0.5 shrink-0 text-rose-700" size={18} />}<div><div className={`text-sm font-black ${validation.valid ? "text-emerald-950" : "text-rose-950"}`}>{validation.valid ? "Ready for server validation and publication" : `${validation.blockingCount} blocking issue${validation.blockingCount === 1 ? "" : "s"} must be resolved`}</div><div className={`mt-1 text-xs font-semibold leading-5 ${validation.valid ? "text-emerald-800" : "text-rose-800"}`}>{serverValidation?.valid === true ? "The stored version has also passed server validation." : "The browser preview is immediate; publication repeats the checks securely on the server."}</div></div></div></div>
            </Panel>

            <Panel className="p-5">
              <div className="flex items-center gap-3"><GitCompareArrows className="text-sky-600" size={20} /><div><h3 className="text-base font-black text-slate-950">Compare versions</h3><p className="mt-0.5 text-xs font-semibold text-slate-500">See how this draft differs from another saved schedule.</p></div></div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_repeat(4,110px)]"><select className={INPUT} value={compareVersionId} onChange={(event) => setCompareVersionId(event.target.value)}><option value="">Select comparison version</option>{versions.filter((version) => version.id !== payload.version.id).map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} · {version.name}</option>)}</select><Metric label="Moved" value={comparison?.moved ?? "—"} tone={comparison?.moved ? "amber" : "slate"} /><Metric label="Added" value={comparison?.added ?? "—"} /><Metric label="Removed" value={comparison?.removed ?? "—"} /><Metric label="Unchanged" value={comparison?.unchanged ?? "—"} tone="green" /></div>
              {comparison?.details?.length ? <div className="mt-4 max-h-48 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">{comparison.details.slice(0, 30).map((change) => <div key={`${change.type}:${change.key}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs"><span className="font-black text-slate-800">{change.after ? `${getEntityName(workspace, "team", change.after.homeTeamId)} v ${getEntityName(workspace, "team", change.after.awayTeamId)}` : `${getEntityName(workspace, "team", change.before.homeTeamId)} v ${getEntityName(workspace, "team", change.before.awayTeamId)}`}</span><span className="font-bold text-slate-500">{change.type === "moved" ? `${change.before.scheduledDate || "unplaced"} → ${change.after.scheduledDate || "unplaced"}` : change.type}</span></div>)}</div> : null}
            </Panel>

            {validation.issues.length ? <Panel className="overflow-hidden"><details open={!validation.valid}><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4"><div className="flex items-center gap-3"><AlertTriangle className={validation.valid ? "text-amber-600" : "text-rose-600"} size={20} /><div><div className="text-sm font-black text-slate-950">Validation findings</div><div className="mt-0.5 text-xs font-semibold text-slate-500">{validation.blockingCount} blocking · {validation.warningCount} warnings</div></div></div><ChevronDown className="text-slate-400" size={18} /></summary><div className="space-y-2 border-t border-slate-200 p-4">{visibleValidationIssues.map((item) => <div key={item.id} className={`rounded-xl border px-3 py-2.5 text-xs font-bold leading-5 ${item.severity === "blocking" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{item.message}</div>)}</div></details></Panel> : null}

            <Panel className="p-5">
              <div className="flex items-center gap-3"><Filter className="text-slate-600" size={19} /><div><h3 className="text-base font-black text-slate-950">Draft schedule</h3><p className="mt-0.5 text-xs font-semibold text-slate-500">Filter, manually move and lock fixtures. Locked placements survive future regeneration.</p></div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><input className={INPUT} value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Find a team or venue" /><select className={INPUT} value={filters.divisionId} onChange={(event) => setFilters((current) => ({ ...current, divisionId: event.target.value }))}><option value="all">All divisions</option>{workspace.divisions.filter((division) => division.seasonId === season.id).map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select><select className={INPUT} value={filters.teamId} onChange={(event) => setFilters((current) => ({ ...current, teamId: event.target.value }))}><option value="all">All teams</option>{workspace.teams.filter((team) => team.seasonId === season.id).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><select className={INPUT} value={filters.venueId} onChange={(event) => setFilters((current) => ({ ...current, venueId: event.target.value }))}><option value="all">All venues</option>{workspace.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select><select className={INPUT} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">All statuses</option><option value="placed">Placed</option><option value="unplaced">Unplaced</option><option value="locked">Locked</option></select></div>
              <div className="mt-5 space-y-3">{filteredEntries.slice(0, visibleLimit).map((entry) => <EntryEditor key={entry.id || entry.clientKey} entry={entry} workspace={workspace} disabled={!canOperate || payload.version.status !== "draft"} busy={busy} highlighted={issueEntryIds.has(entry.id || entry.clientKey)} onSave={saveEntry} />)}{!filteredEntries.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">No fixtures match these filters.</div> : null}</div>
              {filteredEntries.length > visibleLimit ? <div className="mt-5 flex justify-center"><button type="button" onClick={() => setVisibleLimit((current) => current + 75)} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}><Plus size={14} /> Show 75 more</button></div> : null}
            </Panel>
          </>}
        </div>
      </div>
    </div>
  );
}
