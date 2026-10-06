export function getPlannerPointerTime({clientX,rowLeft,rowWidth,displayStart,displayEnd,grabOffsetMins=0}) {
  if(![clientX,rowLeft,rowWidth,displayStart,displayEnd,grabOffsetMins].every(Number.isFinite)||rowWidth<=0) return null;
  return displayStart+(clientX-rowLeft)/rowWidth*(displayEnd-displayStart)-grabOffsetMins;
}
export function getPlannerGrabOffset({fixtureKoMins,...geometry}) {
  const time=getPlannerPointerTime(geometry);
  return time===null?0:time-fixtureKoMins;
}
export function snapPlannerTime(value,{anchorMins=0,interval=15}={}) {
  return anchorMins+Math.round((value-anchorMins)/Math.max(1,interval))*Math.max(1,interval);
}
