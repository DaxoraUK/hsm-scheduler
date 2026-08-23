import { useEffect, useRef, useState } from "react";
import HeaderSearch from "../layout/HeaderSearch.jsx";
import HeaderProfile from "../layout/HeaderProfile.jsx";
import GroundControlBrand from "../components/GroundControlBrand.jsx";
import DaxoraNotificationBell from "../components/system/DaxoraNotificationBell.jsx";
import DaxoraToaster from "../components/system/DaxoraToaster.jsx";
import { useConnectivity } from "../hooks/useConnectivity.js";
import { getSyncBanner } from "../lib/errors/recovery.js";
import { getMatchdayScopeLabel, MATCHDAY_SCOPES } from "../lib/domain/matchdayScope.js";
import { createNavigationController, NAV_TARGETS } from "../lib/navigation/index.js";
import { ENTITLEMENTS, hasEntitlement } from "../lib/subscriptions/entitlements.js";
import { canOpenWorkspacePage } from "../lib/navigation/workspacePageAccess.js";
import { setDaxoraNotificationContext } from "../lib/notifications/daxoraNotifications.js";

import {
  Building2,
  CalendarDays,
  CalendarRange,
  ChartNoAxesCombined,
  Clock3,
  CloudAlert,
  Eye,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trophy,
  WifiOff,
  X,
} from "lucide-react";

function NavigationItems({ items, mainPage, onNavigate, className = "" }) {
  return (
    <nav className={`space-y-1 ${className}`} aria-label="Primary navigation">
      {items.map(([key, label, Icon, target, meta = {}]) => {
        const active = mainPage === key;
        return (
          <button
            key={key}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate(key, target)}
            className={`relative flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-bold transition ${
              active
                ? "bg-white/[0.08] text-white"
                : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            {active ? <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400" /> : null}
            <Icon size={19} strokeWidth={2.5} className={active ? "text-emerald-400" : "text-slate-500"} />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {meta.badge ? (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${active ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>
                {meta.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export default function ProductShell({
  children,
  mainPage,
  setMainPage,
  setDayTab,
  setSettingsTab,
  setNavigationTarget,
  matchdayScope = MATCHDAY_SCOPES.WEEKEND,
  club,
  satFinal = [],
  sunFinal = [],
  midweekFinal = [],
  satHasRun,
  sunHasRun,
  midweekHasRun,
  readiness,
  midweekReadiness,
  midweekEnabled = true,
  authSession,
  memberships = [],
  activeClubId = "",
  activeMembership = null,
  workspaceAccess = null,
  subscription = null,
  platformContext = null,
  platformOnly = false,
  leagueOnly = false,
  leagueMemberships = [],
  activeLeagueId = "",
  activeLeague = null,
  dbStatus = "connected",
  syncError = "",
  sessionStatus = "active",
  onRetrySync,
  onClubChange,
  onEndSupportAccess,
  onProfileUpdated,
  onSignOut,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainContentRef = useRef(null);
  const { online } = useConnectivity();
  const nav = createNavigationController({ setMainPage, setDayTab, setSettingsTab, setNavigationTarget });

  const leagueMode = mainPage === "league";
  const clubWorkspaceAvailable = !platformOnly && !leagueOnly;
  const annualPlannerAddOnAvailable = subscription?.planCode === "core"
    && !hasEntitlement(subscription, ENTITLEMENTS.ANNUAL_PLANNER);
  const workspaceNavItems = clubWorkspaceAvailable ? [
    ["dashboard", "Mission Control", LayoutDashboard, NAV_TARGETS.MISSION_CONTROL],
    ["executive", "Club Command", Building2, NAV_TARGETS.EXECUTIVE],
    ["operations", "Operations", CalendarDays, NAV_TARGETS.OPERATIONS],
    ["planner", "Annual Planner", CalendarRange, NAV_TARGETS.PLANNER, annualPlannerAddOnAvailable ? { badge: "Add-on" } : {}],
    ["communications", "Communications", MessageSquareText, NAV_TARGETS.COMMUNICATIONS],
    ["analytics", "Analytics", ChartNoAxesCombined, NAV_TARGETS.ANALYTICS],
    ["reports", "Reports", FileText, NAV_TARGETS.REPORTS],
    ["settings", "Settings", Settings, NAV_TARGETS.SETTINGS],
  ].filter(([key]) => {
    if (key === "planner" && annualPlannerAddOnAvailable) return true;
    return canOpenWorkspacePage(subscription, key, workspaceAccess);
  }) : [];

  const leagueAvailable = Boolean(platformContext?.isPlatformStaff || leagueMemberships.length);
  const leagueNavItems = leagueAvailable
    ? [["league", "League Manager", Trophy, null]]
    : [];

  const advancedOperationsEnabled = hasEntitlement(subscription, ENTITLEMENTS.OPERATIONS_ADVANCED);

  const navItems = platformContext?.isPlatformStaff
    ? [...workspaceNavItems, ...leagueNavItems, ["platform", "Daxora Admin", ShieldCheck, null]]
    : [...workspaceNavItems, ...leagueNavItems];

  const navigate = (key, target) => {
    if (key === "platform" || key === "league") {
      setMainPage(key);
      setMobileOpen(false);
      return;
    }
    nav.goTo(target, {
      day: key === "operations" ? (advancedOperationsEnabled ? "centre" : "saturday") : undefined,
      scroll: false,
    });
    setMobileOpen(false);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      mainContentRef.current?.focus?.({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mainPage]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", close);
    };
  }, [mobileOpen]);

  const satCount = satHasRun ? satFinal.filter((game) => game.status !== "postponed").length : 0;
  const sunCount = sunHasRun ? sunFinal.filter((game) => game.status !== "postponed").length : 0;
  const midweekCount = midweekEnabled && midweekHasRun
    ? midweekFinal.filter((game) => game.status !== "postponed").length
    : 0;

  const readinessPct = matchdayScope === MATCHDAY_SCOPES.MIDWEEK
    ? midweekReadiness?.pct ?? 0
    : readiness?.pct ?? 0;

  const workspaceStatus = readinessPct >= 90
    ? `${getMatchdayScopeLabel(matchdayScope)} Ready`
    : readinessPct >= 70
      ? "Almost Ready"
      : "Needs Attention";

  const syncBanner = getSyncBanner({ online, dbStatus, syncError, sessionStatus });

  useEffect(() => {
    setDaxoraNotificationContext({
      workspaceType: leagueMode || leagueOnly ? "league" : platformOnly ? "platform" : "club",
      workspaceId: leagueMode || leagueOnly ? activeLeagueId : activeClubId,
      workspaceName: leagueMode || leagueOnly ? (activeLeague?.name || "League Manager") : platformOnly ? "Daxora Platform" : (club?.name || "Ground Control"),
    });
  }, [activeClubId, activeLeague?.name, activeLeagueId, club?.name, leagueMode, leagueOnly, platformOnly]);

  const workspaceCard = leagueMode || leagueOnly ? (
    <div className="rounded-2xl border border-slate-800 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">League Manager</div>
        <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-300">Pilot</span>
      </div>
      <div className="mt-2 truncate text-sm font-black text-white">{activeLeague?.name || "League workspace"}</div>
      <div className="mt-1 text-xs font-bold text-slate-500">{activeLeague?.role?.replaceAll?.("_", " ") || "Secure league access"}</div>
    </div>
  ) : platformOnly ? (
    <div className="rounded-2xl border border-slate-800 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">Daxora platform</div>
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
      </div>
      <div className="mt-2 text-sm font-black text-white">Internal operations</div>
      <div className="mt-1 text-xs font-bold text-slate-500">{platformContext?.roleLabel || "Platform staff"}</div>
    </div>
  ) : (
    <div className="rounded-2xl border border-slate-800 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">Workspace</div>
        {subscription?.planName ? (
          <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-black text-slate-300">
            {subscription.planName}
          </span>
        ) : null}
      </div>
      <div className="mt-2 truncate text-sm font-black text-white">{club?.name || "Club workspace"}</div>
      <div className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-500">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
        <span className="truncate">{workspaceStatus}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label={`${getMatchdayScopeLabel(matchdayScope)} fixture totals`}>
        {[
          ["Sat", satCount],
          ["Sun", sunCount],
          ...(midweekEnabled ? [["Mid", midweekCount]] : []),
        ].map(([label, count]) => (
          <div key={label} className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-2.5 py-1.5">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span>
            <span className="text-xs font-black text-white">{count}</span>
          </div>
        ))}
        <div className="ml-auto self-center text-[10px] font-black uppercase tracking-wide text-slate-600">
          {getMatchdayScopeLabel(matchdayScope)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <a href="#main-content" className="fixed left-4 top-3 z-[200] -translate-y-24 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-xl transition focus:translate-y-0 focus:outline-none focus:ring-4 focus:ring-emerald-200">Skip to main content</a>
      {mobileOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="gc-sidebar-scroll relative h-full w-[min(88vw,340px)] overflow-y-auto border-r border-slate-800 bg-[#050816] px-5 py-5 text-white shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <GroundControlBrand />
              <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="mt-5">{workspaceCard}</div>
            <div className="mt-5 border-t border-slate-800 pt-5">
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">{leagueOnly ? "League workspace" : platformOnly ? "Platform" : "Operations"}</div>
              <NavigationItems items={navItems} mainPage={mainPage} onNavigate={navigate} />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen">
        <aside className="gc-sidebar-scroll sticky top-0 hidden h-screen w-[280px] shrink-0 overflow-y-auto border-r border-slate-800 bg-[#050816] px-5 py-5 text-white lg:block">
          <div className="mb-5"><GroundControlBrand /></div>
          <div>{workspaceCard}</div>
          <div className="mt-5 border-t border-slate-800 pt-5">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">{leagueOnly ? "League workspace" : platformOnly ? "Platform" : "Operations"}</div>
            <NavigationItems items={navItems} mainPage={mainPage} onNavigate={navigate} />
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button type="button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 lg:hidden">
                <Menu size={21} />
              </button>
              <div className="hidden min-w-0 flex-1 md:block">
                {leagueMode || leagueOnly ? (
                  <div>
                    <div className="text-sm font-black text-slate-950">Daxora League Manager</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">Secure league scheduling and competition operations</div>
                  </div>
                ) : platformOnly ? (
                  <div>
                    <div className="text-sm font-black text-slate-950">Daxora platform operations</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">Secure administration, subscriptions and support cases</div>
                  </div>
                ) : (
                  <HeaderSearch setMainPage={setMainPage} setDayTab={setDayTab} setNavigationTarget={setNavigationTarget} canOpenSettings={Boolean(workspaceAccess?.canManageSettings)} />
                )}
              </div>
              <div className="min-w-0 md:hidden">
                <div className="truncate text-sm font-black text-slate-950">{leagueMode || leagueOnly ? "League Manager" : "Ground Control"}</div>
                <div className="truncate text-[11px] font-bold text-slate-500">{leagueMode || leagueOnly ? activeLeague?.name : platformOnly ? "Daxora platform" : club?.name}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DaxoraNotificationBell />
              <HeaderProfile
              session={authSession}
              clubName={leagueMode || leagueOnly ? (activeLeague?.name || "League Manager") : platformOnly ? "Daxora Platform" : club?.name}
              memberships={leagueMode || leagueOnly ? [] : memberships}
              activeClubId={leagueMode || leagueOnly ? "" : activeClubId}
              activeRole={leagueMode || leagueOnly ? (activeLeague?.role || "viewer") : workspaceAccess?.role || activeMembership?.role || "viewer"}
              workspaceAccess={leagueMode || leagueOnly ? { role: activeLeague?.role || "viewer", canManageSettings: false } : workspaceAccess}
              roleLabelOverride={leagueMode || leagueOnly ? String(activeLeague?.role || "League user").replaceAll("_", " ") : platformOnly ? platformContext?.roleLabel : ""}
              platformMode={platformOnly || leagueMode || leagueOnly}
              onClubChange={onClubChange}
              onOpenSettings={(settingsTab = "overview") => nav.goToSettings({ settingsTab, scroll: false })}
              onProfileUpdated={onProfileUpdated}
              onSignOut={onSignOut}
              />
            </div>
          </header>

          {syncBanner?.kind === "offline" ? (
            <div role="status" className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-start gap-3">
                <WifiOff className="mt-0.5 shrink-0 text-amber-700" size={18} />
                <div><div className="text-sm font-black">{syncBanner.title}</div><div className="text-xs font-semibold text-amber-800">{syncBanner.message}</div></div>
              </div>
            </div>
          ) : syncBanner?.kind === "error" ? (
            <div role="alert" className="flex flex-col gap-3 border-b border-rose-200 bg-rose-50 px-4 py-3 text-rose-950 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-start gap-3">
                <CloudAlert className="mt-0.5 shrink-0 text-rose-700" size={19} />
                <div><div className="text-sm font-black">{syncBanner.title}</div><div className="text-xs font-semibold text-rose-800">{syncBanner.message}</div></div>
              </div>
              {onRetrySync ? <button type="button" onClick={onRetrySync} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 shadow-sm hover:bg-rose-100"><RefreshCw size={14} /> Retry sync</button> : null}
            </div>
          ) : syncBanner?.kind === "refreshing" ? (
            <div role="status" className="flex items-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-black text-sky-800 sm:px-6"><RefreshCw className="animate-spin" size={14} /> {syncBanner.title}</div>
          ) : null}

          {clubWorkspaceAvailable && !leagueMode ? (
            subscription?.status === "trialing" ? (
              <div className="flex items-center justify-between gap-3 border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-black text-sky-900 sm:px-6">
                <span>{subscription.planName} trial{subscription.trialEndsAt ? ` ends ${subscription.trialEndsAt.toLocaleDateString("en-GB")}` : " is active"}.</span>
                {workspaceAccess?.canManageSubscription ? <button type="button" onClick={() => nav.goToSettings({ settingsTab: "subscription", scroll: false })} className="rounded-lg border border-sky-200 bg-white px-3 py-1.5">Review plan</button> : null}
              </div>
            ) : subscription?.status === "grace" ? (
              <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-950 sm:px-6">
                <span>Subscription grace period{subscription.graceEndsAt ? ` ends ${subscription.graceEndsAt.toLocaleDateString("en-GB")}` : " is active"}.</span>
                {workspaceAccess?.canManageSubscription ? <button type="button" onClick={() => nav.goToSettings({ settingsTab: "subscription", scroll: false })} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5">Review plan</button> : null}
              </div>
            ) : subscription?.isReadOnly ? (
              <div className="flex items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black text-rose-950 sm:px-6">
                <span>{subscription.message || `${subscription.planName} is currently read only.`}</span>
                {workspaceAccess?.canManageSubscription ? <button type="button" onClick={() => nav.goToSettings({ settingsTab: "subscription", scroll: false })} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5">Subscription details</button> : null}
              </div>
            ) : null
          ) : null}

          {clubWorkspaceAvailable && !leagueMode ? (
            workspaceAccess?.isSupport ? (
              <div className="flex flex-col gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><Eye size={18} /></span>
                  <div><div className="text-sm font-black">Read-only Daxora support session</div><div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-800"><span>Every view remains attributed to the signed-in support account.</span>{workspaceAccess.supportExpiresAt ? <span className="inline-flex items-center gap-1"><Clock3 size={13} /> Expires {new Date(workspaceAccess.supportExpiresAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span> : null}</div></div>
                </div>
                <button type="button" onClick={onEndSupportAccess} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-xs font-black text-emerald-800 shadow-sm hover:bg-emerald-100"><LogOut size={15} /> End support session</button>
              </div>
            ) : workspaceAccess?.isReadOnly ? (
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-600 sm:px-6"><Eye size={15} /> Read-only viewer access</div>
            ) : null
          ) : null}

          <main id="main-content" ref={mainContentRef} tabIndex={-1} className="flex-1 overflow-auto p-4 outline-none sm:p-6 lg:p-8">
            <div
              className={clubWorkspaceAvailable && !leagueMode && workspaceAccess?.isReadOnly && mainPage !== "settings" ? "pointer-events-none" : ""}
              inert={clubWorkspaceAvailable && !leagueMode && workspaceAccess?.isReadOnly && mainPage !== "settings" ? true : undefined}
              aria-disabled={clubWorkspaceAvailable && !leagueMode && workspaceAccess?.isReadOnly && mainPage !== "settings" ? true : undefined}
            >
              {children}
            </div>
          </main>
        </div>
      </div>

      <DaxoraToaster />
    </div>
  );
}
