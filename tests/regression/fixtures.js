import { DEFAULT_CLUB, PITCHES } from "../../src/lib/constants.js";

export function makeClub({
  capacity = 57,
  maxConcurrent = 3,
  parkingEnabled = true,
  overrides = {},
} = {}) {
  const primarySite = {
    ...DEFAULT_CLUB.sites[0],
    carParkSpaces: capacity,
  };

  return {
    ...DEFAULT_CLUB,
    ...overrides,
    carParkSpaces: capacity,
    maxConcurrent,
    primarySiteId: primarySite.id,
    sites: [primarySite],
    features: {
      ...DEFAULT_CLUB.features,
      ...(overrides.features || {}),
      parkingEnabled,
    },
    avgCars: {
      ...DEFAULT_CLUB.avgCars,
      ...(overrides.avgCars || {}),
    },
  };
}

export function makeFixture({
  id = "fixture-1",
  homeTeam = "HSM 1st Team",
  awayTeam = "Visitors",
  format = "11v11",
  pitchId = "P1",
  koTime = "09:00",
  koMins = 9 * 60,
  gameMins = 90,
  bufferMins = 30,
  status = "active",
  day = "saturday",
  carEstimate,
  referee = "",
  refStatus = "TBC",
  extra = {},
} = {}) {
  const fixture = {
    id,
    homeTeam,
    awayTeam,
    pitchId,
    koTime,
    koMins,
    endMins: koMins + gameMins + bufferMins,
    status,
    __day: day,
    fixtureDayKey: day,
    referee,
    refStatus,
    cfg: {
      name: homeTeam,
      teamType: format === "11v11" ? "adult" : "youth",
      format,
      gameMins,
      ageOrder: format === "11v11" ? 11 : 8,
      defaultPitch: pitchId,
      altPitch: null,
    },
    ...extra,
  };

  if (carEstimate !== undefined) fixture.carEstimate = carEstimate;
  return fixture;
}

export function clonePitches() {
  return PITCHES.map((pitch) => ({ ...pitch }));
}
