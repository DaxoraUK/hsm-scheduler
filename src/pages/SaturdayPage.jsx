import React from "react";
import MatchdayPage from "./MatchdayPage.jsx";
import MatchdayDateControl from "../components/Operations/MatchdayDateControl.jsx";

export default function SaturdayPage(props) {
  return (
    <div className="space-y-6">
      <MatchdayDateControl
        day="Saturday"
        date={props.satDate}
        dateLabel={props.satDateLabel}
        pairedDateLabel={props.sunDateLabel}
        onDateChange={props.setSatDate}
        onUseCurrentWeekend={props.useCurrentMatchWeekend}
      />
      <MatchdayPage
        day="Saturday"
        fixtureDay={props.fixtureDay}
        props={props}
        navigationTarget={props.navigationTarget}
        clearNavigationTarget={props.clearNavigationTarget}
        onOverride={props.satOv}
        hasRun={props.satHasRun}
        final={props.satFinal}
        overrides={props.satOverrides}
        unresolved={props.satUnresolved || []}
        scheduled={props.satScheduled || []}
        setScheduled={props.setSatScheduled}
        setUnresolved={props.setSatUnresolved}
        manualFixtures={props.satManual || []}
        setManualFixtures={props.setSatManual}
        showManual={props.showManual}
        setShowManual={props.setShowManual}
        conflicts={props.satConflicts || []}
        runTest={props.runSatTest}
        runLive={props.runSatLive}
        rebuildDay={props.rebuildSat}
        refreshFixtures={props.refreshSatFixtures}
        dateLabel={props.satDateLabel}
      />
    </div>
  );
}
