import React from "react";
import Card from "../ui/Card.jsx";
import CoachMessages from "../CoachMessages.jsx";

export default function SaturdayCoachMessagesCard({
  club,
  satHasRun,
  satFinal,
  satDateLabel,
  day = "Matchday",
}) {
  if (!satHasRun) return null;

  return (
    <Card
      eyebrow="Communications"
      title={`${day} Coach Messages`}
      subtitle="Copy and send fixture information directly to team managers."
    >
      <CoachMessages
        games={satFinal}
        dateLabel={satDateLabel}
        club={club}
      />
    </Card>
  );
}