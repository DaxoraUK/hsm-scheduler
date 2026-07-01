import {
  getFixtureDuration,
  isFixtureActive,
  timeToMinutes,
} from "../../engines/validationEngine.js";

export function normaliseOfficialName(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

export function hasNamedOfficial(fixture = {}) {
  const official = normaliseOfficialName(fixture.referee);

  return Boolean(official) && official !== "parent ref" && official !== "tbc";
}

export function fixturesOverlap(fixtureA = {}, fixtureB = {}) {
  const aKo =
    fixtureA.koMins != null ? fixtureA.koMins : timeToMinutes(fixtureA.koTime);

  const bKo =
    fixtureB.koMins != null ? fixtureB.koMins : timeToMinutes(fixtureB.koTime);

  if (aKo == null || bKo == null) return false;

  const aDuration = getFixtureDuration(fixtureA);
  const bDuration = getFixtureDuration(fixtureB);

  const aEnd = aKo + aDuration;
  const bEnd = bKo + bDuration;

  return aKo < bEnd && bKo < aEnd;
}

export function findOfficialClash({
  fixtures = [],
  fixtureIndex,
  next = {},
} = {}) {
  if (!isFixtureActive(next)) return null;
  if (!hasNamedOfficial(next)) return null;

  const nextOfficial = normaliseOfficialName(next.referee);

  return (
    fixtures.find((fixture, index) => {
      if (index === fixtureIndex) return false;
      if (!isFixtureActive(fixture)) return false;
      if (!hasNamedOfficial(fixture)) return false;

      const fixtureOfficial = normaliseOfficialName(fixture.referee);

      if (fixtureOfficial !== nextOfficial) return false;

      return fixturesOverlap(next, fixture);
    }) || null
  );
}
