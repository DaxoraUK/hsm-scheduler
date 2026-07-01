import SaturdayCoachMessagesCard from "./SaturdayCoachMessagesCard.jsx";

export default function SundayCoachMessagesCard(props) {
  return (
    <SaturdayCoachMessagesCard
      {...props}
      day="Sunday"
      satHasRun={props.sunHasRun}
      satFinal={props.sunFinal}
      satDateLabel={props.sunDateLabel}
    />
  );
}