import React from "react";
import {
  BadgePoundSterling,
  Building2,
  CalendarClock,
  Database,
  LayoutGrid,
  TestTube2,
  UsersRound,
} from "lucide-react";
import {
  ENTITLEMENTS,
  hasEntitlement,
} from "../../lib/subscriptions/entitlements.js";

export const SETTINGS_GROUPS = Object.freeze([
  {
    key: "overview",
    label: "Overview",
    description: "Setup progress and next actions",
    icon: LayoutGrid,
    tabs: [["overview", "Overview"]],
  },
  {
    key: "club",
    label: "Club & venues",
    description: "Identity, grounds and weather locations",
    icon: Building2,
    tabs: [
      ["club", "Club profile"],
      ["venues", "Venues & sites"],
    ],
  },
  {
    key: "resources",
    label: "Teams & resources",
    description: "Teams, pitches and officials",
    icon: UsersRound,
    tabs: [
      ["teams", "Teams"],
      ["pitches", "Pitches"],
      ["refs", "Officials"],
    ],
  },
  {
    key: "scheduling",
    label: "Scheduling",
    description: "Operating days, rules and fixture sources",
    icon: CalendarClock,
    tabs: [
      ["workspace", "Operating days"],
      ["timing", "Scheduling rules"],
      ["integrations", "Fixture sources"],
    ],
  },
  {
    key: "access-data",
    label: "Access & data",
    description: "Members, audit, history and backups",
    icon: Database,
    tabs: [
      ["access", "Access & audit"],
      ["history", "Matchweek history"],
      ["data", "Data & backups"],
    ],
  },
  {
    key: "plan",
    label: "Plan & billing",
    description: "Package, limits, billing and legal",
    icon: BadgePoundSterling,
    tabs: [
      ["subscription", "Plan & subscription"],
      ["billing", "Billing & legal"],
    ],
  },
  {
    key: "developer",
    label: "Developer tools",
    description: "Demonstration data outside production",
    icon: TestTube2,
    tabs: [["testdata", "Developer tools"]],
  },
]);

function isTabVisible({
  key,
  productionMode,
  workspaceAccess,
  subscription,
  platformContext,
}) {
  if (key === "testdata") {
    return !productionMode && Boolean(platformContext?.isPlatformStaff);
  }
  if (subscription?.isReadOnly) {
    if (key === "overview") return true;
    return (
      ["subscription", "billing"].includes(key) &&
      workspaceAccess?.canManageSubscription
    );
  }
  if (
    ["subscription", "billing"].includes(key) &&
    !workspaceAccess?.canManageSubscription
  ) {
    return false;
  }
  if (key === "access" && !workspaceAccess?.canViewAudit) return false;
  if (
    ["timing", "history"].includes(key) &&
    !hasEntitlement(subscription, ENTITLEMENTS.MATCHDAY_SCHEDULING)
  ) {
    return false;
  }
  if (
    key === "refs" &&
    !hasEntitlement(subscription, ENTITLEMENTS.OFFICIALS_MANAGEMENT)
  ) {
    return false;
  }
  return true;
}

export function getVisibleSettingsGroups(options) {
  return SETTINGS_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter(([key]) => isTabVisible({ ...options, key })),
  })).filter((group) => group.tabs.length);
}

export function getSettingsGroupKey(tab) {
  return (
    SETTINGS_GROUPS.find((group) =>
      group.tabs.some(([key]) => key === tab),
    )?.key || "overview"
  );
}

export default function SettingsTabs({
  settingsTab,
  setSettingsTab,
  productionMode,
  workspaceAccess,
  subscription,
  platformContext,
}) {
  const groups = getVisibleSettingsGroups({
    productionMode,
    workspaceAccess,
    subscription,
    platformContext,
  });
  const activeGroupKey = getSettingsGroupKey(settingsTab);

  return (
    <nav
      className="rounded-[26px] border border-slate-200 bg-white p-2 shadow-sm"
      aria-label="Settings sections"
    >
      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-1">
        {groups.map((group) => {
          const Icon = group.icon;
          const active = group.key === activeGroupKey;
          const destination = group.tabs[0]?.[0] || "overview";

          return (
            <button
              key={group.key}
              type="button"
              onClick={() => setSettingsTab(destination)}
              className={`flex min-w-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition ${
                active
                  ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  active
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <Icon size={18} strokeWidth={2.4} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">
                  {group.label}
                </span>
                <span
                  className={`mt-0.5 hidden truncate text-[11px] font-bold xl:block ${
                    active ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {group.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
