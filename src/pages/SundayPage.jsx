import React from "react";
import MatchdayPage from "./MatchdayPage.jsx";
import MatchdayDateControl from "../components/Operations/MatchdayDateControl.jsx";
import SundayManualFixtures from "../components/Operations/SundayManualFixtures.jsx";
import MatchdayScheduleCard from "../components/Operations/shared/MatchdayScheduleCard.jsx";

export default function SundayPage(props) {
  return (
    <div className="space-y-6">
      <MatchdayDateControl
        day="Sunday"
        date={props.sunDate}
        dateLabel={props.sunDateLabel}
        pairedDateLabel={props.satDateLabel}
        onDateChange={props.setSunDate}
        onUseCurrentWeekend={props.useCurrentMatchWeekend}
      />
      <MatchdayPage
        day="Sunday"
        fixtureDay={props.fixtureDay}
        props={props}
        navigationTarget={props.navigationTarget}
        clearNavigationTarget={props.clearNavigationTarget}
        onOverride={props.sunOv}
        hasRun={props.sunHasRun}
        final={props.sunFinal}
        overrides={props.sunOverrides}
        unresolved={props.sunUnresolved || []}
        scheduled={props.sunScheduled || []}
        setScheduled={props.setSunScheduled}
        setUnresolved={props.setSunUnresolved}
        manualFixtures={props.sunManual || []}
        setManualFixtures={props.setSunManual}
        showManual={props.showSunManual}
        setShowManual={props.setShowSunManual}
        conflicts={props.sunConflicts || []}
        runTest={props.runSunTest}
        runLive={props.runSunLive}
        rebuildDay={props.rebuildSun}
        dateLabel={props.sunDateLabel}
        ManualFixtures={SundayManualFixtures}
        ScheduleCard={(pageProps) => (
          <MatchdayScheduleCard
            title="Sunday Schedule"
            subtitle="Scheduled fixtures, pitch allocation and matchday controls."
            day="Sunday"
            mode={pageProps.mode}
            dateLabel={pageProps.dateLabel}
            hasRun={pageProps.hasRun}
            games={pageProps.final || pageProps.sunFinal || []}
            conflicts={pageProps.conflicts || []}
            officialConflicts={pageProps.officialConflicts || []}
            refWarnings={pageProps.refWarnings || 0}
            club={pageProps.club}
            onFixtureClick={pageProps.onFixtureClick}
          />
        )}
        closedPitches={props.closedPitches}
        toggleClosed={props.toggleClosed}
        closeAllPitches={props.closeAllPitches}
        reopenAllPitches={props.reopenAllPitches}
      />
    </div>
  );
}
