import React from "react";
import {
  BadgePoundSterling,
  ReceiptText,
  Building2,
  CalendarClock,
  Database,
  Gauge,
  History,
  LayoutGrid,
  MapPinned,
  PlugZap,
  Rocket,
  ShieldCheck,
  TestTube2,
  Trophy,
  UsersRound,
} from "lucide-react";

const TAB_GROUPS = [
  {
    label: "Workspace",
    tabs: [
      ["overview", "Overview", LayoutGrid],
      ["workspace", "Workspace", Gauge],
      ["subscription", "Plan & subscription", BadgePoundSterling],
      ["billing", "Billing & legal", ReceiptText],
      ["onboarding", "Setup wizard", Rocket],
      ["access", "Access & audit", ShieldCheck],
    ],
  },
  {
    label: "Club setup",
    tabs: [
      ["club", "Club profile", Building2],
      ["venues", "Venues & sites", MapPinned],
      ["timing", "Scheduling rules", CalendarClock],
    ],
  },
  {
    label: "Matchday setup",
    tabs: [
      ["teams", "Teams", UsersRound],
      ["pitches", "Pitches", Trophy],
      ["refs", "Officials", ShieldCheck],
    ],
  },
  {
    label: "Connections & data",
    tabs: [
      ["integrations", "Fixture sources", PlugZap],
      ["history", "Matchweek history", History],
      ["data", "Data & backups", Database],
      ["testdata", "Developer tools", TestTube2],
    ],
  },
];

export default function SettingsTabs({ settingsTab, setSettingsTab, productionMode, workspaceAccess, subscription }) {
  const groups = TAB_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter(([key]) => {
      if (subscription?.isReadOnly && key !== "subscription") return false;
      if (productionMode && key === "testdata") return false;
      if (["subscription", "billing"].includes(key) && !workspaceAccess?.canManageSubscription) return false;
      if (key === "access" && !workspaceAccess?.canViewAudit) return false;
      if (key === "onboarding" && !workspaceAccess?.canManageSettings) return false;
      return true;
    }),
  })).filter((group) => group.tabs.length);

  return (
    <nav className="rounded-[26px] border border-slate-200 bg-white p-3 shadow-sm" aria-label="Settings sections">
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.label}>
            <div className="px-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{group.label}</div>
            <div className="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-1">
              {group.tabs.map(([key, label, Icon]) => {
                const active = settingsTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSettingsTab(key)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-black transition ${
                      active ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-emerald-400/15 text-emerald-300" : "bg-slate-100 text-slate-400"}`}>
                      <Icon size={18} strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0 truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}
