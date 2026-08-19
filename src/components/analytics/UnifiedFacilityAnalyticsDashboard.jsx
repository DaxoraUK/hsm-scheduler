import { useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  CalendarRange,
  CloudRain,
  Download,
  Filter,
  Gauge,
  MapPinned,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { buildUnifiedFacilityAnalyticsModel, buildUnifiedFacilityCsv } from "../../lib/analytics/unifiedFacilityAnalyticsEngine.js";

function currentYearRange() {
  const year = new Date().getFullYear();
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function Metric({ icon: Icon, label, value, detail, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    sky: "bg-sky-100 text-sky-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{detail}</div></div><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone] || tones.slate}`}><Icon size={18} /></span></div></div>;
}

function Select({ label, value, onChange, options, allLabel = "All" }) {
  return <label className="block min-w-0"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" value={value} onChange={(event) => onChange(event.target.value)}><option value="all">{allLabel}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function UsageCard({ row, total }) {
  const width = total > 0 ? Math.max(2, Math.round((row.facilityHours / total) * 100)) : 0;
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.label}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.bookings} booking{row.bookings === 1 ? "" : "s"}</div></div><div className="text-right"><div className="text-lg font-black text-slate-950">{row.hours}h</div><div className="text-[10px] font-black uppercase tracking-wide text-slate-400">team-hours</div></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${width}%` }} /></div><div className="mt-2 text-[11px] font-bold text-slate-500">{row.facilityHours} pitch-equivalent hours</div></div>;
}

export default function UnifiedFacilityAnalyticsDashboard({
  history = [],
  plannerData = {},
  plannerStatus = "ready",
  club = {},
  pitchCfg = [],
  teamCfg = [],
  onRefresh,
}) {
  const initialRange = currentYearRange();
  const [filters, setFilters] = useState({
    ...initialRange,
    season: "all",
    site: "all",
    pitch: "all",
    area: "all",
    team: "all",
    ageGroup: "all",
    usageType: "all",
    status: "all",
  });
  const model = useMemo(() => buildUnifiedFacilityAnalyticsModel({ history, plannerData, club, pitchCfg, teamCfg, filters }), [club, filters, history, pitchCfg, plannerData, teamCfg]);
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const reset = () => setFilters({ ...initialRange, season: "all", site: "all", pitch: "all", area: "all", team: "all", ageGroup: "all", usageType: "all", status: "all" });
  const usageTotal = model.usage.reduce((sum, row) => sum + row.facilityHours, 0);
  const exportCsv = () => {
    if (!model.hasData) return;
    const clubName = String(club.name || "ground-control").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    downloadCsv(buildUnifiedFacilityCsv(model), `${clubName || "ground-control"}-unified-facility-usage-${filters.startDate}-${filters.endDate}.csv`);
    toast.success("Unified facility report downloaded");
  };

  return <div className="mx-auto w-full max-w-7xl space-y-5">
    <section className="overflow-hidden rounded-[34px] bg-gradient-to-br from-slate-950 via-[#101a33] to-violet-950 p-6 text-white shadow-2xl shadow-slate-900/15 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">Unified facility intelligence</div><h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">See fixtures, training and every booking in one pitch-usage picture.</h1><p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Weekend fixtures are no longer treated as the whole story. Ground Control combines matchday history with Annual Planner training, friendlies, events, winter provision, closures and unused configured capacity.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={reset} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white"><Filter size={16} /> Reset filters</button>{onRefresh ? <button type="button" onClick={onRefresh} disabled={plannerStatus === "loading"} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white disabled:opacity-50"><RefreshCw size={16} className={plannerStatus === "loading" ? "animate-spin" : ""} /> Refresh</button> : null}<button type="button" onClick={exportCsv} disabled={!model.hasData} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-black text-slate-950 disabled:opacity-40"><Download size={16} /> Export evidence</button></div>
      </div>
    </section>

    {plannerStatus === "error" ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Annual Planner data could not be loaded. Saved fixture analytics remain visible, but training, friendly, winter and closure totals may be incomplete.</div> : null}

    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">From</span><input type="date" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold" value={filters.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
        <label><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">To</span><input type="date" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold" value={filters.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
        <Select label="Usage type" value={filters.usageType} onChange={(value) => update("usageType", value)} allLabel="All activity" options={model.usage.map((row) => ({ value: row.type, label: row.label }))} />
        <Select label="Status" value={filters.status} onChange={(value) => update("status", value)} options={model.options.statuses} />
        <Select label="Season" value={filters.season} onChange={(value) => update("season", value)} options={model.options.seasons.map((option) => ({ ...option, label: option.label.replaceAll("_", " ") }))} />
        <Select label="Site" value={filters.site} onChange={(value) => update("site", value)} options={model.options.sites} />
        <Select label="Pitch" value={filters.pitch} onChange={(value) => update("pitch", value)} options={model.options.pitches} />
        <Select label="Pitch area" value={filters.area} onChange={(value) => update("area", value)} options={model.options.areas} />
        <Select label="Team" value={filters.team} onChange={(value) => update("team", value)} options={model.options.teams} />
        <Select label="Age group" value={filters.ageGroup} onChange={(value) => update("ageGroup", value)} options={model.options.ageGroups} />
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Metric icon={Gauge} label="Total utilisation" value={`${model.metrics.utilisationPct}%`} detail={`${model.metrics.facilityHours} of ${model.metrics.usableFacilityHours} usable pitch hours`} tone={model.metrics.utilisationPct >= 85 ? "rose" : model.metrics.utilisationPct >= 65 ? "amber" : "emerald"} />
      <Metric icon={Activity} label="Team-hours" value={`${model.metrics.teamHours}h`} detail="Includes simultaneous split-pitch sessions" tone="violet" />
      <Metric icon={CalendarRange} label="Delivered" value={`${model.metrics.deliveredHours}h`} detail={`${model.metrics.scheduledHours}h still scheduled / provisional`} tone="emerald" />
      <Metric icon={CloudRain} label="Closures / downtime" value={`${model.metrics.closureHours}h`} detail={`${model.metrics.weatherClosureHours}h weather · ${model.metrics.maintenanceClosureHours}h maintenance`} tone={model.metrics.closureHours ? "rose" : "sky"} />
      <Metric icon={UsersRound} label="Teams served" value={model.metrics.teams} detail={`${model.metrics.teamHoursChangePct >= 0 ? "+" : ""}${model.metrics.teamHoursChangePct}% team-hours · ${model.metrics.waitingTeams} waiting`} tone={model.metrics.waitingTeams ? "amber" : "sky"} />
      <Metric icon={Banknote} label="Recorded booking cost" value={`£${Number(model.metrics.totalCost || 0).toFixed(2)}`} detail={model.metrics.deliveredHours > 0 ? `£${Number(model.metrics.costPerDeliveredTeamHour || 0).toFixed(2)} per delivered team-hour` : "Complete delivered bookings to calculate unit cost"} tone="slate" />
    </section>

    <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm"><Activity size={20} /></span><div><h2 className="text-xl font-black text-slate-950">What is using the facilities?</h2><p className="mt-1 text-sm font-semibold text-slate-500">Team-hours show service delivered to teams. Pitch-equivalent hours prevent two half-pitch sessions being mistaken for two full-pitch sessions.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{model.usage.map((row) => <UsageCard key={row.type} row={row} total={usageTotal} />)}</div></section>

    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"><div className="flex items-start gap-3 p-5 sm:p-6"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><MapPinned size={20} /></span><div><h2 className="text-xl font-black text-slate-950">Facility and pitch usage</h2><p className="mt-1 text-sm font-semibold text-slate-500">Combined fixture, training, friendly and other usage against configured availability after closures.</p></div></div><div className="overflow-x-auto"><table className="min-w-[980px] w-full border-collapse text-left"><thead><tr className="border-y border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><th className="px-5 py-3">Facility</th><th className="px-4 py-3">Bookings</th><th className="px-4 py-3">Team-hours</th><th className="px-4 py-3">Pitch hours</th><th className="px-4 py-3">Fixtures</th><th className="px-4 py-3">Training</th><th className="px-4 py-3">Other</th><th className="px-4 py-3">Downtime</th><th className="px-4 py-3">Unused</th><th className="px-4 py-3">Use</th></tr></thead><tbody>{model.facilities.length ? model.facilities.map((row) => <tr key={row.id} className="border-b border-slate-100 text-sm"><td className="px-5 py-4"><div className="font-black text-slate-950">{row.pitchName}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.siteName}</div></td><td className="px-4 py-4 font-bold text-slate-600">{row.bookings}</td><td className="px-4 py-4 font-bold text-slate-600">{row.teamHours}h</td><td className="px-4 py-4 font-bold text-slate-600">{row.facilityHours}h</td><td className="px-4 py-4 font-bold text-slate-600">{row.fixtureHours}h</td><td className="px-4 py-4 font-bold text-slate-600">{row.trainingHours}h</td><td className="px-4 py-4 font-bold text-slate-600">{Math.round((row.friendlyHours + row.eventHours + row.hireHours + row.winterHours + row.otherHours) * 10) / 10}h</td><td className="px-4 py-4 font-bold text-rose-700">{row.closureHours}h</td><td className="px-4 py-4 font-bold text-slate-600">{row.unusedHours}h</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.utilisationPct >= 85 ? "bg-rose-100 text-rose-700" : row.utilisationPct >= 65 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{row.utilisationPct}%</span></td></tr>) : <tr><td colSpan={10} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">No combined facility records match these filters.</td></tr>}</tbody></table></div></section>

    <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]"><div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800">Grant and investment evidence</div><h2 className="mt-1 text-xl font-black text-emerald-950">Evidence grounded in combined operations</h2><ul className="mt-4 space-y-3 text-sm font-semibold leading-6 text-emerald-950">{model.grantNarratives.map((row) => <li key={row}>• {row}</li>)}</ul></div><div className="rounded-[28px] border border-sky-200 bg-sky-50 p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-800">Calculation method</div><p className="mt-3 text-sm font-semibold leading-6 text-sky-950">{model.methodology}</p></div></section>
  </div>;
}
