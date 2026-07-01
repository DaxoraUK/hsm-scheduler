import SaturdayManualFixtures from "./SaturdayManualFixtures.jsx";

export default function SundayManualFixtures(props) {
  return (
    <SaturdayManualFixtures
      {...props}
      showManual={props.showSunManual}
      setShowManual={props.setShowSunManual}
      satManual={props.sunManual}
      setSatManual={props.setSunManual}
    />
  );
}