// scheduler.js
// Pure scheduling logic - no React, no DOM, no network.

import {
  PITCHES,
  INDEPENDENT_PITCHES,
  MINI_FORMATS,
  MINI_KW,
} from "./constants.js";
import { isPitchSuitableForFixture } from "./intelligence/pitch/pitchService.js";
import { createPitchRegistry, normalisePitchRegistry } from "./registry/pitchRegistry.js";
import {getFixtureFlowIdentity} from "./domain/fixtureVenueFlow.js";
import {isFixtureSchedulingDemand} from "./domain/fixtureLifecycle.js";
import {classifyFixtureTeam,getFixtureOccupancyMinutes} from "./scheduling/fixtureTiming.js";
import {getScheduleResourceFailure} from "./scheduling/scheduleConstraints.js";
import {validatePitchSchedulingConfig,getPitchFootprint} from "./scheduling/pitchResourceModel.js";
import {withScheduleReservations} from "./scheduling/scheduleResourceContext.js";

export const t2s = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(
    2,
    "0"
  )}`;

export const cleanName = (n, clubName = "HSM") => {
  const escaped = clubName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return (n || "")
    .replace(new RegExp(escaped + "\\s*", "i"), "")
    .replace(/horwich st\.? ?marys?'?s?\s*/i, "")
    .trim();
};

export const isMini = (n) =>
  MINI_KW.some((k) => (n || "").toLowerCase().includes(k));

export const isAdult = (n) =>
  ["hsm 1st team", "hsm reserves", "hsm sunday 1sts", "sunday 1sts"].some(
    (a) => (n || "").toLowerCase().includes(a)
  );

const normaliseTeamIdentity = (value) => String(value || "")
  .toLowerCase()
  .replace(/\\+['’]?/g, "")
  .replace(/[.'’]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const configuredTeamNames = (team = {}) => {
  const externalAliases = Array.isArray(team.externalAliases)
    ? team.externalAliases
    : String(team.externalAliases || "").split(",");
  const implicitNames = normaliseTeamIdentity(team.name) === "hsm 1st team"
    ? ["Horwich"]
    : [];
  return [team.name, ...externalAliases, ...implicitNames]
    .map(normaliseTeamIdentity)
    .filter(Boolean);
};

export function findCfg(name, cfgList) {
  const fixtureName = normaliseTeamIdentity(name);
  if (!fixtureName) return undefined;

  const matches = (Array.isArray(cfgList) ? cfgList : []).flatMap((team, teamIndex) =>
    configuredTeamNames(team).map((candidate) => {
      const exact = fixtureName === candidate;
      const suffix = fixtureName.endsWith(` ${candidate}`);
      return {
        team,
        teamIndex,
        score: exact ? 10_000 + candidate.length : suffix ? 1_000 + candidate.length : 0,
      };
    }),
  ).filter((match) => match.score > 0);

  matches.sort((left, right) => right.score - left.score || left.teamIndex - right.teamIndex);
  return matches[0]?.team;
}

export function resolveFixtureTeam(fixture = {}, cfgList = []) {
  const identities = [fixture.homeTeamId, fixture.homeTeamKey, fixture.teamId, fixture.teamKey]
    .map(normaliseTeamIdentity)
    .filter(Boolean);
  const teams = Array.isArray(cfgList) ? cfgList : [];

  for (const identity of identities) {
    const identityMatch = teams.find((team) => [
      team.id,
      team.teamId,
      team.homeTeamId,
      team.key,
      team.teamKey,
      team.homeTeamKey,
      team.name,
    ].map(normaliseTeamIdentity).filter(Boolean).includes(identity));
    if (identityMatch) return identityMatch;
  }

  return findCfg(fixture.homeTeam, cfgList);
}

function getPitch(pitchCfg, pitchId) {
  return pitchCfg.find((pitch) => pitch.id === pitchId);
}

function getPitchSurface(pitch) {
  return pitch?.surface || "grass";
}

function isArtificialPitch(pitchCfg, pitchId) {
  const pitch = getPitch(pitchCfg, pitchId);
  const surface = getPitchSurface(pitch);

  return ["astro", "3g", "4g", "artificial"].includes(surface);
}

function isIndependentPitch(pitchCfg, pitchId) {
  const pitch = getPitch(pitchCfg, pitchId);
  return Boolean(pitch?.independent || INDEPENDENT_PITCHES.includes(pitchId));
}

function resolveTeamConfig(fixture, cfgList) {
  const cfg = resolveFixtureTeam(fixture, cfgList);
  if (cfg) return cfg;

  if (fixture.manualFormat) {
    return {
      name: fixture.homeTeam,
      format: fixture.manualFormat,
      defaultPitch: fixture.manualPitch,
      altPitch: null,
      ageOrder: 50,
      gameMins: fixture.manualMins || 60,
    };
  }

  return null;
}

function isAdultTeamConfig(cfg, fixture = {}) {
  const teamName = String(cfg?.name || fixture.homeTeam || "").toLowerCase();
  if (/\bu\s?\d{1,2}\b/.test(teamName)) return false;
  const type = String(cfg?.teamType || "").toLowerCase();
  if (["adult", "veterans", "women"].includes(type)) return true;
  return isAdult(cfg?.name || fixture.homeTeam);
}

function formatCanUsePitch(teamFormat, pitch, fixture = {}) {
  if (!pitch) return false;

  return isPitchSuitableForFixture(pitch, {
    ...fixture,
    cfg: {
      ...(fixture.cfg || {}),
      format: teamFormat,
    },
    manualFormat: fixture.manualFormat || teamFormat,
    format: fixture.format || teamFormat,
  });
}


function pitchAvailableBySurface(pitchCfg, pitchId, useAstro) {
  const artificial = isArtificialPitch(pitchCfg, pitchId);

  if (artificial && !useAstro) return false;

  return true;
}

function getLinkedPitchIds(pitchCfg, pitchId) {
  return createPitchRegistry(pitchCfg).getLinkedPitchIds(pitchId);
}

function buildClosedPitchSet(pitchCfg, closedPitches = []) {
  const closed = new Set();

  const explicitClosures = Array.isArray(closedPitches)
    ? closedPitches
    : Object.entries(closedPitches || {})
        .filter(([, isClosed]) => Boolean(isClosed))
        .map(([pitchId]) => pitchId);

  explicitClosures
    .map((pitchId) => String(pitchId || "").trim())
    .filter(Boolean)
    .forEach((pitchId) => {
      getLinkedPitchIds(pitchCfg, pitchId).forEach((linkedId) => closed.add(linkedId));
    });

  return closed;
}

function scheduleFixtureDayCore(
  fixtures, useAstro, closedPitches, cfgList, bufMap, startMins, endMins,
  pitchCfgArg = PITCHES, maxConcurrent = 3, options = {}
) {
  const pitchCfg = normalisePitchRegistry(pitchCfgArg?.length ? pitchCfgArg : PITCHES);
  const configCheck = validatePitchSchedulingConfig(pitchCfg);
  if (!configCheck.ok) throw new Error(configCheck.errors.map(error => error.pitchId + ": " + error.reason).join(" "));
  const first = Number.isFinite(startMins) ? startMins : 510;
  const latest = Number.isFinite(endMins) ? endMins : 690;
  const club = {...options.club, useAstro, maxConcurrent,
    startHour:Math.floor(first/60),startMin:first%60,endHour:Math.floor(latest/60),endMin:latest%60,
    bufferYouth:options.bufferYouth??options.club?.bufferYouth,bufferAdult:options.bufferAdult??options.club?.bufferAdult};
  // The supplied day's operational bounds take precedence over cached timing settings.
  club.timingSettings = {...club.timingSettings, earliestKickOff:t2s(first),latestYouthKickOff:t2s(latest)};
  const context = withScheduleReservations(options.resourceContext, pitchCfg);
  const active = fixtures.filter(isFixtureSchedulingDemand).map(fixture => {
    const cfg = resolveTeamConfig(fixture,cfgList) || fixture.cfg;
    return cfg ? {...fixture,cfg,sourceHomeTeam:fixture.sourceHomeTeam||(cfg.name!==fixture.homeTeam?fixture.homeTeam:""),
      homeTeam:cfg.name,homeTeamId:cfg.id||cfg.teamId||fixture.homeTeamId,
      homeTeamKey:normaliseTeamIdentity(cfg.name).replaceAll(" ","-"),teamId:cfg.id||cfg.teamId||cfg.name} : fixture;
  }).sort((a,b)=>(a.cfg?.ageOrder??99)-(b.cfg?.ageOrder??99)||getFixtureFlowIdentity(a).localeCompare(getFixtureFlowIdentity(b)));
  const scheduled=[], unresolved=[];
  const fixedAdult = Object.prototype.hasOwnProperty.call(options,"fixedAdultKickOffMins")?options.fixedAdultKickOffMins:840;
  const importedTime=fixture=>{
    const raw=String(fixture.koTime||fixture.kickOff||"");
    return /^\d{1,2}:\d{2}$/.test(raw)?Number(raw.split(":")[0])*60+Number(raw.split(":")[1]):null;
  };
  const requested=fixture=>fixture.manualOverrideApplied && Boolean(fixture.pitchId) && Number.isFinite(importedTime(fixture));
  const fixed=fixture=>classifyFixtureTeam(fixture)==="adult" && Number.isFinite(importedTime(fixture)??fixedAdult);
  const failuresFor = (fixture,pitchId,time) => {
    const duration=getFixtureOccupancyMinutes(fixture,{club,bufferMap:bufMap,preserveExisting:false});
    const next={...fixture,pitchId,pitchLabel:pitchCfg.find(p=>p.id===pitchId)?.label||pitchId,koMins:time,koTime:t2s(time),endMins:time+duration,endTime:t2s(time+duration)};
    const failure=getScheduleResourceFailure({fixtures:scheduled,fixtureIdentity:getFixtureFlowIdentity(fixture),next,pitchCfg,closedPitches,club,matchDate:options.matchDate,resourceContext:context});
    return {next,failure};
  };
  const place = fixture => {
    if (!fixture.cfg) { unresolved.push({...fixture,reason:"Team not in config"});return; }
    const manual=requested(fixture), adult=fixed(fixture);
    const preferred=[fixture.cfg.defaultPitch,fixture.cfg.altPitch,...(fixture.cfg.altPitches||[])].filter(Boolean);
    const suitable=pitchCfg.filter(pitch=>isPitchSuitableForFixture(pitch,fixture));
    const candidates=suitable.sort((a,b)=>{
      const pref=id=>preferred.includes(id)?preferred.indexOf(id):-1;
      const rank=id=>pref(id)<0?999:pref(id);
      return rank(a.id)-rank(b.id) || (getPitchFootprint(a.id,pitchCfg).length-getPitchFootprint(b.id,pitchCfg).length) || a.id.localeCompare(b.id);
    });
    const pitchIds=manual?[fixture.pitchId]:candidates.map(p=>p.id);
    const times = manual?[importedTime(fixture)]:adult?[importedTime(fixture)??fixedAdult]:[];
    if(!manual&&!adult) for(let time=first;time<=latest;time+=15) times.push(time);
    const failures=new Map();
    for(const time of times) for(const pitchId of pitchIds) {
      const {next,failure}=failuresFor(fixture,pitchId,time);
      if(failure) {failures.set(failure.type,failure.reason);continue;}
      scheduled.push({...next,fixedKO:adult,manualAllocationApplied:Boolean(manual),
        usingAlt:preferred.includes(pitchId)&&pitchId!==fixture.cfg.defaultPitch,
        usingAstro:isArtificialPitch(pitchCfg,pitchId),usingFallback:!preferred.includes(pitchId)});
      return;
    }
    unresolved.push({...fixture,reason:failures.size?[...failures.values()].join(" "):"No compatible pitch is configured for "+fixture.cfg.format+". Add a suitable pitch in Settings.",
      constraintTypes:[...failures.keys()],manualAllocationApplied:false});
  };
  // Reserve immovable/manual intent first; every path uses the same interval validator.
  active.filter(f=>requested(f)||fixed(f)).forEach(place);
  active.filter(f=>!requested(f)&&!fixed(f)).forEach(place);
  return {scheduled:scheduled.sort((a,b)=>a.koMins-b.koMins||getFixtureFlowIdentity(a).localeCompare(getFixtureFlowIdentity(b))),unresolved};
}


export function scheduleFixtureDay({
  fixtureDay = {},
  dayKey = fixtureDay.key || "saturday",
  fixtures = [],
  useAstro = false,
  closedPitches = [],
  teamConfig = [],
  cfgList = teamConfig,
  bufferMap = {},
  bufMap = bufferMap,
  operatingWindow = fixtureDay.operatingWindow || {},
  startMins = operatingWindow.startMins,
  endMins = operatingWindow.endMins,
  pitchCfg = PITCHES,
  maxConcurrent = 3,
  rules = fixtureDay.rules || {},
  club = {},
  matchDate = "",
  resourceContext = null,
  bufferYouth,
  bufferAdult,
} = {}) {
  const result = scheduleFixtureDayCore(
    fixtures,
    useAstro,
    closedPitches,
    cfgList,
    bufMap,
    startMins,
    endMins,
    pitchCfg,
    maxConcurrent,
    { ...rules, club, matchDate, resourceContext, bufferYouth, bufferAdult }
  );

  const normalisedDayKey = String(dayKey || fixtureDay.key || "saturday").toLowerCase();
  const decorate = (fixture) => ({
    ...fixture,
    fixtureDayKey: fixture.fixtureDayKey || normalisedDayKey,
    __day: fixture.__day || normalisedDayKey,
  });

  return {
    scheduled: result.scheduled.map(decorate),
    unresolved: result.unresolved.map(decorate),
    metadata: {
      dayKey: normalisedDayKey,
      operatingWindow: { startMins, endMins },
      rules: { ...rules },
    },
  };
}

// Compatibility positional API retained while callers migrate to scheduleFixtureDay.
export function scheduleSat(
  fixtures,
  useAstro,
  closedPitches,
  cfgList,
  bufMap,
  startMins,
  endMins,
  pitchCfgArg = PITCHES,
  maxConcurrent = 3,
  options = {}
) {
  return scheduleFixtureDay({
    dayKey: "saturday",
    fixtures,
    useAstro,
    closedPitches,
    cfgList,
    bufMap,
    startMins,
    endMins,
    pitchCfg: pitchCfgArg,
    maxConcurrent,
    rules: { fixedAdultKickOffMins: 14 * 60, ...options },
    ...options,
  });
}

export function scheduleSun(
  fixtures,
  useAstro,
  closedPitches,
  cfgList,
  bufMap,
  startMins,
  endMins,
  pitchCfgArg = PITCHES,
  maxConcurrent = 3,
  options = {}
) {
  return scheduleFixtureDay({
    dayKey: "sunday",
    fixtures,
    useAstro,
    closedPitches,
    cfgList,
    bufMap,
    startMins,
    endMins,
    pitchCfg: pitchCfgArg,
    maxConcurrent,
    rules: { fixedAdultKickOffMins: 14 * 60, ...options },
    ...options,
  });
}
