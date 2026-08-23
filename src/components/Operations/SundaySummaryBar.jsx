import SaturdaySummaryBar from "./SaturdaySummaryBar.jsx";
import { isFixtureOfficialConfirmed } from "../../lib/engines/officialsEngine.js";

export default function SundaySummaryBar(props) {
  const sunActive = (props.sunFinal || []).filter(
    (fixture) => fixture.status !== "postponed"
  );

  const sunPostponed = (props.sunFinal || []).filter(
    (fixture) => fixture.status === "postponed"
  );

  const sunRefWarnings = (props.sunFinal || []).filter(
    (fixture) =>
      fixture.status !== "postponed" &&
      !isFixtureOfficialConfirmed(fixture)
  ).length;

  return (
    <SaturdaySummaryBar
      {...props}
      satFinal={props.sunFinal}
      satActive={sunActive}
      satPostponed={sunPostponed}
      satUnresolved={props.sunUnresolved}
      refWarnings={sunRefWarnings}
      satHasRun={props.sunHasRun}
    />
  );
}
