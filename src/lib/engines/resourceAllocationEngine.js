import { buildClubConfiguration, getAvgCarsForFixture, getPitchForFixture, getSiteForFixture, getTeamForFixture } from "./configurationEngine.js";
import { isFixtureOfficialConfirmed } from "./officialsEngine.js";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isActive(fixture = {}) {
  return String(fixture.status || "").toLowerCase() !== "postponed";
}

function isConfirmedRef(fixture = {}) {
  return String(fixture.refStatus || "").toLowerCase() === "confirmed";
}

function timeLabel(mins) {
  if (!Number.isFinite(Number(mins))) return "Unscheduled";
  const total = Number(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fixtureKey(fixture = {}, index = 0) {
  return fixture.id || `${fixture.homeTeam || fixture.team || "fixture"}-${fixture.awayTeam || "opponent"}-${fixture.ko || fixture.koMins || index}`;
}

function getSlotRange(fixture = {}) {
  const start = toNumber(fixture.koMins, NaN);
  const end = toNumber(fixture.endMins, NaN);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  const slots = [];
  const slotStart = Math.floor(start / 15) * 15;
  const slotEnd = Math.ceil(end / 15) * 15;
  for (let mins = slotStart; mins < slotEnd; mins += 15) slots.push(mins);
  return slots;
}

function statusFromIssues(issues = []) {
  if (issues.some((issue) => issue.severity === "danger")) return "danger";
  if (issues.some((issue) => issue.severity === "warning")) return "warning";
  return "success";
}

function labelFromStatus(status) {
  if (status === "danger") return "Needs action";
  if (status === "warning") return "Review";
  return "Allocated";
}

export function calculateResourceAllocation({ fixtures = [], club = {}, teamCfg = [], pitchCfg = [], closedPitches = [], refs = [] } = {}) {
  const config = buildClubConfiguration({ club, teamCfg, pitchCfg });
  const closedPitchSet = new Set((closedPitches || []).map((pitch) => String(pitch)));
  const activeFixtures = fixtures.filter(isActive);

  const allocations = activeFixtures.map((fixture, index) => {
    const team = getTeamForFixture(fixture, config.teams);
    const pitch = getPitchForFixture(fixture, config.pitches);
    const site = getSiteForFixture(fixture, config);
    const cars = getAvgCarsForFixture(fixture, config);
    const issues = [];

    if (!team) {
      issues.push({ severity: "warning", domain: "Team", message: "Team settings not matched." });
    }

    if (!pitch) {
      issues.push({ severity: "danger", domain: "Pitch", message: "No pitch allocated." });
    } else if (pitch.closed || closedPitchSet.has(pitch.id)) {
      issues.push({ severity: "danger", domain: "Pitch", message: `${pitch.label || pitch.id} is closed.` });
    }

    if (!site) {
      issues.push({ severity: "warning", domain: "Site", message: "No site matched." });
    } else if (!toNumber(site.carParkSpaces, 0)) {
      issues.push({ severity: "warning", domain: "Parking", message: `${site.name} has no parking capacity set.` });
    }

    if (!isFixtureOfficialConfirmed(fixture)) {
      issues.push({ severity: "warning", domain: "Officials", message: "Referee not confirmed." });
    }

    const status = statusFromIssues(issues);

    return {
      id: fixtureKey(fixture, index),
      fixture,
      team,
      pitch,
      site,
      estimatedCars: cars,
      slots: getSlotRange(fixture),
      status,
      label: labelFromStatus(status),
      issues,
      resources: {
        pitch: pitch ? { status: pitch.closed || closedPitchSet.has(pitch.id) ? "danger" : "success", label: pitch.label || pitch.id } : { status: "danger", label: "Missing" },
        site: site ? { status: "success", label: site.name } : { status: "warning", label: "Missing" },
        parking: site ? { status: toNumber(site.carParkSpaces, 0) ? "success" : "warning", label: `${cars} cars` } : { status: "warning", label: "Unknown" },
        officials: { status: isFixtureOfficialConfirmed(fixture) ? "success" : "warning", label: fixture.referee || fixture.official || "TBC" },
      },
    };
  });

  const siteParking = config.sites.map((site) => {
    const slotLoads = new Map();
    allocations
      .filter((allocation) => allocation.site?.id === site.id)
      .forEach((allocation) => {
        allocation.slots.forEach((slot) => {
          slotLoads.set(slot, toNumber(slotLoads.get(slot), 0) + allocation.estimatedCars);
        });
      });

    const peak = [...slotLoads.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
    const capacity = toNumber(site.carParkSpaces, 0);
    const utilisation = capacity ? Math.round((peak[1] / capacity) * 100) : 0;

    return {
      site,
      capacity,
      peakCars: peak[1],
      peakSlot: peak[0],
      peakLabel: timeLabel(peak[0]),
      utilisation,
      status: !capacity ? "warning" : utilisation >= 100 ? "danger" : utilisation >= 85 ? "warning" : "success",
    };
  });

  const missingPitch = allocations.filter((allocation) => !allocation.pitch).length;
  const closedPitch = allocations.filter((allocation) => allocation.pitch && (allocation.pitch.closed || closedPitchSet.has(allocation.pitch.id))).length;
  const missingSite = allocations.filter((allocation) => !allocation.site).length;
  const missingOfficials = allocations.filter((allocation) => allocation.resources.officials.status !== "success").length;
  const parkingWarnings = siteParking.filter((site) => site.status !== "success").length;

  const issues = allocations.flatMap((allocation) =>
    allocation.issues.map((issue) => ({
      fixture: allocation.fixture.homeTeam && allocation.fixture.awayTeam ? `${allocation.fixture.homeTeam} vs ${allocation.fixture.awayTeam}` : allocation.fixture.homeTeam || allocation.fixture.team || "Fixture",
      ...issue,
    }))
  );

  siteParking.forEach((site) => {
    if (site.status !== "success") {
      issues.push({
        severity: site.status,
        domain: "Parking",
        fixture: site.site.name,
        message: site.capacity ? `Peak parking is ${site.utilisation}% at ${site.peakLabel}.` : "Parking capacity is missing.",
      });
    }
  });

  const status = statusFromIssues(issues);
  const score = Math.max(
    0,
    100 - missingPitch * 18 - closedPitch * 22 - missingSite * 10 - missingOfficials * 7 - parkingWarnings * 12
  );

  return {
    status,
    label: status === "success" ? "Resources allocated" : status === "warning" ? "Resource review" : "Resource action needed",
    score,
    summary: status === "success" ? "Core matchday resources are allocated." : `${issues.length} resource issue${issues.length === 1 ? "" : "s"} found.`,
    allocations,
    siteParking,
    issues,
    metrics: {
      fixtures: activeFixtures.length,
      allocatedPitches: allocations.filter((allocation) => allocation.pitch).length,
      missingPitch,
      closedPitch,
      missingSite,
      missingOfficials,
      parkingWarnings,
      sites: config.sites.length,
      pitches: config.pitches.length,
      referees: refs.length,
    },
  };
}

export default calculateResourceAllocation;
