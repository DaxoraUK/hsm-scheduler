import {
  getFixtureDuration,
  getLinkedPitchIds,
  isFixtureActive,
  timeToMinutes,
} from "../../engines/validationEngine.js";
import {
  getPitchSuitabilityReason,
  isPitchSuitableForFixture,
} from "./pitchService.js";

export function pitchClosedRule({
  next = {},
  pitchCfg = [],
  closedPitches = [],
} = {}) {
  if (!isFixtureActive(next)) {
    return null;
  }

  if (!next.pitchId) {
    return null;
  }

  const linkedPitchIds = getLinkedPitchIds(next.pitchId, pitchCfg);
  const closedLinkedPitchId = linkedPitchIds.find((pitchId) =>
    closedPitches.includes(pitchId)
  );

  if (!closedLinkedPitchId) {
    return null;
  }

  const selectedPitch = pitchCfg.find((pitch) => pitch.id === next.pitchId);
  const closedPitch = pitchCfg.find((pitch) => pitch.id === closedLinkedPitchId);
  const isDirectClosure = closedLinkedPitchId === next.pitchId;
  const pitchLabel = selectedPitch?.label || next.pitchLabel || next.pitchId;
  const closedPitchLabel = closedPitch?.label || closedLinkedPitchId;

  return {
    ok: false,
    type: "pitch_closed",
    rule: "pitchClosedRule",
    severity: "blocked",
    reason: isDirectClosure
      ? `${pitchLabel} is currently marked as closed.`
      : `${pitchLabel} cannot be used because linked pitch ${closedPitchLabel} is currently marked as closed.`,
    clash: {
      homeTeam: next.homeTeam,
      awayTeam: next.awayTeam,
      pitchId: next.pitchId,
      pitchLabel,
      linkedClosedPitchId: closedLinkedPitchId,
      linkedClosedPitchLabel: closedPitchLabel,
      koTime: next.koTime,
      status: next.status || "active",
    },
  };
}

export function pitchSuitabilityRule({
  next = {},
  pitchCfg = [],
} = {}) {
  if (!isFixtureActive(next)) {
    return null;
  }

  if (!next.pitchId) {
    return null;
  }

  const selectedPitch = pitchCfg.find((pitch) => pitch.id === next.pitchId);

  if (!selectedPitch) {
    return null;
  }

  if (isPitchSuitableForFixture(selectedPitch, next)) {
    return null;
  }

  return {
    ok: false,
    type: "pitch_unsuitable",
    rule: "pitchSuitabilityRule",
    severity: "blocked",
    reason: getPitchSuitabilityReason(selectedPitch, next),
    clash: {
      homeTeam: next.homeTeam,
      awayTeam: next.awayTeam,
      pitchId: selectedPitch.id,
      pitchLabel: selectedPitch.label,
      koTime: next.koTime,
      status: next.status || "active",
    },
  };
}

export function pitchClashRule({
  fixtures = [],
  fixtureIndex,
  next = {},
  pitchCfg = [],
} = {}) {
  if (!isFixtureActive(next)) {
    return null;
  }

  if (!next.pitchId || !next.koTime) {
    return null;
  }

  const nextKo = timeToMinutes(next.koTime);

  if (nextKo == null) {
    return null;
  }

  const nextDuration = getFixtureDuration(next);
  const nextEnd = nextKo + nextDuration;
  const blockedPitchIds = getLinkedPitchIds(next.pitchId, pitchCfg);

  const clash = fixtures.find((fixture, index) => {
    if (index === fixtureIndex) return false;
    if (!isFixtureActive(fixture)) return false;
    if (!blockedPitchIds.includes(fixture.pitchId)) return false;

    const fixtureKo =
      fixture.koMins != null ? fixture.koMins : timeToMinutes(fixture.koTime);

    const fixtureEnd =
      fixture.endMins != null
        ? fixture.endMins
        : fixtureKo != null
        ? fixtureKo + getFixtureDuration(fixture)
        : null;

    if (fixtureKo == null || fixtureEnd == null) return false;

    return nextKo < fixtureEnd && fixtureKo < nextEnd;
  });

  if (!clash) {
    return null;
  }

  const clashPitch = pitchCfg.find((pitch) => pitch.id === clash.pitchId);

  return {
    ok: false,
    type: "pitch_clash",
    rule: "pitchClashRule",
    severity: "blocked",
    reason: `${clash.homeTeam || "Another fixture"} is already using ${
      clashPitch?.label || clash.pitchLabel || clash.pitchId || "that pitch"
    } at ${clash.koTime || "that time"}.`,
    clash,
  };
}
