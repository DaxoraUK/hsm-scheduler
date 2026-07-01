import React from "react";
import MatchdayPage from "./MatchdayPage.jsx";

export default function SaturdayPage(props) {
  return (
    <MatchdayPage
      day="Saturday"
      props={props}
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
      dateLabel={props.satDateLabel}
    />
  );
}
