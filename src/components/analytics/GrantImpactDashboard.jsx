import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  HeartPulse,
  Info,
  MapPin,
  PoundSterling,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
} from "lucide-react";
import PageContainer from "@/ui/PageContainer.jsx";
import PageHeader from "@/ui/PageHeader.jsx";
import Card from "@/ui/Card.jsx";
import ProgressBar from "../../ui/ProgressBar.jsx";
import StatusChip from "../../ui/StatusChip.jsx";
import FundingWorkspacePanel from "./FundingWorkspacePanel.jsx";
import { buildGrantImpactModel } from "../../lib/engines/grantImpactEngine.js";
import { inferGrantHomeNation } from "../../lib/grants/grantMatchingEngine.js";
import { buildFundingEvidencePack, downloadFundingApplicationPack, downloadFundingEvidencePack } from "../../lib/grants/fundingEvidencePack.js";

const TONE = {
  success: {
    surface: "border-emerald-200 bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-700",
    text: "text-emerald-700",
    bar: "success",
  },
  warning: {
    surface: "border-amber-200 bg-amber-50",
    icon: "bg-amber-100 text-amber-700",
    text: "text-amber-700",
    bar: "warning",
  },
  danger: {
    surface: "border-rose-200 bg-rose-50",
    icon: "bg-rose-100 text-rose-700",
    text: "text-rose-700",
    bar: "danger",
  },
  info: {
    surface: "border-sky-200 bg-sky-50",
    icon: "bg-sky-100 text-sky-700",
    text: "text-sky-700",
    bar: "info",
  },
};

const THEME_ICONS = {
  participation: UsersRound,
  facilities: Building2,
  resilience: ShieldCheck,
  workforce: ClipboardCheck,
};

const PRIORITY_STYLES = {
  high: "border-rose-200 bg-rose-50 text-rose-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  development: "border-sky-200 bg-sky-50 text-sky-800",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const SCOPE_OPTIONS = [
  { value: "matchweek", label: "Matchweek" },
  { value: "weekend", label: "Weekend" },
  { value: "midweek", label: "Midweek" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

function SelectControl({ label, value, onChange, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-black text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        >
          {children}
        </select>
        <ChevronDown size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</div>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</div>
          <div className="mt-2 text-sm font-semibold leading-6 text-slate-500">{detail}</div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Icon size={21} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

function ThemeCard({ theme }) {
  const Icon = THEME_ICONS[theme.id] || BarChart3;
  const tone = TONE[theme.tone] || TONE.warning;
  return (
    <div className={`rounded-[26px] border p-5 ${tone.surface}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone.icon}`}>
          <Icon size={21} strokeWidth={2.5} />
        </div>
        <div className={`text-2xl font-black ${tone.text}`}>{theme.score}%</div>
      </div>
      <div className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{theme.label}</div>
      <div className="mt-2 text-lg font-black text-slate-950">{theme.headline}</div>
      <div className="mt-2 min-h-12 text-sm font-semibold leading-6 text-slate-600">{theme.detail}</div>
      <ProgressBar value={theme.score} tone={tone.bar} className="mt-5" />
    </div>
  );
}

function PriorityCard({ priority, index }) {
  const style = PRIORITY_STYLES[priority.severity] || PRIORITY_STYLES.medium;
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${style}`}>{index + 1}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950">{priority.title}</h3>
            <StatusChip
              status={priority.severity === "high" ? "danger" : priority.severity === "positive" ? "success" : priority.severity === "development" ? "info" : "warning"}
              size="sm"
            >
              {priority.severity === "high" ? "High priority" : priority.severity === "positive" ? "Growth case" : priority.severity === "development" ? "Build evidence" : "Evidence case"}
            </StatusChip>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{priority.detail}</p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Recorded basis</div>
            <div className="mt-2 text-sm font-bold leading-6 text-slate-700">{priority.evidence}</div>
          </div>
          <div className="mt-3 flex items-start gap-2 text-sm font-bold leading-6 text-emerald-800">
            <Sparkles size={16} className="mt-1 shrink-0" strokeWidth={2.5} />
            <span>{priority.grantAngle}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function matrixStatus(item) {
  if (item.status === "available") return { tone: "success", label: "Available" };
  if (item.status === "partial") return { tone: "warning", label: "Partial" };
  if (item.status === "manual") return { tone: "info", label: "Manual" };
  return { tone: "danger", label: "Missing" };
}

function EvidenceMatrix({ framework }) {
  return (
    <Card
      eyebrow="Grant evidence framework"
      title="What Ground Control can evidence — and what it cannot"
      subtitle="Operational records are separated from calculated, inferred and manual evidence so funding claims remain defensible."
    >
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              <th className="border-b border-slate-200 px-3 py-3">Category</th>
              <th className="border-b border-slate-200 px-3 py-3">Requirement</th>
              <th className="border-b border-slate-200 px-3 py-3">Status</th>
              <th className="border-b border-slate-200 px-3 py-3">Source</th>
              <th className="border-b border-slate-200 px-3 py-3">Current evidence</th>
              <th className="border-b border-slate-200 px-3 py-3">Next action</th>
            </tr>
          </thead>
          <tbody>
            {framework.requirements.map((item) => {
              const status = matrixStatus(item);
              return (
                <tr key={item.id} className="align-top">
                  <td className="border-b border-slate-100 px-3 py-4 text-xs font-black text-slate-500">{item.category}</td>
                  <td className="border-b border-slate-100 px-3 py-4 text-sm font-black text-slate-900">{item.title}</td>
                  <td className="border-b border-slate-100 px-3 py-4"><StatusChip status={status.tone} size="sm">{status.label}</StatusChip></td>
                  <td className="border-b border-slate-100 px-3 py-4 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{item.source}</td>
                  <td className="border-b border-slate-100 px-3 py-4 text-sm font-semibold leading-6 text-slate-600">{item.evidence}</td>
                  <td className="border-b border-slate-100 px-3 py-4 text-sm font-semibold leading-6 text-slate-600">{item.nextAction}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-950">
        <Info size={18} className="mt-0.5 shrink-0 text-sky-700" />
        <span>{framework.disclaimer}</span>
      </div>
    </Card>
  );
}

function FundingOpportunityCard({ programme }) {
  return (
    <article className="flex h-full flex-col rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{programme.funder}</div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">{programme.name}</h3>
        </div>
        <StatusChip status={programme.resolvedStatus.tone} size="sm">{programme.resolvedStatus.label}</StatusChip>
      </div>

      <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{programme.summary}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400"><PoundSterling size={14} /> Funding</div>
          <div className="mt-2 text-sm font-black leading-6 text-slate-900">{programme.amountLabel}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400"><Target size={14} /> Club contribution</div>
          <div className="mt-2 text-sm font-black leading-6 text-slate-900">{programme.matchFunding}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400"><CalendarClock size={14} /> Timing</div>
          <div className="mt-2 text-sm font-black leading-6 text-slate-900">{programme.deadline ? `Deadline ${new Date(`${programme.deadline}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` : programme.resolvedStatus.label}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">{programme.decisionTime || programme.projectDuration || "Check the current official timetable"}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400"><Search size={14} /> Relevance</div>
          <div className="mt-2 text-sm font-black text-slate-900">{programme.matchLabel}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">{programme.evidenceReady}/{programme.evidenceTotal} mapped evidence areas ready</div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Key eligibility checks</div>
        <ul className="mt-3 space-y-2">
          {programme.eligibilityNotes.slice(0, 3).map((note) => (
            <li key={note} className="flex items-start gap-2 text-sm font-semibold leading-5 text-slate-600">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      {programme.evidenceGaps.length ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Evidence to strengthen</div>
          <div className="mt-2 text-sm font-semibold leading-6 text-amber-950">{programme.evidenceGaps.slice(0, 2).map((item) => item.title).join(" · ")}</div>
        </div>
      ) : null}

      <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-black text-slate-700 marker:hidden">Application documents and manual checks</summary>
        <div className="border-t border-slate-200 px-4 py-3">
          <ul className="space-y-2">
            {[...(programme.requiredDocuments || []), ...(programme.manualRequirements || [])].slice(0, 8).map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs font-semibold leading-5 text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />{item}</li>
            ))}
          </ul>
        </div>
      </details>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <CalendarClock size={15} /> Verified {new Date(`${programme.lastVerified}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
          </div>
          <StatusChip status={programme.verification.tone} size="sm">{programme.verification.label}</StatusChip>
        </div>
        <a
          href={programme.officialUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-black text-white transition hover:bg-slate-800"
        >
          Official guidance <ExternalLink size={14} />
        </a>
      </div>
    </article>
  );
}

export default function GrantImpactDashboard({ midweekEnabled = true, ...props }) {
  const [copied, setCopied] = useState(false);
  const [period, setPeriod] = useState("all");
  const [scope, setScope] = useState(midweekEnabled ? "matchweek" : "weekend");
  const [homeNation, setHomeNation] = useState(() => inferGrantHomeNation(props.club));
  const [projectType, setProjectType] = useState("all");
  const [availability, setAvailability] = useState("current");
  const [impactEvidence, setImpactEvidence] = useState([]);
  const [activeFundingProject, setActiveFundingProject] = useState(null);
  const effectiveScope = !midweekEnabled && ["matchweek", "midweek"].includes(scope) ? "weekend" : scope;
  const model = useMemo(
    () => buildGrantImpactModel({ ...props, midweekEnabled, period, scope: effectiveScope, homeNation, projectType, availability }),
    [props, midweekEnabled, period, effectiveScope, homeNation, projectType, availability]
  );
  const scopeOptions = midweekEnabled ? SCOPE_OPTIONS : SCOPE_OPTIONS.filter((option) => !["matchweek", "midweek"].includes(option.value));
  const operationalReadiness = model.funding.readiness.find((item) => item.id === "operational");
  const readinessTone = TONE[operationalReadiness.status] || TONE.warning;

  const copyNarrative = async () => {
    try {
      await navigator.clipboard.writeText(`${model.narrative}\n\nFunding focus: ${model.funding.project.label}.\n\nEvidence note: ${model.framework.disclaimer}\n\nOpportunity note: ${model.funding.disclaimer}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const downloadEvidencePack = () => {
    const pack = buildFundingEvidencePack({ club: props.club, model, project: activeFundingProject, impactEvidence, source: "funding-analytics" });
    downloadFundingEvidencePack(pack);
  };

  const downloadApplicationPack = () => {
    if (!activeFundingProject) {
      toast.error("Save and select a funding project", { description: "Application-ready packs must be tied to a saved project and its evidence register." });
      return;
    }
    const pack = buildFundingEvidencePack({ club: props.club, model, project: activeFundingProject, impactEvidence, source: "funding-analytics" });
    downloadFundingApplicationPack(pack);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Funding intelligence"
        title="Find funding and build the evidence case"
        subtitle="Match verified national and UK-wide programmes to a defined club project, then identify the operational evidence, eligibility checks and documents still required."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadApplicationPack} disabled={!activeFundingProject} title={activeFundingProject ? "Download a project-specific application evidence pack" : "Save and select a funding project first"} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
              <FileCheck2 size={17} /> Application-ready pack
            </button>
            <button type="button" onClick={downloadEvidencePack} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800">
              <Download size={17} /> Data evidence draft
            </button>
            <button type="button" onClick={copyNarrative} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-900">
              {copied ? <Check size={17} className="text-emerald-300" /> : <Copy size={17} className="text-emerald-300" />}
              {copied ? "Summary copied" : "Copy evidence summary"}
            </button>
          </div>
        }
      />

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SelectControl label="Evidence period" value={period} onChange={setPeriod}>
            {model.filters.periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectControl>
          <SelectControl label="Matchday scope" value={effectiveScope} onChange={setScope}>
            {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectControl>
          <SelectControl label="Home nation" value={homeNation} onChange={setHomeNation}>
            {model.funding.filters.homeNations.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectControl>
          <SelectControl label="Funding project" value={projectType} onChange={setProjectType}>
            {model.funding.filters.projectTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectControl>
          <SelectControl label="Opportunities" value={availability} onChange={setAvailability}>
            <option value="current">Open, upcoming and monitored</option>
            <option value="all">All verified schemes</option>
          </SelectControl>
        </div>
      </section>

      <section className="overflow-hidden rounded-[34px] bg-gradient-to-br from-slate-950 via-[#0b1d2c] to-emerald-950 text-white shadow-2xl shadow-slate-900/15">
        <div className="grid gap-8 p-7 lg:grid-cols-[1.2fr_0.8fr] lg:p-9">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusChip status={model.funding.programmes.length ? "success" : "warning"}>{model.funding.programmes.length} relevant programme{model.funding.programmes.length === 1 ? "" : "s"}</StatusChip>
              <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Verified {model.funding.coverage.lastVerified}</span>
            </div>
            <h2 className="mt-7 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">{model.funding.project.label}</h2>
            <p className="mt-4 max-w-3xl text-base font-semibold leading-8 text-slate-300">{model.funding.project.description}</p>
            <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm font-semibold leading-6 text-slate-200 ring-1 ring-white/10">{model.narrative}</div>
            {model.evidence.isUsingCurrentWeekend ? (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-slate-200 ring-1 ring-white/10">
                <AlertTriangle size={15} className="text-amber-300" /> Current matchweek used because no saved evidence exists
              </div>
            ) : null}
          </div>

          <div className={`rounded-[28px] border p-6 ${readinessTone.surface} text-slate-950`}>
            <div className="flex items-center justify-between gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${readinessTone.icon}`}><FileCheck2 size={24} strokeWidth={2.5} /></div>
              <div className={`text-4xl font-black ${readinessTone.text}`}>{operationalReadiness.display}</div>
            </div>
            <div className="mt-6 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Project evidence coverage</div>
            <div className="mt-2 text-2xl font-black">Operational records only</div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{operationalReadiness.detail}</p>
            <ProgressBar value={operationalReadiness.value || 0} tone={readinessTone.bar} className="mt-6" />
          </div>
        </div>
      </section>

      <FundingWorkspacePanel
        clubId={props.activeClubId}
        canManage={props.workspaceAccess ? props.workspaceAccess.canManageSettings : true}
        club={props.club}
        model={model}
        projectType={projectType}
        onProjectTypeChange={setProjectType}
        onImpactEvidenceChange={setImpactEvidence}
        impactEvidence={impactEvidence}
        onActiveProjectChange={setActiveFundingProject}
      />

      <Card
        eyebrow="Verified opportunities"
        title={`${model.funding.programmes.length} programme${model.funding.programmes.length === 1 ? "" : "s"} matched to this selection`}
        subtitle="Each opportunity comes from an official source, carries a last-verified date and is filtered by home nation and project type."
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Verified catalogue</div><div className="mt-2 text-2xl font-black text-slate-950">{model.funding.coverage.verifiedProgrammes}</div></div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Selected nation</div><div className="mt-2 text-2xl font-black text-slate-950">{model.funding.coverage.nationProgrammes}</div></div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Open / monitored</div><div className="mt-2 text-2xl font-black text-slate-950">{model.funding.coverage.currentNationProgrammes}</div></div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Matched now</div><div className="mt-2 text-2xl font-black text-slate-950">{model.funding.coverage.matchingProgrammes}</div></div>
          <div className={`rounded-2xl p-4 ring-1 ${model.funding.coverage.staleProgrammes ? "bg-rose-50 ring-rose-200" : "bg-emerald-50 ring-emerald-200"}`}><div className={`text-[9px] font-black uppercase tracking-[0.18em] ${model.funding.coverage.staleProgrammes ? "text-rose-600" : "text-emerald-600"}`}>Re-check required</div><div className={`mt-2 text-2xl font-black ${model.funding.coverage.staleProgrammes ? "text-rose-900" : "text-emerald-900"}`}>{model.funding.coverage.staleProgrammes}</div></div>
        </div>

        {model.funding.programmes.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {model.funding.programmes.map((programme) => <FundingOpportunityCard key={programme.id} programme={programme} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-950">No current verified programmes match this nation and project selection. Switch to all verified schemes to see closed or monitoring entries, and continue checking local sources.</div>
        )}

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-950">
          <Info size={18} className="mt-0.5 shrink-0 text-sky-700" />
          <span><strong>Coverage boundary:</strong> {model.funding.coverage.scope} {model.funding.disclaimer}</span>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Trophy} label="Fixtures scheduled" value={model.metrics.scheduledFixtures ?? model.metrics.deliveredFixtures} detail={`${model.metrics.teamOpportunitySlots} team fixture opportunities; not attendance or individual participant numbers.`} />
        <Metric icon={UsersRound} label="Participation categories" value={model.metrics.youthFixtures} detail={`${model.metrics.femaleFixtures} girls' or women's fixtures inferred from team names.`} />
        <Metric icon={CalendarClock} label="Facility use" value={`${model.metrics.facilityHours} hrs`} detail={`${model.metrics.pitchesUsed}/${model.metrics.pitchesConfigured || model.metrics.pitchesUsed} pitches represented.`} />
        <Metric icon={HeartPulse} label="Schedule completion" value={`${model.metrics.scheduleCompletionRate ?? 100 - model.metrics.postponementRate}%`} detail={`${model.metrics.postponedFixtures} postponements — ${model.metrics.postponementLabel.toLowerCase()}.`} />
      </div>

      <Card eyebrow="Evidence provenance" title="Know where every claim comes from" subtitle="Ground Control keeps direct records, calculations, inferences and manual evidence visibly separate.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {model.quality.provenance.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-black text-slate-900">{item.label}</div>
                <StatusChip status={item.status === "available" ? "success" : item.status === "partial" ? "warning" : item.status === "required" ? "info" : "danger"} size="sm">{item.status}</StatusChip>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <EvidenceMatrix framework={model.framework} />

      <Card eyebrow="Impact framework" title="Operational evidence by theme" subtitle="These measures summarise the selected records; they are not funder-specific scoring criteria.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{model.themes.map((theme) => <ThemeCard key={theme.id} theme={theme} />)}</div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card eyebrow="Evidence priorities" title="Where the operational case is strongest" subtitle="Use these as investigation prompts, then verify them against the live scheme guidance and project evidence.">
          <div className="space-y-4">{model.priorities.map((priority, index) => <PriorityCard key={priority.id} priority={priority} index={index} />)}</div>
        </Card>

        <div className="space-y-6">
          <Card eyebrow="Current matchweek" title="Live operating context" subtitle="Kept separate from the selected historical evidence period.">
            <div className="space-y-3">
              {[
                ["Fixtures scheduled", model.current.fixtures, Trophy],
                ["Officials confirmed", `${model.current.officialsConfirmed}/${model.current.fixtures}`, ClipboardCheck],
                ["Parking peak", model.current.parkingUtilisation ? `${model.current.parkingUtilisation}%` : "Pending", MapPin],
                ["Postponements", model.current.postponed, AlertTriangle],
              ].map(([label, value, Icon]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200"><Icon size={18} strokeWidth={2.5} /></div>
                    <span className="text-sm font-black text-slate-700">{label}</span>
                  </div>
                  <span className="text-lg font-black text-slate-950">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card eyebrow="Evidence gaps" title="What to improve next" subtitle="Core and project-specific evidence gaps are shown separately in the funding matches above.">
            <div className="space-y-3">
              {model.quality.gaps.slice(0, 5).map((gap) => (
                <div key={gap.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-black text-slate-900">{gap.label}</div>
                    <span className="text-sm font-black text-slate-500">{gap.value}%</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{gap.action}</p>
                </div>
              ))}
              {!model.quality.gaps.length ? (
                <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900"><Database size={18} className="mt-0.5" /> No material operational evidence gaps in the selected records.</div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
