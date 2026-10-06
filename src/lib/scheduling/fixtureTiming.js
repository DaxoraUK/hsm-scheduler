// Classification never depends on match format or preferred pitch.
export function classifyFixtureTeam(fixture={}) {
  const cfg=fixture.cfg??fixture;
  const name=String(cfg.name||fixture.teamName||fixture.homeTeam||'').toLowerCase();
  if(/\bu\s?\d{1,2}\b|\bunder[ -]?\d{1,2}\b/.test(name)) return 'youth';
  const type=String(cfg.teamType||fixture.teamType||'').toLowerCase();
  if(['youth','junior','mini'].includes(type)) return 'youth';
  if(['adult','open-age','open_age','senior','women','veterans'].includes(type)) return 'adult';
  if(/\b(?:hsm|horwich.*mary).*(?:1st|first|reserves|seniors|veterans|women)\b/.test(name)) return 'adult';
  const age=Number(cfg.ageOrder??fixture.ageOrder);
  if(Number.isFinite(age)&&age>0&&age<11) return 'youth';
  return 'unknown';
}
export function getFixtureOccupancyMinutes(fixture={}, {club={},bufferMap={},preserveExisting=true}={}) {
  if(preserveExisting&&Number.isFinite(fixture.endMins)&&Number.isFinite(fixture.koMins)&&fixture.endMins>fixture.koMins) return fixture.endMins-fixture.koMins;
  const type=classifyFixtureTeam(fixture);
  const timing=club.timingSettings??club.timing??{};
  const ageBuffer=type==='adult'?(club.bufferAdult??timing.adultBuffer??club.adultBuffer):type==='youth'?(club.bufferYouth??timing.youthBuffer??club.youthBuffer):null;
  const format=fixture.cfg?.format||fixture.format||'';
  const buffer=ageBuffer??fixture.bufferMins??bufferMap[format]??(type==='adult'?30:15);
  return Number(fixture.cfg?.gameMins??fixture.gameMins??70)+Math.max(0,Number(buffer));
}
