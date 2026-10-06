export function modelPitches({parentId='AST',count=3,format='5v5',independent=false,availabilityByDay}={}) {
  const playingAreas=Array.from({length:count},(_,i)=>({id:'area-'+(i+1),label:'Area '+(i+1)}));
  return [{id:parentId,label:parentId,format,surface:'astro',independent,playingAreas,availabilityByDay},
    ...playingAreas.map((area,i)=>({id:parentId+'-'+(i+1),label:area.label,format,surface:'astro',innerOf:parentId,playingAreaIds:[area.id]}))];
}
export function modelTeam(overrides={}) {
  return {id:'team-one',name:'U10 Test',teamType:'youth',format:'5v5',ageOrder:10,gameMins:45,defaultPitch:'AST-1',altPitches:[],...overrides};
}
export function modelFixture(overrides={}) {
  return {id:'source:one',sourceFixtureKey:'source:one',homeTeam:'U10 Test',awayTeam:'Visitors',status:'active',homeAway:'home',date:'2026-10-10',cfg:modelTeam(),pitch:'AST-1',koMins:540,koTime:'09:00',endMins:600,...overrides};
}
