import SaturdaySummaryBar from "./SaturdaySummaryBar.jsx";

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
      String(fixture.refStatus || "").toLowerCase() !== "confirmed"
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