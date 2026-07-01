import React from "react";
import CarparkChart from "../CarparkChart.jsx";
import Card from "../ui/Card.jsx";
import StatusChip from "../ui/StatusChip.jsx";

export default function SaturdayCarParkCard({
  club,
  satHasRun,
  satFinal,
  startHour,
  startMin,
  pitchCfg = [],
  closedPitches = [],
  onOverride,
  day = "Matchday",
}) {
  if (!satHasRun) return null;

  const capacity = club.carParkSpaces || 57;

  const applyParkingRecommendation = (fixtureIndex, patch = {}) => {
    if (typeof onOverride !== "function") return;

    Object.entries(patch).forEach(([field, value]) => {
      onOverride(fixtureIndex, field, value);
    });
  };

  return (
    <Card
      eyebrow="Parking"
      title={`${day} Car Park Pressure`}
      subtitle="Projected car park demand across the matchday window. Recommendations are fully validated before they can be applied."
      action={<StatusChip variant="neutral">{capacity} spaces</StatusChip>}
    >
      <CarparkChart
        games={satFinal}
        startMins={startHour * 60 + startMin}
        capacity={capacity}
        primary={club.primary}
        avgCars={club.avgCars}
        club={club}
        pitchCfg={pitchCfg}
        closedPitches={closedPitches}
        onApplyRecommendation={applyParkingRecommendation}
      />
    </Card>
  );
}
