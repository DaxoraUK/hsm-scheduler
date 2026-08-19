import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  CloudRain,
  CloudSun,
  Rocket,
  Snowflake,
  Sun,
  Wind,
} from "lucide-react";

function formatForecastDate(value) {
  if (!value) return "Date not selected";

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getWeatherIcon(weather = {}) {
  if (!weather.available) return AlertTriangle;

  const condition = String(weather.conditions || "").toLowerCase();
  if (/snow|sleet|frost|ice/.test(condition)) return Snowflake;
  if (/rain|shower|drizzle|storm|thunder/.test(condition)) return CloudRain;
  if (/wind|gale|breez/.test(condition)) return Wind;
  if (/clear|sun/.test(condition)) return Sun;
  if (/cloud|overcast|mist|fog/.test(condition)) return Cloud;
  return CloudSun;
}

function weatherTone(status) {
  if (status === "danger") {
    return {
      icon: "bg-rose-400/10 text-rose-200 ring-rose-300/20",
      badge: "bg-rose-400/10 text-rose-200 ring-rose-300/20",
    };
  }

  if (status === "warning") {
    return {
      icon: "bg-amber-400/10 text-amber-200 ring-amber-300/20",
      badge: "bg-amber-400/10 text-amber-200 ring-amber-300/20",
    };
  }

  return {
    icon: "bg-emerald-400/10 text-emerald-200 ring-emerald-300/20",
    badge: "bg-emerald-400/10 text-emerald-200 ring-emerald-300/20",
  };
}

export default function DashboardMissionHero({
  club,
  missionState,
  totalFixtures = 0,
  satCount = 0,
  sunCount = 0,
  midweekCount = 0,
  midweekEnabled = true,
  completedSteps = 0,
  totalSteps = 6,
  nextAction,
  issueItems = [],
  issueCount = null,
  weather = null,
  onContinue,
  secondaryAction = null,
  scopeLabel = "Weekend",
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const progress = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const ready = missionState?.tone === "success";
  const visibleIssues = issueItems.slice(0, 3);
  const totalIssues = issueCount ?? issueItems.reduce(
    (sum, item) => sum + Math.max(1, Number(item.count) || 1),
    0
  );
  const lowerScopeLabel = String(scopeLabel || "matchweek").toLowerCase();

  const displayDate = useMemo(
    () =>
      now.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "long",
      }),
    [now]
  );

  const WeatherIcon = getWeatherIcon(weather || {});
  const weatherClasses = weatherTone(weather?.status);
  const weatherDate = formatForecastDate(weather?.date);
  const weatherMetrics = [
    weather?.temperature,
    weather?.rain && weather.rain !== "—" ? `${weather.rain} rain` : null,
    weather?.wind && weather.wind !== "—" ? weather.wind : null,
  ].filter(Boolean);

  const summaryText = ready
    ? missionState?.detail || `${scopeLabel} is ready to publish.`
    : totalIssues > 0
      ? `Ground Control found ${totalIssues} item${totalIssues === 1 ? "" : "s"} requiring review before this ${lowerScopeLabel} can be published.`
      : missionState?.detail || "Ground Control has found items to check before publishing.";

  return (
    <section className="overflow-hidden rounded-[30px] bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white shadow-xl">
      <div className="grid gap-6 p-6 lg:grid-cols-[1.14fr_0.86fr] lg:p-7">
        <div className="flex min-w-0 flex-col">
          <div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] ring-1 ${
                ready
                  ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                  : "bg-amber-400/10 text-amber-200 ring-amber-300/20"
              }`}
            >
              {ready ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {missionState?.label || "Mission Control"}
            </div>

            <div className="mt-4 text-[11px] font-black uppercase tracking-[0.28em] text-emerald-300">
              Ground Control OS
            </div>

            <h1 className="mt-2 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight lg:text-5xl">
              {scopeLabel} Operations
            </h1>

            <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-300">
              {summaryText}
            </p>
          </div>

          {visibleIssues.length ? (
            <div className="mt-5 grid max-w-2xl gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleIssues.map((item) => (
                <div
                  key={item.key || item.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        item.severity === "danger" ? "bg-rose-400" : "bg-amber-300"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-black leading-5 text-white">
                        {item.label}
                      </div>
                      {item.detail ? (
                        <div className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">
                          {item.detail}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-6 border-t border-white/10 pt-5">
            {onContinue || secondaryAction?.onClick ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {onContinue ? (
                  <button
                    type="button"
                    onClick={onContinue}
                    className={`inline-flex min-h-12 items-center justify-center gap-3 whitespace-nowrap rounded-2xl px-6 py-3 text-sm font-black shadow-lg transition hover:-translate-y-0.5 active:scale-[0.98] ${
                      ready
                        ? "bg-emerald-500 text-white shadow-emerald-950/30 hover:bg-emerald-400"
                        : "bg-amber-400 text-slate-950 shadow-amber-950/20 hover:bg-amber-300"
                    }`}
                  >
                    <span>{nextAction?.title || "Continue Operations"}</span>
                    {ready ? <Rocket size={18} /> : <ArrowRight size={18} />}
                  </button>
                ) : null}

                {secondaryAction?.onClick ? (
                  <button
                    type="button"
                    onClick={secondaryAction.onClick}
                    className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-sm font-black text-slate-200 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
                  >
                    {secondaryAction.label || "Open Operations"}
                    <ArrowRight size={16} />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className={`${onContinue || secondaryAction?.onClick ? "mt-3" : ""} flex items-center gap-3 text-sm font-bold text-slate-400`}>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${ready ? "bg-emerald-400" : "bg-amber-300"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span>
                {completedSteps} of {totalSteps} matchweek checks complete
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] bg-white/10 p-5 backdrop-blur-md ring-1 ring-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
                Matchweek Status
              </div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {displayDate} · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-slate-200 ring-1 ring-white/10">
              {totalFixtures} fixture{totalFixtures === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mt-5 rounded-3xl bg-slate-950/35 p-4 ring-1 ring-white/10">
            <div className="flex items-end justify-between gap-5">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                  Matchday Readiness
                </div>
                <div className="mt-1 text-3xl font-black text-white">
                  {progress}%
                </div>
              </div>

              <div className="text-right text-sm font-bold text-slate-300">
                {completedSteps}/{totalSteps} checks
              </div>
            </div>

            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className={`mt-4 grid grid-cols-2 gap-2 ${midweekEnabled ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <MiniStat label="Saturday" value={satCount} />
            <MiniStat label="Sunday" value={sunCount} />
            {midweekEnabled ? <MiniStat label="Midweek" value={midweekCount} /> : null}
          </div>

          <div className="mt-3 rounded-3xl bg-slate-950/35 p-4 ring-1 ring-white/10">
            <div className="flex items-start gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${weatherClasses.icon}`}>
                <WeatherIcon size={24} strokeWidth={2.2} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {weather?.scopeLabel || "Matchday"} forecast · {weatherDate}
                    </div>
                    <div className="mt-1 text-base font-black text-white">
                      {weather?.available
                        ? weather?.headline || weather?.conditions || "Forecast available"
                        : weather?.headline || "Forecast unavailable"}
                    </div>
                  </div>

                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1 ${weatherClasses.badge}`}>
                    {weather?.label || "Not assessed"}
                  </span>
                </div>

                <div className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                  {weather?.available
                    ? [weather?.conditions, ...weatherMetrics].filter(Boolean).join(" · ")
                    : weather?.detail || "Connect a venue postcode and live forecast in Settings."}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Club
            </div>
            <div className="truncate text-sm font-black text-white">
              {club?.name || "Ground Control"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-white">
        {value}
      </div>
    </div>
  );
}
