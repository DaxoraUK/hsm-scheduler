import React from "react";
import MatchdayPage from "./MatchdayPage.jsx";
import SundayManualFixtures from "../components/Operations/SundayManualFixtures.jsx";
import SundaySummaryBar from "../components/Operations/SundaySummaryBar.jsx";
import SundayUnresolvedCard from "../components/Operations/SundayUnresolvedCard.jsx";
import MatchdayScheduleCard from "../components/Operations/shared/MatchdayScheduleCard.jsx";

export default function SundayPage(props) {
  return (
    <MatchdayPage
      day="Sunday"
      props={props}
      navigationTarget={props.navigationTarget}
      clearNavigationTarget={props.clearNavigationTarget}
      onOverride={props.sunOv}
      hasRun={props.sunHasRun}
      final={props.sunFinal}
      overrides={props.sunOverrides}
      dateLabel={props.sunDateLabel}
      ManualFixtures={SundayManualFixtures}
      SummaryBar={SundaySummaryBar}
      UnresolvedCard={SundayUnresolvedCard}
      ScheduleCard={(pageProps) => (
        <MatchdayScheduleCard
          title="Sunday Schedule"
          subtitle="Scheduled fixtures, pitch allocation and matchday controls."
          games={pageProps.sunFinal || []}
          club={pageProps.club}
          onFixtureClick={pageProps.onFixtureClick}
        />
      )}
      closedPitches={props.closedPitches}
      toggleClosed={props.toggleClosed}
      closeAllPitches={props.closeAllPitches}
      reopenAllPitches={props.reopenAllPitches}
    />
  );
}