import React, { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Flag,
  Gauge,
  MapPinned,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import PageContainer from "@/ui/PageContainer.jsx";
import {
  buildEliteBoardCsv,
  buildEliteBoardHtml,
  buildEliteCommandModel,
} from "../lib/elite/eliteCommandEngine.js";
import { downloadCsv } from "../lib/reports/csvExport.js";

const STATUS_STYLES = Object.freeze({
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  review: "border-amber-200 bg-amber-50 text-amber-900",
  action: "border-rose-200 bg-rose-50 text-rose-800",
});

const ACTION_STYLES = Object.freeze({
  high: "border-rose-200 bg-rose-50 text-rose-800",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
});

function downloadHtml(content, filename) {
  if (typeof document === "undefined") return false;
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon size={16} />
        <span className="text-[10px] font-black uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs font-bold text-slate-400">{detail}</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">{eyebrow}</div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SiteCard({ site }) {
  const style = STATUS_STYLES[site.status.key] || STATUS_STYLES.review;
  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-xl font-black text-slate-950">{site.name}</h3>
            {site.isPrimary ? (
              <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">Primary</span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-500">{site.venue || site.postcode || "Site details incomplete"}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${style}`}>{site.status.label}</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Teams", site.teams],
          ["Pitches", site.pitches],
          ["Fixtures", site.fixtures],
          ["Parking", site.carParkSpaces > 0 ? site.carParkSpaces : "Not set"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
            <div className="mt-1 text-lg font-black text-slate-950">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Accountable lead</div>
          <div className="mt-1 text-sm font-black">{site.leadName || "Not assigned"}</div>
        </div>
        {site.leadRole ? <div className="text-xs font-bold text-slate-400">{site.leadRole}</div> : null}
      </div>

      {site.issues.length ? (
        <div className="mt-4 space-y-2">
          {site.issues.slice(0, 4).map((issue) => (
            <div key={issue} className="flex items-start gap-2 text-sm font-bold text-slate-600">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 text-sm font-black text-emerald-700">
          <CheckCircle2 size={17} /> No current site-level actions
        </div>
      )}
    </article>
  );
}

export default function EliteCommandCentrePage({
  club,
  teamCfg,
  pitchCfg,
  memberships,
  satFinal,
  sunFinal,
  midweekFinal,
  satUnresolved,
  sunUnresolved,
  midweekUnresolved,
  closedPitches,
  midweekEnabled,
  setMainPage,
  setDayTab,
  setSettingsTab,
}) {
  const model = useMemo(() => buildEliteCommandModel({
    club,
    teamCfg,
    pitchCfg,
    memberships,
    satFinal,
    sunFinal,
    midweekFinal,
    satUnresolved,
    sunUnresolved,
    midweekUnresolved,
    closedPitches,
    midweekEnabled,
  }), [
    club,
    teamCfg,
    pitchCfg,
    memberships,
    satFinal,
    sunFinal,
    midweekFinal,
    satUnresolved,
    sunUnresolved,
    midweekUnresolved,
    closedPitches,
    midweekEnabled,
  ]);

  const openOperations = () => {
    setDayTab?.("centre");
    setMainPage?.("operations");
  };
  const openSettings = (tab) => {
    setSettingsTab?.(tab);
    setMainPage?.("settings");
  };
  const openAction = (destination) => {
    if (destination === "operations") return openOperations();
    openSettings(destination === "venues" ? "venues" : "governance");
  };
  const exportCsv = () => downloadCsv(
    buildEliteBoardCsv(model),
    `${model.organisationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "organisation"}-elite-board-summary.csv`,
  );
  const exportHtml = () => downloadHtml(
    buildEliteBoardHtml(model),
    `${model.organisationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "organisation"}-elite-board-pack.html`,
  );

  return (
    <PageContainer className="space-y-6">
      <section className="overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,#050816_0%,#0b1830_55%,#053b32_100%)] text-white shadow-xl shadow-slate-950/10">
        <div className="grid gap-8 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
              <Building2 size={14} /> Elite organisation command
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">One operating picture across every site.</h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-300 sm:text-base">
              See site readiness, governance gaps and executive evidence together before operational pressure becomes a club-wide problem.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={openOperations} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/20">
                Open Operations <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => openSettings("governance")} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black text-white hover:bg-white/[0.1]">
                Organisation governance <ShieldCheck size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Metric icon={MapPinned} label="Sites" value={`${model.readySites}/${model.siteCount}`} detail="ready now" />
            <Metric icon={UsersRound} label="Teams" value={model.teamCount} detail="active configuration" />
            <Metric icon={CalendarDays} label="Fixtures" value={model.fixtureCount} detail="scheduled this matchweek" />
            <Metric icon={Flag} label="Open actions" value={model.actions.length} detail="organisation-wide" />
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
        <SectionHeader
          eyebrow="Portfolio control"
          title="Site readiness board"
          description="Every venue is assessed from its assigned teams, pitches, current fixtures, closures and governance configuration."
          action={(
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 hover:bg-slate-50"><Download size={15} /> Export site data</button>
              <button type="button" onClick={exportHtml} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3.5 text-xs font-black text-white"><FileText size={15} /> Download board pack</button>
            </div>
          )}
        />
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {model.sites.map((site) => <SiteCard key={site.id} site={site} />)}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
          <SectionHeader eyebrow="Organisation action" title="What needs senior attention" description="Only issues with cross-site, accountability or release impact are surfaced here." />
          <div className="mt-6 space-y-3">
            {model.actions.length ? model.actions.map((action) => (
              <button key={action.id} type="button" onClick={() => openAction(action.destination)} className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${ACTION_STYLES[action.priority] || ACTION_STYLES.medium}`}>
                <span className="flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <span className="text-sm font-black">{action.label}</span>
                </span>
                <ArrowRight size={17} className="shrink-0" />
              </button>
            )) : (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <div className="flex items-center gap-3 text-base font-black"><CheckCircle2 size={20} /> No organisation-wide actions</div>
                <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">All configured sites are currently within the Elite command checks.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
          <SectionHeader eyebrow="Governance" title="Control readiness" description={`${model.governanceScore}% of the current organisation controls are complete.`} />
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${model.governanceScore}%` }} /></div>
          <div className="mt-5 space-y-3">
            {model.governanceChecks.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {item.passed ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-600" />}
                <div>
                  <div className="text-sm font-black text-slate-950">{item.label}</div>
                  <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => openSettings("governance")} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white"><ClipboardCheck size={15} /> Complete governance setup</button>
        </section>
      </div>

      <section className="grid gap-4 rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-3 lg:p-7">
        <div className="sm:col-span-3">
          <SectionHeader eyebrow="Current matchweek" title="Organisation operating volume" description="A concise cross-day view for senior club leaders and trustees." />
        </div>
        {[
          ["Saturday", model.dayCounts.saturday, "scheduled fixtures"],
          ["Sunday", model.dayCounts.sunday, "scheduled fixtures"],
          ["Midweek", model.dayCounts.midweek, midweekEnabled ? "scheduled fixtures" : "not enabled"],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-slate-950">{label}</span><Gauge size={18} className="text-slate-400" /></div>
            <div className="mt-4 text-4xl font-black text-slate-950">{value}</div>
            <div className="mt-1 text-xs font-bold text-slate-500">{detail}</div>
          </div>
        ))}
      </section>
    </PageContainer>
  );
}
