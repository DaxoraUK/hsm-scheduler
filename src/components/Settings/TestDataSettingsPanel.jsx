import React from "react";
import TestDataManager from "../TestDataManager.jsx";
import { isSupaConfigured, supaFetch } from "../../lib/supabase.js";
import { getFixtureDayDefinition } from "../../lib/domain/fixtureDay.js";

export default function TestDataSettingsPanel({
  testSat,
  setTestSat,
  testSun,
  setTestSun,
  testMidweek,
  setTestMidweek,
  club,
  teamCfg,
}) {
  const collections = {
    sat: { fixtures: testSat, definition: getFixtureDayDefinition("saturday") },
    sun: { fixtures: testSun, definition: getFixtureDayDefinition("sunday") },
    midweek: { fixtures: testMidweek, definition: getFixtureDayDefinition("midweek") },
  };

  const saveTestData = (which) => {
    const selected = collections[which] || collections.sat;
    const fixtures = selected.fixtures || [];
    const { testStorageKey, remoteConfigKey } = selected.definition;

    try {
      localStorage.setItem(testStorageKey, JSON.stringify(fixtures));
    } catch (error) {
      // Local storage is optional.
    }

    if (isSupaConfigured()) {
      supaFetch("DELETE", `club_config?id=eq.${remoteConfigKey}`);
      supaFetch(
        "POST",
        "club_config",
        [{ id: remoteConfigKey, data: { fixtures } }],
        { Prefer: "return=minimal" }
      );
    }
  };

  return (
    <TestDataManager
      testSat={testSat}
      setTestSat={setTestSat}
      testSun={testSun}
      setTestSun={setTestSun}
      testMidweek={testMidweek}
      setTestMidweek={setTestMidweek}
      club={club}
      cfgList={teamCfg}
      onSave={saveTestData}
    />
  );
}
