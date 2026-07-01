import React from "react";
import TestDataManager from "../TestDataManager.jsx";
import { isSupaConfigured, supaFetch } from "../../lib/supabase.js";

export default function TestDataSettingsPanel({
  testSat,
  setTestSat,
  testSun,
  setTestSun,
  club,
  teamCfg,
}) {
  const saveTestData = (which) => {
    try {
      if (which === "sat") {
        localStorage.setItem("hsm_testsat", JSON.stringify(testSat));
      } else {
        localStorage.setItem("hsm_testsun", JSON.stringify(testSun));
      }
    } catch (e) {}

    if (isSupaConfigured()) {
      const tbl = which === "sat" ? testSat : testSun;
      const key = which === "sat" ? "testsat" : "testsun";

      supaFetch("DELETE", "club_config?id=eq." + key);
      supaFetch(
        "POST",
        "club_config",
        [{ id: key, data: { fixtures: tbl } }],
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
      club={club}
      cfgList={teamCfg}
      onSave={saveTestData}
    />
  );
}