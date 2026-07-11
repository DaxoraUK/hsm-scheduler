import React, { useEffect } from "react";
import { Database, Settings2 } from "lucide-react";

import SettingsTabs, {
  getSettingsGroupKey,
  getVisibleSettingsGroups,
} from "../components/Settings/SettingsTabs.jsx";
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
import CommunicationsPrivacyPanel from "../components/Settings/CommunicationsPrivacyPanel.jsx";
import OnboardingSettingsPanel from "../components/Settings/OnboardingSettingsPanel.jsx";
import SubscriptionSettingsPanel from "../components/Settings/SubscriptionSettingsPanel.jsx";
import BillingLegalPanel from "../components/Settings/BillingLegalPanel.jsx";
import {
  ENTITLEMENTS,
  hasEntitlement,
} from "../lib/subscriptions/entitlements.js";

const TAB_TITLES = {
  overview: [
    "Settings overview",
    "Complete the club setup in a clear order and see what still needs attention.",
  ],
  workspace: [
    "Workspace",
    "Control optional operating days and keep development tools away from live club users.",
  ],
  subscription: [
    "Plan & subscription",
    "Review the club plan, effective entitlements, enforced limits and subscription state.",
  ],
  billing: [
    "Billing & legal",
    "Review commercial documents, payment readiness, invoices and secure subscription management.",
  ],
  access: [
    "Access & audit",
    "Manage club roles, secure invitations, trusted audit history and time-limited support access.",
  ],
  privacy: [
    "Privacy & coach contacts",
    "Document the purpose, lawful basis, privacy notice and retention controls for adult coach communications.",
  ],
  onboarding: [
    "Setup wizard",
    "Run or review the guided customer onboarding flow for this club workspace.",
  ],
  club: [
    "Club profile",
    "Maintain the essential organisation details used throughout Ground Control.",
  ],
  venues: [
    "Venues & sites",
    "Configure grounds, postcodes, parking capacity and weather locations.",
  ],
  timing: [
    "Scheduling rules",
    "Set operating windows, pitch changeover buffers and concurrent-game limits.",
  ],
  teams: [
    "Teams",
    "Manage team formats, home days, match durations and pitch preferences.",
  ],
  pitches: [
    "Pitches",
    "Maintain the single pitch registry used by scheduling and intelligence.",
  ],
  refs: [
    "Officials",
    "Maintain the officials and volunteers available to matchday operations.",
  ],
  integrations: [
    "Fixture sources",
    "Configure the integrations that are genuinely available to the club.",
  ],
  history: [
    "Matchweek history",
    "Review saved matchweeks and restore a previous operational schedule.",
  ],
  data: [
    "Data & backups",
    "Review sync status and create portable configuration backups.",
  ],
  testdata: [
    "Developer tools",
    "Manage demonstration fixtures outside production mode.",
  ],
};

const LEGACY_REDIRECTS = {
  analytics: "overview",
  stats: "overview",
  closures: "pitches",
  sheets: "data",
};

const TAB_ENTITLEMENTS = {
  timing: ENTITLEMENTS.MATCHDAY_SCHEDULING,
  history: ENTITLEMENTS.MATCHDAY_SCHEDULING,
  refs: ENTITLEMENTS.OFFICIALS_MANAGEMENT,
};

export default function SettingsPage(props) {
  const {
    settingsTab,
    setSettingsTab,
    productionMode,
    dbStatus,
    subscription,
    workspaceAccess,
    platformContext,
  } = props;
  const visibleGroups = getVisibleSettingsGroups({
    productionMode,
    workspaceAccess,
    subscription,
    platformContext,
  });
  const visibleTabs = new Set(
    visibleGroups.flatMap((group) => group.tabs.map(([key]) => key)),
  );
  const requestedTab =
    LEGACY_REDIRECTS[settingsTab] || settingsTab || "overview";
  const developerToolsAllowed =
    !productionMode && Boolean(platformContext?.isPlatformStaff);
  const permittedTab =
    requestedTab === "testdata" && !developerToolsAllowed
      ? "overview"
      : requestedTab;
  const requiredEntitlement = TAB_ENTITLEMENTS[permittedTab];
  const entitledTab =
    requiredEntitlement && !hasEntitlement(subscription, requiredEntitlement)
      ? "overview"
      : permittedTab;
  const candidateTab =
    subscription?.isReadOnly && workspaceAccess?.canManageSubscription
      ? "subscription"
      : entitledTab;
  const activeTab = visibleTabs.has(candidateTab)
    ? candidateTab
    : visibleGroups[0]?.tabs?.[0]?.[0] || "overview";
  const activeGroupKey = getSettingsGroupKey(activeTab);
  const activeGroup = visibleGroups.find(
    (group) => group.key === activeGroupKey,
  );
  const [title, subtitle] = TAB_TITLES[activeTab] || TAB_TITLES.overview;
  const dataStatus =
    dbStatus === "connected"
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
    if (activeTab === "subscription")
      return <SubscriptionSettingsPanel {...props} />;
    if (activeTab === "billing") return <BillingLegalPanel {...props} />;
    if (activeTab === "access") return <AccessSecurityPanel {...props} />;
    if (activeTab === "privacy") return <CommunicationsPrivacyPanel {...props} />;
    if (activeTab === "onboarding")
      return <OnboardingSettingsPanel {...props} />;
    if (activeTab === "club") return <ClubSettingsPanel {...props} />;
    if (activeTab === "venues") return <VenueSettingsPanel {...props} />;
    if (activeTab === "timing") return <TimingSettingsPanel {...props} />;
    if (activeTab === "teams") return <TeamSettingsPanel {...props} />;
    if (activeTab === "pitches") return <PitchSettingsPanel {...props} />;
    if (activeTab === "refs") return <RefereeSettingsPanel {...props} />;
    if (activeTab === "integrations")
      return <IntegrationSettingsPanel {...props} />;
    if (activeTab === "history") return <HistorySettingsPanel {...props} />;
    if (activeTab === "data") return <DataSettingsPanel {...props} />;
    if (activeTab === "testdata" && developerToolsAllowed)
      return <TestDataSettingsPanel {...props} />;
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
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500 sm:text-base">
              {subtitle}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-slate-600 lg:self-auto">
            <Database size={16} className="text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Data
            </span>
            <span className="text-sm font-black text-slate-950">
              {dataStatus}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="self-start xl:sticky xl:top-24">
          <SettingsTabs {...props} settingsTab={activeTab} />
        </aside>
        <div className="min-w-0 space-y-4">
          {activeGroup?.tabs?.length > 1 ? (
            <SettingsSubnavigation
              tabs={activeGroup.tabs}
              activeTab={activeTab}
              onChange={setSettingsTab}
            />
          ) : null}
          {renderPanel()}
        </div>
      </div>
    </div>
  );
}

function SettingsSubnavigation({ tabs = [], activeTab, onChange }) {
  return (
    <nav
      className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
      aria-label="Settings subsection"
    >
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange?.(key)}
          className={`shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-black transition ${
            activeTab === key
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
