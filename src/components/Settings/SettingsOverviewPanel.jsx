import React from "react";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  MapPinned,
  PlugZap,
  Rocket,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import {
  isMidweekEnabled,
  isParkingEnabled,
} from "../../lib/settings/workspaceSettings.js";
import {
  ENTITLEMENTS,
  hasEntitlement,
} from "../../lib/subscriptions/entitlements.js";

function SetupCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  status,
  tone = "ready",
  metrics = [],
  onClick,
}) {
  const toneClasses = {
    ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
    attention: "border-amber-200 bg-amber-50 text-amber-800",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[220px] flex-col justify-between rounded-[26px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-950/[0.06]"
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-emerald-300">
            <Icon size={21} strokeWidth={2.4} />
          </span>
          <span
            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${toneClasses[tone] || toneClasses.neutral}`}
          >
            {status}
          </span>
        </div>
        <div className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
          {eyebrow}
        </div>
        <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
          {title}
        </h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {description}
        </p>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {metrics.map((metric) => (
            <span
              key={`${metric.label}-${metric.value}`}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600"
            >
              {metric.label}: {metric.value}
            </span>
          ))}
        </div>
        <ArrowRight
          size={18}
          className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-600"
        />
      </div>
    </button>
  );
}

export default function SettingsOverviewPanel({
  club = {},
  teamCfg = [],
  pitchCfg = [],
  refs = [],
  productionMode,
  dbStatus,
  setSettingsTab,
  startHour,
  startMin,
  endHour,
  endMin,
  onboarding = {},
  onOpenOnboarding,
  subscription,
}) {
  const sites =
    Array.isArray(club.sites) && club.sites.length
      ? club.sites
      : club.venue
        ? [{ venue: club.venue, postcode: club.postcode }]
        : [];
  const primarySite = sites.find((site) => site.isPrimary) || sites[0];
  const integrations = Object.values(club.integrations || {}).filter(
    (integration) => integration?.enabled,
  ).length;
  const matchdayEnabled = hasEntitlement(
    subscription,
    ENTITLEMENTS.MATCHDAY_SCHEDULING,
  );
  const midweekEnabled =
    hasEntitlement(subscription, ENTITLEMENTS.MIDWEEK_SCHEDULING) &&
    isMidweekEnabled(club);
  const parkingIncluded = hasEntitlement(
    subscription,
    ENTITLEMENTS.PARKING_INTELLIGENCE,
  );
  const parkingEnabled = parkingIncluded && isParkingEnabled(club);
  const officialsEnabled = hasEntitlement(
    subscription,
    ENTITLEMENTS.OFFICIALS_MANAGEMENT,
  );
  const hasVenue = Boolean(
    primarySite?.venue || primarySite?.name || club.venue,
  );
  const hasPostcode = Boolean(
    primarySite?.postcode || club.postcode || club.weatherPostcode,
  );
  const hasScheduling =
    Number.isFinite(Number(startHour)) && Number.isFinite(Number(endHour));

  const checks = [
    Boolean(club.name && club.sport),
    hasVenue && hasPostcode,
    teamCfg.length > 0,
    pitchCfg.length > 0,
    ...(matchdayEnabled ? [hasScheduling] : []),
    productionMode,
    dbStatus === "connected",
  ];
  const completed = checks.filter(Boolean).length;
  const readiness = Math.round((completed / checks.length) * 100);
  const ready = readiness === 100;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl sm:p-7">
        <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
              <Gauge size={14} /> Configuration centre
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
              Set the club up once. Let every workspace use the same truth.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300 sm:text-base">
              Ground Control now separates club setup, matchday resources,
              operating rules and data controls. Reporting and pitch closures
              live in their operational workspaces, not here.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Launch readiness
                </div>
                <div className="mt-2 text-4xl font-black">{readiness}%</div>
              </div>
              {ready ? (
                <CheckCircle2 size={30} className="text-emerald-300" />
              ) : (
                <CircleAlert size={30} className="text-amber-300" />
              )}
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`}
                style={{ width: `${readiness}%` }}
              />
            </div>
            <div className="mt-3 text-sm font-bold text-slate-300">
              {completed} of {checks.length} launch checks complete
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SetupCard
          icon={Rocket}
          eyebrow="Guided setup"
          title="Customer onboarding"
          description="Review or re-run the secure setup wizard that creates the club's operational baseline."
          status={
            onboarding.status === "complete"
              ? "Complete"
              : onboarding.status === "in_progress"
                ? "In progress"
                : "Needs setup"
          }
          tone={onboarding.status === "complete" ? "ready" : "attention"}
          metrics={[
            {
              label: "Progress",
              value:
                onboarding.status === "complete"
                  ? "8/8"
                  : `${onboarding.completedSteps?.length || 0}/8`,
            },
          ]}
          onClick={() => onOpenOnboarding?.()}
        />

        <SetupCard
          icon={Gauge}
          eyebrow="Workspace"
          title="Modules & environment"
          description="Review the workspaces included in the club plan and keep development tools away from live club staff."
          status={productionMode ? "Production" : "Development"}
          tone={productionMode ? "ready" : "attention"}
          metrics={[
            ...(hasEntitlement(subscription, ENTITLEMENTS.MIDWEEK_SCHEDULING)
              ? [{ label: "Midweek", value: midweekEnabled ? "On" : "Off" }]
              : []),
            ...(hasEntitlement(subscription, ENTITLEMENTS.PARKING_INTELLIGENCE)
              ? [{ label: "Parking", value: parkingEnabled ? "On" : "Off" }]
              : []),
            ...(!matchdayEnabled
              ? [{ label: "Operations", value: "Not in plan" }]
              : []),
          ]}
          onClick={() => setSettingsTab("workspace")}
        />

        <SetupCard
          icon={Building2}
          eyebrow="Organisation"
          title="Club profile"
          description="Keep the core organisation name, sport and contact details accurate without mixing in venues or branding controls."
          status={club.name && club.sport ? "Configured" : "Needs setup"}
          tone={club.name && club.sport ? "ready" : "attention"}
          metrics={[{ label: "Sport", value: club.sport || "Missing" }]}
          onClick={() => setSettingsTab("club")}
        />

        <SetupCard
          icon={MapPinned}
          eyebrow="Locations"
          title={parkingIncluded ? "Venues & parking" : "Venues & sites"}
          description={
            parkingIncluded
              ? "Manage every site, postcode, parking capacity and weather location from one dedicated view."
              : "Manage the club site and postcode used by fixture imports, resources and club records."
          }
          status={hasVenue && hasPostcode ? "Configured" : "Needs setup"}
          tone={hasVenue && hasPostcode ? "ready" : "attention"}
          metrics={[
            { label: "Sites", value: sites.length },
            { label: "Postcode", value: hasPostcode ? "Set" : "Missing" },
          ]}
          onClick={() => setSettingsTab("venues")}
        />

        <SetupCard
          icon={UsersRound}
          eyebrow="People"
          title={officialsEnabled ? "Teams & officials" : "Teams"}
          description={
            officialsEnabled
              ? "Maintain the operational people and teams used by scheduling, communications and intelligence."
              : "Maintain the team records used by fixture imports, communications and club resources."
          }
          status={teamCfg.length ? "Configured" : "Needs setup"}
          tone={teamCfg.length ? "ready" : "attention"}
          metrics={[
            { label: "Teams", value: teamCfg.length },
            ...(officialsEnabled
              ? [{ label: "Officials", value: refs.length }]
              : []),
          ]}
          onClick={() => setSettingsTab("teams")}
        />

        <SetupCard
          icon={Trophy}
          eyebrow="Resources"
          title="Pitches & suitability"
          description="Keep formats, surfaces, site assignments and shared-pitch relationships in one registry."
          status={pitchCfg.length ? "Configured" : "Needs setup"}
          tone={pitchCfg.length ? "ready" : "attention"}
          metrics={[
            { label: "Pitches", value: pitchCfg.length },
            ...(matchdayEnabled
              ? [{ label: "Max games", value: club.maxConcurrent || "Unset" }]
              : []),
          ]}
          onClick={() => setSettingsTab("pitches")}
        />

        {matchdayEnabled ? (
          <SetupCard
            icon={CalendarClock}
            eyebrow="Rules"
            title="Scheduling controls"
            description="Review the weekend operating window, changeover buffers and concurrent-game limit."
            status={hasScheduling ? "Configured" : "Needs setup"}
            tone={hasScheduling ? "ready" : "attention"}
            metrics={[
              {
                label: "Window",
                value: `${String(startHour ?? 8).padStart(2, "0")}:${String(startMin ?? 30).padStart(2, "0")}–${String(endHour ?? 11).padStart(2, "0")}:${String(endMin ?? 30).padStart(2, "0")}`,
              },
            ]}
            onClick={() => setSettingsTab("timing")}
          />
        ) : null}

        <SetupCard
          icon={PlugZap}
          eyebrow="Connections"
          title="Fixture sources"
          description="Configure the Full-Time FA fixture source or continue with manual fixture entry."
          status={integrations ? `${integrations} enabled` : "Not configured"}
          tone={integrations ? "ready" : "neutral"}
          metrics={[{ label: "Active", value: integrations }]}
          onClick={() => setSettingsTab("integrations")}
        />

        <SetupCard
          icon={Database}
          eyebrow="Data"
          title="Sync & backups"
          description="Check cloud status and export a portable club configuration backup before launch."
          status={dbStatus === "connected" ? "Connected" : "Needs attention"}
          tone={dbStatus === "connected" ? "ready" : "attention"}
          metrics={[
            {
              label: "Storage",
              value: dbStatus === "connected" ? "Cloud" : "Local",
            },
          ]}
          onClick={() => setSettingsTab("data")}
        />
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <ShieldCheck size={21} />
          </span>
          <div>
            <h3 className="text-lg font-black text-slate-950">
              What no longer belongs in Settings
            </h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Analytics and statistics stay in Analytics. Pitch closures stay in
              Operations, where matchday decisions are made. Product colours and
              club-logo uploads are removed so Ground Control keeps one
              consistent interface.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
