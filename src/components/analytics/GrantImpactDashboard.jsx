import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Check,
  ClipboardCheck,
  Clock3,
  Copy,
  FileCheck2,
  HeartPulse,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
} from "lucide-react";
import PageContainer from "@/ui/PageContainer.jsx";
import PageHeader from "@/ui/PageHeader.jsx";
import Card from "@/ui/Card.jsx";
import ProgressBar from "../../ui/ProgressBar.jsx";
import StatusChip from "../../ui/StatusChip.jsx";
import { buildGrantImpactModel } from "../../lib/engines/grantImpactEngine.js";

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

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            {label}
          </div>
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
      <div className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
        {theme.label}
      </div>
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
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${style}`}>
          {index + 1}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950">{priority.title}</h3>
            <StatusChip
              status={
                priority.severity === "high"
                  ? "danger"
                  : priority.severity === "positive"
                    ? "success"
                    : priority.severity === "development"
                      ? "info"
                      : "warning"
              }
              size="sm"
            >
              {priority.severity === "high"
                ? "High priority"
                : priority.severity === "positive"
                  ? "Growth case"
                  : priority.severity === "development"
                    ? "Build evidence"
                    : "Funding case"}
            </StatusChip>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{priority.detail}</p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              Evidence
            </div>
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

export default function GrantImpactDashboard(props) {
  const [copied, setCopied] = useState(false);
  const model = useMemo(() => buildGrantImpactModel(props), [props]);
  const healthTone = TONE[model.health.tone] || TONE.warning;
  const evidenceTone = TONE[model.evidence.tone] || TONE.warning;

  const copyNarrative = async () => {
    try {
      await navigator.clipboard.writeText(model.narrative);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (_error) {
      setCopied(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Club Health & Grant Impact"
        title="Turn operations into evidence"
        subtitle="Ground Control converts fixture delivery, facility demand and matchday pressure into a clear evidence base for funding applications and club planning."
        action={
          <button
            type="button"
            onClick={copyNarrative}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-900"
          >
            {copied ? <Check size={17} className="text-emerald-300" /> : <Copy size={17} className="text-emerald-300" />}
            {copied ? "Evidence copied" : "Copy funding summary"}
          </button>
        }
      />

      <section className="overflow-hidden rounded-[34px] bg-gradient-to-br from-slate-950 via-[#0b1d2c] to-emerald-950 text-white shadow-2xl shadow-slate-900/15">
        <div className="grid gap-8 p-7 lg:grid-cols-[1.25fr_0.75fr] lg:p-9">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusChip status={model.health.tone === "success" ? "success" : model.health.tone === "danger" ? "danger" : "warning"}>
                {model.health.label}
              </StatusChip>
              <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {model.evidence.recordedWeeks} recorded matchday{model.evidence.recordedWeeks === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-7 flex items-end gap-5">
              <div className="text-7xl font-black tracking-[-0.07em]">{model.health.score}</div>
              <div className="pb-2">
                <div className="text-sm font-black uppercase tracking-[0.24em] text-emerald-300">Club health</div>
                <div className="mt-1 text-lg font-bold text-slate-300">Operational evidence score</div>
              </div>
            </div>

            <p className="mt-7 max-w-3xl text-base font-semibold leading-8 text-slate-300">
              {model.narrative}
            </p>

            {model.evidence.isUsingCurrentWeekend ? (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-slate-200 ring-1 ring-white/10">
                <AlertTriangle size={15} className="text-amber-300" />
                Current weekend shown until the first matchday is saved
              </div>
            ) : null}
          </div>

          <div className={`rounded-[28px] border p-6 ${evidenceTone.surface} text-slate-950`}>
            <div className="flex items-center justify-between gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${evidenceTone.icon}`}>
                <FileCheck2 size={24} strokeWidth={2.5} />
              </div>
              <div className={`text-4xl font-black ${evidenceTone.text}`}>{model.evidence.score}%</div>
            </div>
            <div className="mt-6 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
              Grant evidence readiness
            </div>
            <div className="mt-2 text-2xl font-black">{model.evidence.label}</div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Readiness increases as the club saves matchdays and records fixture outcomes, facilities, officials and access pressure.
            </p>
            <ProgressBar value={model.evidence.score} tone={evidenceTone.bar} className="mt-6" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Trophy}
          label="Fixtures delivered"
          value={model.metrics.deliveredFixtures}
          detail={`${model.metrics.teamOpportunitySlots} team participation opportunities.`}
        />
        <Metric
          icon={UsersRound}
          label="Youth activity"
          value={model.metrics.youthFixtures}
          detail={`${model.metrics.femaleFixtures} girls' or women's fixtures evidenced.`}
        />
        <Metric
          icon={Clock3}
          label="Facility use"
          value={`${model.metrics.facilityHours} hrs`}
          detail={`${model.metrics.pitchesUsed}/${model.metrics.pitchesConfigured || model.metrics.pitchesUsed} pitches represented.`}
        />
        <Metric
          icon={HeartPulse}
          label="Fixture delivery"
          value={`${100 - model.metrics.postponementRate}%`}
          detail={`${model.metrics.postponedFixtures} postponements — ${model.metrics.postponementLabel.toLowerCase()}.`}
        />
      </div>

      <Card
        eyebrow="Impact framework"
        title="Evidence by funding theme"
        subtitle="Four clear measures translate operational performance into the language funders and facility partners expect."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {model.themes.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card
          eyebrow="Funding priorities"
          title="Evidence-led investment cases"
          subtitle="Ground Control highlights where operational data supports a credible case for funding."
        >
          <div className="space-y-4">
            {model.priorities.map((priority, index) => (
              <PriorityCard key={priority.id} priority={priority} index={index} />
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card
            eyebrow="Live weekend"
            title="Current operating position"
            subtitle="Useful context for committee meetings and immediate funding conversations."
          >
            <div className="space-y-3">
              {[
                ["Fixtures scheduled", model.current.fixtures, Trophy],
                ["Officials confirmed", `${model.current.officialsConfirmed}/${model.current.fixtures}`, ClipboardCheck],
                ["Parking peak", model.current.parkingUtilisation ? `${model.current.parkingUtilisation}%` : "Pending", MapPin],
                ["Postponements", model.current.postponed, AlertTriangle],
              ].map(([label, value, Icon]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200">
                      <Icon size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-black text-slate-700">{label}</span>
                  </div>
                  <span className="text-lg font-black text-slate-950">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card
            eyebrow="Strongest evidence"
            title="What the data proves"
            subtitle="A concise evidence checklist for grant forms, trustees and facility partners."
          >
            <div className="space-y-4">
              {[
                `${model.metrics.deliveredFixtures} fixtures delivered and recorded`,
                `${model.metrics.facilityHours} hours of organised facility use`,
                `${model.metrics.youthFixtures} youth fixtures supported`,
                `${model.metrics.parkingPressureWeeks} matchdays with significant parking pressure`,
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check size={14} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-bold leading-6 text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
