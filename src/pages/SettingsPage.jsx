import React from "react";

import SettingsTabs from "../components/Settings/SettingsTabs.jsx";
import SupabaseStatusBar from "../components/Settings/SupabaseStatusBar.jsx";
import ClubSettingsPanel from "../components/Settings/ClubSettingsPanel.jsx";
import TeamSettingsPanel from "../components/Settings/TeamSettingsPanel.jsx";
import TimingSettingsPanel from "../components/Settings/TimingSettingsPanel.jsx";
import PitchSettingsPanel from "../components/Settings/PitchSettingsPanel.jsx";
import RefereeSettingsPanel from "../components/Settings/RefereeSettingsPanel.jsx";
import TestDataSettingsPanel from "../components/Settings/TestDataSettingsPanel.jsx";
import PitchClosuresSettingsPanel from "../components/Settings/PitchClosuresSettingsPanel.jsx";
import HistorySettingsPanel from "../components/Settings/HistorySettingsPanel.jsx";
import StatsSettingsPanel from "../components/Settings/StatsSettingsPanel.jsx";
import AnalyticsSettingsPanel from "../components/Settings/AnalyticsSettingsPanel.jsx";
import SupabaseSettingsPanel from "../components/Settings/SupabaseSettingsPanel.jsx";

export default function SettingsPage(props) {
  const { settingsTab } = props;

  return (
    <div>
      <SettingsTabs {...props} />

      <SupabaseStatusBar {...props} />

      {settingsTab === "club" && <ClubSettingsPanel {...props} />}
      {settingsTab === "teams" && <TeamSettingsPanel {...props} />}
      {settingsTab === "timing" && <TimingSettingsPanel {...props} />}
      {settingsTab === "pitches" && <PitchSettingsPanel {...props} />}
      {settingsTab === "refs" && <RefereeSettingsPanel {...props} />}
      {settingsTab === "testdata" && <TestDataSettingsPanel {...props} />}
      {settingsTab === "closures" && <PitchClosuresSettingsPanel {...props} />}
      {settingsTab === "history" && <HistorySettingsPanel {...props} />}
      {settingsTab === "stats" && <StatsSettingsPanel {...props} />}
      {settingsTab === "analytics" && <AnalyticsSettingsPanel {...props} />}
      {settingsTab === "sheets" && <SupabaseSettingsPanel {...props} />}
    </div>
  );
}