import SaturdayUnresolvedCard from "./SaturdayUnresolvedCard.jsx";

export default function SundayUnresolvedCard(props) {
  return (
    <SaturdayUnresolvedCard
      {...props}
      satUnresolved={props.sunUnresolved}
      satOverrides={props.sunOverrides}
      satOv={props.sunOv}
      satScheduled={props.sunScheduled}
      setSatScheduled={props.setSunScheduled}
      setSatUnresolved={props.setSunUnresolved}
    />
  );
}