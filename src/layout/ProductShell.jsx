import { Toaster } from "sonner";
import HeaderSearch from "../layout/HeaderSearch.jsx";
import HeaderProfile from "../layout/HeaderProfile.jsx";
import GroundControlBrand from "../components/GroundControlBrand.jsx";
import { getDayTabFromScope, getMatchdayScopeLabel, MATCHDAY_SCOPES } from "../lib/domain/matchdayScope.js";
import { createNavigationController, NAV_TARGETS } from "../lib/navigation/index.js";

import {
  LayoutDashboard,
  CalendarDays,
  MessageSquareText,
  ChartNoAxesCombined,
  FileText,
  Settings,
  Clock3,
  Eye,
  LogOut,
} from "lucide-react";

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
  onClubChange,
  onEndSupportAccess,
  onSignOut,
}) {
  const nav = createNavigationController({ setMainPage, setDayTab, setSettingsTab, setNavigationTarget });

  const navItems = [
    ["dashboard", "Mission Control", LayoutDashboard, NAV_TARGETS.MISSION_CONTROL],
    ["operations", "Operations", CalendarDays, NAV_TARGETS.OPERATIONS],
    ["communications", "Communications", MessageSquareText, NAV_TARGETS.COMMUNICATIONS],
    ["analytics", "Analytics", ChartNoAxesCombined, NAV_TARGETS.ANALYTICS],
    ["reports", "Reports", FileText, NAV_TARGETS.REPORTS],
    ["settings", "Settings", Settings, NAV_TARGETS.SETTINGS],
  ].filter(([key]) => key !== "settings" || workspaceAccess?.canManageSettings);

  const satCount = satHasRun
    ? satFinal.filter((game) => game.status !== "postponed").length
    : 0;

  const sunCount = sunHasRun
    ? sunFinal.filter((game) => game.status !== "postponed").length
    : 0;

  const midweekCount = midweekEnabled && midweekHasRun
    ? midweekFinal.filter((game) => game.status !== "postponed").length
    : 0;

  const readinessPct =
    matchdayScope === MATCHDAY_SCOPES.MIDWEEK
      ? midweekReadiness?.pct ?? 0
      : readiness?.pct ?? 0;

  const workspaceStatus =
    readinessPct >= 90
      ? `${getMatchdayScopeLabel(matchdayScope)} Ready`
      : readinessPct >= 70
        ? "Almost Ready"
        : "Needs Attention";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 border-r border-slate-800 bg-[#050816] px-5 py-5 text-white lg:flex lg:flex-col">
          <div className="mb-8">
            <GroundControlBrand />
          </div>

          <div className="flex flex-1 flex-col">
            <div className="border-t border-slate-800 pt-5">
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">
                Operations
              </div>

              <nav className="space-y-1 overflow-y-auto pr-1">
                {navItems.map(([key, label, Icon, target]) => {
                  const active = mainPage === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        nav.goTo(target, {
                          day: key === "operations" ? getDayTabFromScope(matchdayScope) : undefined,
                          scroll: false,
                        });
                      }}
                      className={`relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                        active
                          ? "bg-white/[0.06] text-white"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400" />
                      )}

                      <Icon
                        size={19}
                        strokeWidth={2.5}
                        className={active ? "text-emerald-400" : "text-slate-500"}
                      />

                      <span>{label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="mt-auto border-t border-slate-800 pt-4">
              <div className="rounded-3xl border border-slate-800 bg-white/[0.04] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">
                  Workspace
                </div>

                <div className="mt-3 text-sm font-black text-white">
                  {club.name}
                </div>

                <div className="mt-1 text-xs font-bold text-slate-500">
                  {getMatchdayScopeLabel(matchdayScope)} view
                </div>

                <div className={`mt-4 grid gap-2 ${midweekEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
                  <div className="rounded-2xl bg-white/[0.04] p-2.5">
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                      Saturday
                    </div>
                    <div className="mt-1 text-lg font-black text-white">
                      {satCount}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/[0.04] p-2.5">
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                      Sunday
                    </div>
                    <div className="mt-1 text-lg font-black text-white">
                      {sunCount}
                    </div>
                  </div>

                  {midweekEnabled ? (
                    <div className="rounded-2xl bg-white/[0.04] p-2.5">
                      <div className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                        Midweek
                      </div>
                      <div className="mt-1 text-lg font-black text-white">
                        {midweekCount}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {workspaceStatus}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-6 border-b border-slate-200 bg-white/90 px-8 backdrop-blur-xl">
            <HeaderSearch
              setMainPage={setMainPage}
              setDayTab={setDayTab}
              setNavigationTarget={setNavigationTarget}
              canOpenSettings={Boolean(workspaceAccess?.canManageSettings)}
            />
            <HeaderProfile
              user={authSession?.user}
              clubName={club?.name}
              memberships={memberships}
              activeClubId={activeClubId}
              activeRole={workspaceAccess?.role || activeMembership?.role || "viewer"}
              workspaceAccess={workspaceAccess}
              onClubChange={onClubChange}
              onOpenSettings={(settingsTab = "overview") => {
                nav.goToSettings({ settingsTab, scroll: false });
              }}
              onSignOut={onSignOut}
            />
          </header>

          {workspaceAccess?.isSupport ? (
            <div className="flex flex-col gap-3 border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><Eye size={18} /></span>
                <div>
                  <div className="text-sm font-black">Read-only Daxora support session</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-800">
                    <span>Every view remains attributed to the signed-in support account.</span>
                    {workspaceAccess.supportExpiresAt ? <span className="inline-flex items-center gap-1"><Clock3 size={13} /> Expires {new Date(workspaceAccess.supportExpiresAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span> : null}
                  </div>
                </div>
              </div>
              <button type="button" onClick={onEndSupportAccess} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-xs font-black text-emerald-800 shadow-sm hover:bg-emerald-100"><LogOut size={15} /> End support session</button>
            </div>
          ) : workspaceAccess?.isReadOnly ? (
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-6 py-2.5 text-xs font-black text-slate-600"><Eye size={15} /> Read-only viewer access</div>
          ) : null}

          <main className="flex-1 overflow-auto p-8">
            <div
              className={workspaceAccess?.isReadOnly ? "pointer-events-none" : ""}
              inert={workspaceAccess?.isReadOnly || undefined}
              aria-disabled={workspaceAccess?.isReadOnly || undefined}
            >
              {children}
            </div>
          </main>
        </div>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}