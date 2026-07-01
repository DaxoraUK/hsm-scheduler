import { Toaster } from "sonner";
import HeaderSearch from "../layout/HeaderSearch.jsx";
import HeaderProfile from "../layout/HeaderProfile.jsx";

import {
  LayoutDashboard,
  CalendarDays,
  MessageSquareText,
  ChartNoAxesCombined,
  FileText,
  Settings,
} from "lucide-react";

export default function ProductShell({
  children,
  mainPage,
  setMainPage,
  setDayTab,
  club,
  satFinal = [],
  sunFinal = [],
  satHasRun,
  sunHasRun,
  readiness,
}) {
  const navItems = [
    ["dashboard", "Mission Control", LayoutDashboard],
    ["operations", "Operations", CalendarDays],
    ["communications", "Communications", MessageSquareText],
    ["analytics", "Analytics", ChartNoAxesCombined],
    ["reports", "Reports", FileText],
    ["settings", "Settings", Settings],
  ];

  const satCount = satHasRun
    ? satFinal.filter((game) => game.status !== "postponed").length
    : 0;

  const sunCount = sunHasRun
    ? sunFinal.filter((game) => game.status !== "postponed").length
    : 0;

  const readinessPct = readiness?.pct ?? 0;

  const workspaceStatus =
    readinessPct >= 90
      ? "Weekend Ready"
      : readinessPct >= 70
      ? "Almost Ready"
      : "Needs Attention";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 border-r border-slate-800 bg-[#050816] px-5 py-5 text-white lg:flex lg:flex-col">
          <div className="mb-7">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                <span className="text-xl font-black">◉</span>
              </div>

              <div>
                <div className="text-sm font-black uppercase tracking-[0.3em] text-white">
                  Ground
                </div>
                <div className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
                  Control
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col">
            <div className="border-t border-slate-800 pt-5">
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">
                Operations
              </div>

              <nav className="space-y-1 overflow-y-auto pr-1">
                {navItems.map(([key, label, Icon]) => {
                  const active = mainPage === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setMainPage(key);
                        if (key === "operations") setDayTab("saturday");
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
                  Club Administrator
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
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
            <HeaderSearch setMainPage={setMainPage} setDayTab={setDayTab} />
            <HeaderProfile />
          </header>

          <main className="flex-1 overflow-auto p-8">{children}</main>
        </div>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}