import React, { useEffect } from "react";
import { Database, Settings2, ShieldCheck } from "lucide-react";

import SettingsTabs from "../components/Settings/SettingsTabs.jsx";
import SettingsOverviewPanel from "../components/Settings/SettingsOverviewPanel.jsx";
import WorkspaceSettingsPanel from "../components/Settings/WorkspaceSettingsPanel.jsx";
import ClubSettingsPanel from "../components/Settings/ClubSettingsPanel.jsx";
import TeamSettingsPanel from "../components/Settings/TeamSettingsPanel.jsx";
import VenueSettingsPanel from "../components/Settings/VenueSettingsPanel.jsx";
import TimingSettingsPanel from "../components/Settings/TimingSettingsPanel.jsx";
import PitchSettingsPanel from "../components/Settings/PitchSettingsPanel.jsx";
import RefereeSettingsPanel from "../components/Settings/RefereeSettingsPanel.jsx";
import TestDataSettingsPanel from "../components/Settings/TestDataSettingsPanel.jsx";
import HistorySettingsPanel from "../components/Settings/HistorySettingsPanel.jsx";
import DataSettingsPanel from "../components/Settings/DataSettingsPanel.jsx";
import IntegrationSettingsPanel from "../components/Settings/IntegrationSettingsPanel.jsx";
import AccessSecurityPanel from "../components/Settings/AccessSecurityPanel.jsx";
import OnboardingSettingsPanel from "../components/Settings/OnboardingSettingsPanel.jsx";
import SubscriptionSettingsPanel from "../components/Settings/SubscriptionSettingsPanel.jsx";
import { isMidweekEnabled, isParkingEnabled } from "../lib/settings/workspaceSettings.js";

const TAB_TITLES = {
  overview: ["Settings overview", "Complete the club setup in a clear order and see what still needs attention."],
  workspace: ["Workspace", "Control optional operating days and keep development tools away from live club users."],
  subscription: ["Plan & subscription", "Review the club plan, effective entitlements, enforced limits and subscription state."],
  access: ["Access & audit", "Manage club roles, secure invitations, trusted audit history and time-limited support access."],
  onboarding: ["Setup wizard", "Run or review the guided customer onboarding flow for this club workspace."],
  club: ["Club profile", "Maintain the essential organisation details used throughout Ground Control."],
  venues: ["Venues & sites", "Configure grounds, postcodes, parking capacity and weather locations."],
  timing: ["Scheduling rules", "Set operating windows, pitch changeover buffers and concurrent-game limits."],
  teams: ["Teams", "Manage team formats, home days, match durations and pitch preferences."],
  pitches: ["Pitches", "Maintain the single pitch registry used by scheduling and intelligence."],
  refs: ["Officials", "Maintain the officials and volunteers available to matchday operations."],
  integrations: ["Fixture sources", "Configure the integrations that are genuinely available to the club."],
  history: ["Matchweek history", "Review saved matchweeks and restore a previous operational schedule."],
  data: ["Data & backups", "Review sync status and create portable configuration backups."],
  testdata: ["Developer tools", "Manage demonstration fixtures outside production mode."],
};

const LEGACY_REDIRECTS = {
  analytics: "overview",
  stats: "overview",
  closures: "pitches",
  sheets: "data",
};

export default function SettingsPage(props) {
  const { settingsTab, setSettingsTab, club = {}, productionMode, dbStatus, subscription, workspaceAccess } = props;
  const requestedTab = LEGACY_REDIRECTS[settingsTab] || settingsTab || "overview";
  const activeTab = subscription?.isReadOnly && workspaceAccess?.canManageSubscription ? "subscription" : requestedTab;
  const [title, subtitle] = TAB_TITLES[activeTab] || TAB_TITLES.overview;
  const midweekEnabled = isMidweekEnabled(club);
  const parkingEnabled = isParkingEnabled(club);
  const dataStatus = dbStatus === "connected"
    ? "Connected"
    : dbStatus === "saving"
      ? "Saving…"
      : dbStatus === "error"
        ? "Sync issue"
        : dbStatus === "loading" || dbStatus === "connecting"
          ? "Connecting…"
          : "Local only";

  useEffect(() => {
    if (activeTab !== settingsTab) setSettingsTab?.(activeTab);
  }, [activeTab, settingsTab, setSettingsTab]);

  const renderPanel = () => {
    if (activeTab === "overview") return <SettingsOverviewPanel {...props} />;
    if (activeTab === "workspace") return <WorkspaceSettingsPanel {...props} />;
    if (activeTab === "subscription") return <SubscriptionSettingsPanel {...props} />;
    if (activeTab === "access") return <AccessSecurityPanel {...props} />;
    if (activeTab === "onboarding") return <OnboardingSettingsPanel {...props} />;
    if (activeTab === "club") return <ClubSettingsPanel {...props} />;
    if (activeTab === "venues") return <VenueSettingsPanel {...props} />;
    if (activeTab === "timing") return <TimingSettingsPanel {...props} />;
    if (activeTab === "teams") return <TeamSettingsPanel {...props} />;
    if (activeTab === "pitches") return <PitchSettingsPanel {...props} />;
    if (activeTab === "refs") return <RefereeSettingsPanel {...props} />;
    if (activeTab === "integrations") return <IntegrationSettingsPanel {...props} />;
    if (activeTab === "history") return <HistorySettingsPanel {...props} />;
    if (activeTab === "data") return <DataSettingsPanel {...props} />;
    if (activeTab === "testdata" && !productionMode) return <TestDataSettingsPanel {...props} />;
    return <SettingsOverviewPanel {...props} />;
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
              <Settings2 size={14} /> Ground Control settings
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500 sm:text-base">{subtitle}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-[560px] lg:grid-cols-4">
            <HeaderMetric label="Mode" value={productionMode ? "Production" : "Development"} icon={ShieldCheck} />
            <HeaderMetric label="Midweek" value={midweekEnabled ? "Enabled" : "Hidden"} icon={Settings2} />
            <HeaderMetric label="Parking" value={parkingEnabled ? "Enabled" : "Off"} icon={Settings2} />
            <HeaderMetric label="Data" value={dataStatus} icon={Database} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="self-start xl:sticky xl:top-24">
          <SettingsTabs {...props} settingsTab={activeTab} />
        </aside>
        <div className="min-w-0">{renderPanel()}</div>
      </div>
    </div>
  );
}

function HeaderMetric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon size={15} />
        <span className="text-[9px] font-black uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className="mt-2 truncate text-sm font-black text-slate-950">{value}</div>
    </div>
  );
}
