import React, { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Car,
  ChevronDown,
  Clock3,
  Database,
  MapPinned,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
  Shapes,
  CloudRain,
  TriangleAlert,
} from "lucide-react";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusChip from "../../ui/StatusChip.jsx";
import ProgressBar from "../../ui/ProgressBar.jsx";
import EmptyState from "../../ui/EmptyState.jsx";
import { buildAnalyticsVisualisationModel } from "../../lib/engines/analyticsVisualisationEngine.js";

const DAY_OPTIONS = [
  { value: "matchweek", label: "Matchweek" },
  { value: "weekend", label: "Weekend" },
  { value: "midweek", label: "Midweek" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

function SelectControl({ label, value, onChange, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-black text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        >
          {children}
        </select>
        <ChevronDown
          size={17}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>
    </label>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  const styles = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    warning: "bg-amber-50 text-amber-700 ring-amber-100",
    danger: "bg-rose-50 text-rose-700 ring-rose-100",
    info: "bg-sky-50 text-sky-700 ring-sky-100",
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            {label}
          </div>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</div>
          <div className="mt-2 text-sm font-semibold leading-6 text-slate-500">{detail}</div>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${styles[tone]}`}>
          <Icon size={21} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

function InsightPanel({ model }) {
  const tone = model.summary.deliveryRate >= 90 ? "success" : model.summary.deliveryRate >= 75 ? "warning" : "danger";

  return (
    <section className="overflow-hidden rounded-[34px] bg-gradient-to-br from-slate-950 via-[#0b1c2b] to-emerald-950 text-white shadow-2xl shadow-slate-900/15">
      <div className="grid gap-8 p-7 lg:grid-cols-[1.2fr_0.8fr] lg:p-9">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip status={tone}>
              {model.summary.deliveryRate >= 90
                ? "Strong delivery"
                : model.summary.deliveryRate >= 75
                  ? "Performance watch"
                  : "Action required"}
            </StatusChip>
            <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              {model.selectedMatchdays} selected matchday{model.selectedMatchdays === 1 ? "" : "s"}
            </span>
          </div>

          <h2 className="mt-7 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">
            See how the club is really operating.
          </h2>
          <p className="mt-5 max-w-3xl text-base font-semibold leading-8 text-slate-300">
            {model.summary.insight}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Average load</div>
              <div className="mt-1 text-xl font-black">{model.summary.avgFixtures} fixtures</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Activity delivered</div>
              <div className="mt-1 text-xl font-black">{model.summary.facilityHours} hours</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Peak parking</div>
              <div className="mt-1 text-xl font-black">{model.summary.peakParking} vehicles</div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/20">
              <Database size={24} strokeWidth={2.5} />
            </div>
            <div className="text-4xl font-black text-emerald-300">{model.summary.evidenceScore}%</div>
          </div>
          <div className="mt-6 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            Analytics evidence depth
          </div>
          <div className="mt-2 text-2xl font-black">
            {model.summary.evidenceScore >= 80
              ? "Strong trend base"
              : model.summary.evidenceScore >= 50
                ? "Evidence developing"
                : "More matchdays needed"}
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
            Each saved matchday improves seasonal comparisons, facility evidence and operational forecasting.
          </p>
          <ProgressBar
            value={model.summary.evidenceScore}
            tone={model.summary.evidenceScore >= 80 ? "success" : "warning"}
            className="mt-6"
          />
        </div>
      </div>
    </section>
  );
}

function Panel({ id, icon: Icon, title, subtitle, badge, open, onToggle, children }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-slate-50 sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
            <Icon size={21} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">{title}</h2>
              {badge ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                  {badge}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-bold text-slate-500">{subtitle}</p>
          </div>
        </div>
        <ChevronDown
          size={22}
          strokeWidth={2.5}
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="border-t border-slate-200 p-5 sm:p-6">{children}</div> : null}
    </section>
  );
}

function ChartEmpty({ title, detail }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <BarChart3 size={28} className="mx-auto text-slate-400" />
      <div className="mt-3 text-base font-black text-slate-800">{title}</div>
      <div className="mt-2 text-sm font-semibold text-slate-500">{detail}</div>
    </div>
  );
}

function OutcomeTrend({ weekly }) {
  const max = Math.max(...weekly.map((week) => week.total), 1);

  return (
    <div>
      <div className="flex min-h-[260px] items-end gap-3 overflow-x-auto pb-2">
        {weekly.map((week) => {
          const height = Math.max(18, Math.round((week.total / max) * 210));
          const deliveredHeight = week.total ? Math.round((week.delivered / week.total) * height) : 0;
          const postponedHeight = week.total ? Math.round((week.postponed / week.total) * height) : 0;
          const cancelledHeight = Math.max(0, height - deliveredHeight - postponedHeight);

          return (
            <div key={week.id} className="flex min-w-[54px] flex-1 flex-col items-center justify-end">
              <div className="mb-2 text-xs font-black text-slate-600">{week.total}</div>
              <div
                className="flex w-full max-w-[58px] flex-col-reverse overflow-hidden rounded-t-xl bg-slate-100"
                style={{ height }}
                title={`${week.fullLabel}: ${week.delivered} delivered, ${week.postponed} postponed, ${week.cancelled} cancelled`}
              >
                <div className="bg-emerald-500" style={{ height: deliveredHeight }} />
                <div className="bg-amber-400" style={{ height: postponedHeight }} />
                <div className="bg-rose-500" style={{ height: cancelledHeight }} />
              </div>
              <div className="mt-3 whitespace-nowrap text-[10px] font-black text-slate-400">{week.label}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-xs font-bold text-slate-500">
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Delivered</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-amber-400" />Postponed</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-rose-500" />Cancelled</span>
      </div>
    </div>
  );
}

function KickOffBars({ data }) {
  const max = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="flex min-h-[250px] items-end gap-2 overflow-x-auto pb-2">
      {data.map((item) => (
        <div key={item.label} className="flex min-w-[48px] flex-1 flex-col items-center justify-end">
          <div className="mb-2 text-xs font-black text-slate-600">{item.count}</div>
          <div
            className="w-full max-w-[54px] rounded-t-xl bg-gradient-to-t from-emerald-700 to-emerald-400"
            style={{ height: Math.max(12, Math.round((item.count / max) * 190)) }}
            title={`${item.label}: ${item.count} fixtures`}
          />
          <div className="mt-3 -rotate-45 whitespace-nowrap text-[10px] font-black text-slate-400">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function ParkingLine({ weekly }) {
  const width = 760;
  const height = 250;
  const padding = { left: 42, right: 24, top: 20, bottom: 42 };
  const maxValue = Math.max(
    ...weekly.map((week) => week.parkingPeak),
    ...weekly.map((week) => week.parkingCapacity || 0),
    1
  );
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const x = (index) =>
    padding.left + (weekly.length <= 1 ? chartWidth / 2 : (index / (weekly.length - 1)) * chartWidth);
  const y = (value) => padding.top + chartHeight - (value / maxValue) * chartHeight;
  const demandPoints = weekly.map((week, index) => `${x(index)},${y(week.parkingPeak)}`).join(" ");
  const capacityWeeks = weekly.filter((week) => week.parkingEnabled !== false && week.parkingCapacity > 0);
  const capacityPoints = weekly.map((week, index) => `${x(index)},${y(week.parkingCapacity || 0)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[680px] w-full" role="img" aria-label="Parking pressure trend">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const value = Math.round(maxValue * ratio);
          const gridY = y(value);
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={gridY} y2={gridY} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padding.left - 8} y={gridY + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{value}</text>
            </g>
          );
        })}
        {capacityWeeks.length > 0 && weekly.length > 1 ? (
          <polyline points={capacityPoints} fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="7 6" />
        ) : null}
        {weekly.length === 1 && capacityWeeks.length ? (
          <line x1={padding.left} x2={width - padding.right} y1={y(weekly[0].parkingCapacity)} y2={y(weekly[0].parkingCapacity)} stroke="#f43f5e" strokeWidth="2" strokeDasharray="7 6" />
        ) : null}
        {capacityWeeks.length ? (
          <text x={width - padding.right} y={14} textAnchor="end" fontSize="10" fontWeight="700" fill="#e11d48">Saved capacity</text>
        ) : null}
        {weekly.length > 1 ? (
          <polyline points={demandPoints} fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {weekly.map((week, index) => (
          <g key={week.id}>
            <circle
              cx={x(index)}
              cy={y(week.parkingPeak)}
              r="6"
              fill={week.parkingOver ? "#f43f5e" : week.parkingEnabled === false ? "#94a3b8" : "#10b981"}
              stroke="white"
              strokeWidth="3"
            />
            <text x={x(index)} y={y(week.parkingPeak) - 12} textAnchor="middle" fontSize="11" fontWeight="800" fill="#334155">{week.parkingPeak}</text>
            <text x={x(index)} y={height - 13} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8">{week.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function HorizontalBars({ data }) {
  const max = Math.max(...data.map((item) => item.total), 1);

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.pitchId}>
          <div className="mb-2 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-800">{item.label}</div>
              <div className="truncate text-xs font-semibold text-slate-400">{item.description || "Configured playing area"}</div>
            </div>
            <div className="shrink-0 text-sm font-black text-slate-700">{item.total}</div>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-emerald-400"
              style={{ width: `${Math.max(4, (item.total / max) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            <span>{item.share}% of recorded use</span>
            <span>{item.postponementRate}% postponed</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatCell({ value, max, label }) {
  const intensity = max ? value / max : 0;
  const style =
    value === 0
      ? { backgroundColor: "#f8fafc", color: "#cbd5e1" }
      : intensity > 0.72
        ? { backgroundColor: "#047857", color: "white" }
        : intensity > 0.42
          ? { backgroundColor: "#34d399", color: "#064e3b" }
          : { backgroundColor: "#d1fae5", color: "#065f46" };

  return (
    <td className="min-w-[58px] border border-white p-0 text-center" title={label}>
      <div className="flex h-11 items-center justify-center text-xs font-black" style={style}>
        {value || "–"}
      </div>
    </td>
  );
}

function PitchHeatmap({ rows, weekly }) {
  const max = Math.max(...rows.flatMap((row) => row.values.map((value) => value.count)), 1);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-10 min-w-[150px] border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Pitch
            </th>
            {weekly.map((week) => (
              <th key={week.id} className="min-w-[58px] border-b border-slate-200 px-2 py-3 text-center text-[10px] font-black text-slate-400">
                {week.label}
              </th>
            ))}
            <th className="border-b border-l border-slate-200 px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.pitchId}>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3 text-left font-black text-slate-700">
                {row.label}
              </th>
              {row.values.map((value) => (
                <HeatCell
                  key={`${row.pitchId}-${value.weekId}`}
                  value={value.count}
                  max={max}
                  label={`${row.label}, ${value.label}: ${value.count} fixtures`}
                />
              ))}
              <td className="border-b border-l border-slate-200 px-4 py-3 text-center font-black text-emerald-700">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimeHeatmap({ rows }) {
  const slots = rows[0]?.values.map((value) => value.slot) || [];
  const max = Math.max(...rows.flatMap((row) => row.values.map((value) => value.count)), 1);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-10 min-w-[120px] border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Matchday
            </th>
            {slots.map((slot) => (
              <th key={slot} className="min-w-[58px] border-b border-slate-200 px-2 py-3 text-center text-[10px] font-black text-slate-400">
                {slot}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day}>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3 text-left font-black text-slate-700">
                {row.label}
              </th>
              {row.values.map((value) => (
                <HeatCell
                  key={`${row.day}-${value.slot}`}
                  value={value.count}
                  max={max}
                  label={`${row.label} ${value.slot}: ${value.count} fixtures`}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoverageBars({ weekly }) {
  return (
    <div className="space-y-4">
      {weekly.map((week) => {
        const tone = week.officialCoverage >= 90 ? "bg-emerald-500" : week.officialCoverage >= 70 ? "bg-amber-400" : "bg-rose-500";
        return (
          <div key={week.id}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-sm font-black text-slate-700">{week.fullLabel}</span>
              <span className="text-sm font-black text-slate-700">{week.officialCoverage}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${tone}`} style={{ width: `${week.officialCoverage}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankedPerformance({ data, kind = "team" }) {
  const max = Math.max(...data.map((item) => item.total), 1);
  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.key || item.label}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-800">{item.label}</div>
              <div className="mt-1 text-xs font-semibold text-slate-400">
                {item.delivered} scheduled · {item.postponed} postponed · {item.cancelled} cancelled
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-slate-800">{item.total} fixtures</div>
              <div className="text-xs font-bold text-slate-400">{item.facilityHours} hours</div>
            </div>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${kind === "format" ? "bg-sky-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(3, (item.total / max) * 100)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
            <span>{item.deliveryRate}% delivery</span>
            <span>{item.officialCoverage}% officials</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsVisualDashboard({ midweekEnabled = true, ...props }) {
  const [period, setPeriod] = useState("all");
  const [matchday, setMatchday] = useState("all");
  const [day, setDay] = useState("matchweek");
  const [team, setTeam] = useState("all");
  const [pitch, setPitch] = useState("all");
  const [format, setFormat] = useState("all");
  const [openPanels, setOpenPanels] = useState(() => new Set());

  const dayOptions = midweekEnabled
    ? DAY_OPTIONS
    : DAY_OPTIONS.filter((option) => !["matchweek", "midweek"].includes(option.value));

  const effectiveDay = !midweekEnabled && ["matchweek", "midweek"].includes(day) ? "weekend" : day;

  const model = useMemo(
    () => buildAnalyticsVisualisationModel({
      ...props,
      period,
      matchday,
      day: effectiveDay,
      team,
      pitch,
      format,
    }),
    [props, period, matchday, effectiveDay, team, pitch, format]
  );

  const togglePanel = (id) => {
    setOpenPanels((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const changePeriod = (value) => {
    setPeriod(value);
    setMatchday("all");
  };

  const changeMatchday = (value) => {
    setMatchday(value);
    if (value !== "all") setPeriod("all");
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Performance Analytics"
        title="Understand every matchday"
        subtitle="Track delivery, pitch usage, congestion, parking and officials using the club's saved operational history. No invented figures and no hidden assumptions."
        action={
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 shadow-sm">
            <CalendarDays size={17} className="text-emerald-600" />
            {model.savedMatchdays} saved matchday{model.savedMatchdays === 1 ? "" : "s"}
          </div>
        }
      />

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SelectControl label="Reporting period" value={period} onChange={changePeriod}>
            {model.filters.periodOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectControl>
          <SelectControl label="Specific matchday" value={matchday} onChange={changeMatchday}>
            {model.filters.matchdayOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectControl>
          <SelectControl label="Matchday scope" value={effectiveDay} onChange={setDay}>
            {dayOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectControl>
          <SelectControl label="Team" value={team} onChange={setTeam}>
            {model.filters.teamOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectControl>
          <SelectControl label="Pitch" value={pitch} onChange={setPitch}>
            {model.filters.pitchOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectControl>
          <SelectControl label="Format" value={format} onChange={setFormat}>
            {model.filters.formatOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectControl>
        </div>
      </section>

      {!model.hasData ? (
        <EmptyState
          icon={Database}
          title={model.savedMatchdays ? "No data matches these filters" : "No saved matchday data yet"}
          description={model.savedMatchdays ? "Change the reporting period, matchday scope, team, pitch or format filter." : "Build, publish and save completed matchweeks to unlock fixture trends, pitch heatmaps, parking pressure and officials coverage."}
        />
      ) : (
        <>
          <InsightPanel model={model} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Trophy}
              label="Delivery rate"
              value={`${model.summary.deliveryRate}%`}
              detail={`${model.summary.delivered} scheduled from ${model.summary.total} recorded outcomes`}
              tone={model.summary.deliveryRate >= 90 ? "success" : "warning"}
            />
            <MetricCard
              icon={MapPinned}
              label="Busiest pitch"
              value={model.summary.busiestPitch?.label || "–"}
              detail={model.summary.busiestPitch ? `${model.summary.busiestPitch.total} recorded uses` : "No pitch data"}
              tone="info"
            />
            <MetricCard
              icon={Clock3}
              label="Peak kick-off"
              value={model.summary.busiestSlot?.label || "–"}
              detail={model.summary.busiestSlot ? `${model.summary.busiestSlot.count} fixtures in this slot` : "No kick-off data"}
              tone="warning"
            />
            <MetricCard
              icon={ShieldCheck}
              label="Officials coverage"
              value={`${model.summary.officialCoverage}%`}
              detail={`${model.summary.officialOutstanding} appointments outstanding`}
              tone={model.summary.officialCoverage >= 90 ? "success" : "danger"}
            />
            <MetricCard
              icon={TriangleAlert}
              label="Unresolved fixtures"
              value={model.summary.unresolved}
              detail={`${model.summary.placementRate}% of fixture records have an outcome`}
              tone={model.summary.unresolved ? "danger" : "success"}
            />
            <MetricCard
              icon={Activity}
              label="Facility activity"
              value={`${model.summary.facilityHours} hrs`}
              detail={`${model.summary.avgFixtures} fixtures per selected matchday`}
              tone="info"
            />
            <MetricCard
              icon={Car}
              label="Parking pressure"
              value={model.summary.parkingOverCapacity}
              detail={`Peak recorded demand ${model.summary.peakParking} vehicles`}
              tone={model.summary.parkingOverCapacity ? "danger" : "success"}
            />
            <MetricCard
              icon={CloudRain}
              label="Weather evidence"
              value={`${model.summary.weatherCoverage}%`}
              detail={`${model.summary.weatherHigh} high risk · ${model.summary.weatherWatch} watch`}
              tone={model.summary.weatherHigh ? "danger" : model.summary.weatherWatch ? "warning" : "neutral"}
            />
          </div>

          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Sparkles size={20} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Ground Control insight</div>
                <p className="mt-2 text-sm font-bold leading-6 text-emerald-950">{model.summary.insight}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Panel
              id="fixture-trends"
              icon={Activity}
              title="Fixture delivery trend"
              subtitle="Delivered, postponed and cancelled fixtures by saved matchday."
              badge={`${model.summary.total} fixtures`}
              open={openPanels.has("fixture-trends")}
              onToggle={togglePanel}
            >
              {model.weekly.length ? <OutcomeTrend weekly={model.weekly} /> : <ChartEmpty title="No fixture trend yet" detail="Save more than one matchday to build a trend." />}
            </Panel>

            <Panel
              id="kickoff-pressure"
              icon={Clock3}
              title="Kick-off demand and time pressure"
              subtitle="See the time bands carrying the greatest operational load."
              badge={model.summary.busiestSlot?.label || "No peak"}
              open={openPanels.has("kickoff-pressure")}
              onToggle={togglePanel}
            >
              <div className="space-y-8">
                {model.kickOffDistribution.length ? <KickOffBars data={model.kickOffDistribution} /> : <ChartEmpty title="No kick-off data" detail="Scheduled kick-off times will appear here." />}
                {model.dayTimeHeatmap[0]?.values.length ? (
                  <div>
                    <div className="mb-4 text-sm font-black text-slate-800">Day and time heatmap</div>
                    <TimeHeatmap rows={model.dayTimeHeatmap} />
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel
              id="pitch-use"
              icon={MapPinned}
              title="Pitch utilisation and rotation"
              subtitle="Identify heavily used pitches, recovery pressure and uneven allocation."
              badge={`${model.pitchUtilisation.length} pitches`}
              open={openPanels.has("pitch-use")}
              onToggle={togglePanel}
            >
              <div className="grid gap-8 xl:grid-cols-[0.75fr_1.25fr]">
                {model.pitchUtilisation.length ? <HorizontalBars data={model.pitchUtilisation} /> : <ChartEmpty title="No pitch usage data" detail="Pitch assignments will appear after saved matchdays." />}
                {model.pitchHeatmap.length ? (
                  <div>
                    <div className="mb-4 text-sm font-black text-slate-800">Pitch rotation heatmap</div>
                    <PitchHeatmap rows={model.pitchHeatmap} weekly={model.weekly} />
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel
              id="parking-pressure"
              icon={Car}
              title="Parking pressure trend"
              subtitle="Compare predicted matchday demand with configured site capacity."
              badge={`${model.summary.parkingOverCapacity} over capacity`}
              open={openPanels.has("parking-pressure")}
              onToggle={togglePanel}
            >
              {model.weekly.some((week) => week.parkingPeak > 0) ? (
                <>
                  <ParkingLine weekly={model.weekly} />
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Configured capacity</div>
                      <div className="mt-2 text-2xl font-black text-slate-900">{model.parkingCapacity}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Season peak</div>
                      <div className="mt-2 text-2xl font-black text-slate-900">{model.summary.peakParking}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Pressure matchdays</div>
                      <div className="mt-2 text-2xl font-black text-slate-900">{model.summary.parkingOverCapacity}</div>
                    </div>
                  </div>
                </>
              ) : (
                <ChartEmpty title="No parking trend yet" detail="Parking demand appears when saved fixtures contain kick-off times and formats." />
              )}
            </Panel>

            <Panel
              id="officials-coverage"
              icon={ShieldCheck}
              title="Officials coverage"
              subtitle="Track confirmed appointment coverage across saved matchdays."
              badge={`${model.summary.officialCoverage}% overall`}
              open={openPanels.has("officials-coverage")}
              onToggle={togglePanel}
            >
              {model.weekly.length ? <CoverageBars weekly={model.weekly} /> : <ChartEmpty title="No officials trend yet" detail="Confirmed appointments will appear here." />}
            </Panel>

            <Panel
              id="team-performance"
              icon={UsersRound}
              title="Team activity and delivery"
              subtitle="Compare fixture volume, delivered hours, postponements and officials coverage by team."
              badge={`${model.teamPerformance.length} teams`}
              open={openPanels.has("team-performance")}
              onToggle={togglePanel}
            >
              {model.teamPerformance.length ? <RankedPerformance data={model.teamPerformance} /> : <ChartEmpty title="No team trend yet" detail="Team activity appears after saved matchdays contain fixtures." />}
            </Panel>

            <Panel
              id="format-demand"
              icon={Shapes}
              title="Format demand"
              subtitle="Understand how 3v3, 5v5, 7v7, 9v9 and 11v11 activity uses the facility."
              badge={`${model.formatDistribution.length} formats`}
              open={openPanels.has("format-demand")}
              onToggle={togglePanel}
            >
              {model.formatDistribution.length ? <RankedPerformance data={model.formatDistribution} kind="format" /> : <ChartEmpty title="No format trend yet" detail="Fixture formats will appear here when they are recorded." />}
            </Panel>

            <Panel
              id="weather-evidence"
              icon={CloudRain}
              title="Weather evidence coverage"
              subtitle="Show only weather-risk snapshots actually saved with historical fixture records."
              badge={`${model.weather.coverage}% captured`}
              open={openPanels.has("weather-evidence")}
              onToggle={togglePanel}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-5">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Historical coverage</div>
                  <div className="mt-2 text-3xl font-black text-slate-950">{model.weather.coverage}%</div>
                </div>
                <div className="rounded-2xl bg-rose-50 p-5">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-500">High-risk fixtures</div>
                  <div className="mt-2 text-3xl font-black text-rose-800">{model.weather.high}</div>
                </div>
                <div className="rounded-2xl bg-amber-50 p-5">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600">Watch fixtures</div>
                  <div className="mt-2 text-3xl font-black text-amber-800">{model.weather.watch}</div>
                </div>
              </div>
              {model.weather.coverage === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                  Earlier saved matchdays do not contain weather snapshots. Ground Control does not substitute today's forecast for historical conditions. Future snapshot capture can build this evidence safely.
                </div>
              ) : null}
            </Panel>
          </div>
        </>
      )}
    </PageContainer>
  );
}
