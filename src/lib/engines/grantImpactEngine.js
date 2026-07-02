import { getParkingSummary } from "./parkingEngine.js";
import { calculateOfficialsReadiness } from "./officialsEngine.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(number(value, 0))));
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPostponed(fixture = {}) {
  return normalise(fixture.status) === "postponed";
}

function fixtureName(fixture = {}) {
  return [
    fixture.homeTeam,
    fixture.teamName,
    fixture.team,
    fixture.home,
    fixture.fixture,
    fixture.title,
  ]
    .filter(Boolean)
    .join(" ");
}

function isYouthFixture(fixture = {}) {
  return /\bu(?:[5-9]|1[0-8])\b/i.test(fixtureName(fixture));
}

function isFemaleFixture(fixture = {}) {
  return /\b(girl|girls|lioness|lionesses|ladies|women|female)\b/i.test(fixtureName(fixture));
}

function getPitchId(fixture = {}) {
  return String(fixture.pitchId || fixture.pitch || fixture.pitchName || fixture.pitchLabel || "").trim();
}

function getDurationMinutes(fixture = {}) {
  const start = number(fixture.koMins ?? fixture.kickOffMins ?? fixture.startMins, NaN);
  const end = number(fixture.endMins ?? fixture.finishMins, NaN);

  if (Number.isFinite(start) && Number.isFinite(end) && end > start) return end - start;

  const configured = number(fixture.cfg?.gameMins ?? fixture.gameMins ?? fixture.durationMins, 0);
  return configured > 0 ? configured : 60;
}

function isConfirmedOfficial(fixture = {}) {
  const status = normalise(fixture.refStatus || fixture.officialStatus || fixture.refereeStatus);
  return status === "confirmed" || status === "accepted";
}

function withDay(fixtures = [], day) {
  return asArray(fixtures).map((fixture) => ({ ...fixture, __day: day }));
}

function getWeekData(entry = {}) {
  const saturdayActive = asArray(entry.scheduled).filter((fixture) => !isPostponed(fixture));
  const sundayActive = asArray(entry.sunScheduled).filter((fixture) => !isPostponed(fixture));
  const saturdayPostponed = asArray(entry.postponedGames);
  const sundayPostponed = asArray(entry.sunPostponed);

  return {
    label: entry.dateLabel || "Saved matchday",
    active: [...withDay(saturdayActive, "saturday"), ...withDay(sundayActive, "sunday")],
    postponed: [
      ...withDay(saturdayPostponed, "saturday"),
      ...withDay(sundayPostponed, "sunday"),
    ],
  };
}

function getTone(score) {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

function evidenceLabel(score) {
  if (score >= 85) return "Grant-ready";
  if (score >= 75) return "Strong evidence";
  if (score >= 45) return "Developing evidence";
  return "Evidence needed";
}

function rateLabel(rate) {
  if (rate <= 5) return "Excellent";
  if (rate <= 12) return "Stable";
  if (rate <= 20) return "Under pressure";
  return "Priority risk";
}

function calculateEvidenceReadiness({
  recordedWeeks,
  activeFixtures,
  club,
  pitchCfg,
  teamCfg,
  configuredRefs,
  dataSignals,
}) {
  const historyDepth = Math.min(35, recordedWeeks * 6);
  const clubIdentity = club?.name && (club?.venue || club?.postcode) ? 10 : club?.name ? 5 : 0;
  const facilities = asArray(pitchCfg).length > 0 ? 10 : 0;
  const teams = asArray(teamCfg).length > 0 ? 10 : 0;
  const operations = activeFixtures.length > 0 ? 15 : 0;
  const officials = configuredRefs.length > 0 || dataSignals.hasOfficialData ? 10 : 0;
  const outcomes = dataSignals.hasPostponementData ? 5 : 0;
  const parking = number(club?.carParkSpaces, 0) > 0 ? 5 : 0;

  return clamp(historyDepth + clubIdentity + facilities + teams + operations + officials + outcomes + parking);
}

function buildPriority({ id, title, detail, evidence, severity = "medium", grantAngle }) {
  return { id, title, detail, evidence, severity, grantAngle };
}

export function buildGrantImpactModel({
  club = {},
  history = [],
  pitchCfg = [],
  teamCfg = [],
  refs = [],
  closedPitches = [],
  satFinal = [],
  sunFinal = [],
  satHasRun = false,
  sunHasRun = false,
  refWarnings = null,
} = {}) {
  const savedWeeks = asArray(history).map(getWeekData);
  const historicalActive = savedWeeks.flatMap((week) => week.active);
  const historicalPostponed = savedWeeks.flatMap((week) => week.postponed);
  const recordedWeeks = savedWeeks.length;

  const currentSaturday = satHasRun
    ? withDay(asArray(satFinal).filter((fixture) => !isPostponed(fixture)), "saturday")
    : [];
  const currentSunday = sunHasRun
    ? withDay(asArray(sunFinal).filter((fixture) => !isPostponed(fixture)), "sunday")
    : [];
  const currentActive = [...currentSaturday, ...currentSunday];
  const currentPostponed = [
    ...(satHasRun ? withDay(asArray(satFinal).filter(isPostponed), "saturday") : []),
    ...(sunHasRun ? withDay(asArray(sunFinal).filter(isPostponed), "sunday") : []),
  ];

  // Saved history remains the formal evidence base. The live weekend is used only
  // when no saved evidence exists, preventing the same matchday being double-counted.
  const evidenceActive = recordedWeeks > 0 ? historicalActive : currentActive;
  const evidencePostponed = recordedWeeks > 0 ? historicalPostponed : currentPostponed;
  const evidenceWeekCount = recordedWeeks > 0 ? recordedWeeks : currentActive.length || currentPostponed.length ? 1 : 0;
  const allEvidenceFixtures = [...evidenceActive, ...evidencePostponed];

  const deliveredFixtures = evidenceActive.length;
  const postponedFixtures = evidencePostponed.length;
  const totalRecordedFixtures = deliveredFixtures + postponedFixtures;
  const postponementRate = totalRecordedFixtures
    ? Math.round((postponedFixtures / totalRecordedFixtures) * 100)
    : 0;
  const deliveryRate = totalRecordedFixtures ? 100 - postponementRate : 0;

  const youthFixtures = evidenceActive.filter(isYouthFixture).length;
  const femaleFixtures = evidenceActive.filter(isFemaleFixture).length;
  const teamOpportunitySlots = deliveredFixtures * 2;
  const facilityHours = Math.round(
    evidenceActive.reduce((total, fixture) => total + getDurationMinutes(fixture), 0) / 60
  );

  const pitchCounts = evidenceActive.reduce((counts, fixture) => {
    const pitchId = getPitchId(fixture);
    if (pitchId) counts[pitchId] = (counts[pitchId] || 0) + 1;
    return counts;
  }, {});
  const pitchEntries = Object.entries(pitchCounts).sort((a, b) => b[1] - a[1]);
  const pitchesUsed = pitchEntries.length;
  const busiestPitch = pitchEntries[0] || null;
  const busiestPitchShare = deliveredFixtures && busiestPitch
    ? Math.round((busiestPitch[1] / deliveredFixtures) * 100)
    : 0;

  const confirmedOfficials = evidenceActive.filter(isConfirmedOfficial).length;
  const officialCoverage = deliveredFixtures
    ? Math.round((confirmedOfficials / deliveredFixtures) * 100)
    : 0;

  const weeklyParking = savedWeeks.map((week) => {
    try {
      return getParkingSummary({
        fixtures: week.active,
        club,
        pitchCfg,
        scope: "weekend",
      });
    } catch (_error) {
      return null;
    }
  }).filter(Boolean);
  const parkingPressureWeeks = weeklyParking.filter((week) => week.utilisation >= 85).length;
  const parkingOverCapacityWeeks = weeklyParking.filter((week) => week.isOverCapacity).length;
  const seasonParkingPeak = weeklyParking.reduce(
    (peak, week) => (number(week.utilisation, 0) > number(peak?.utilisation, 0) ? week : peak),
    null
  );

  let currentParking = null;
  try {
    currentParking = getParkingSummary({
      fixtures: currentActive,
      club,
      pitchCfg,
      scope: "weekend",
    });
  } catch (_error) {
    currentParking = null;
  }

  const officials = calculateOfficialsReadiness({
    fixtures: currentActive,
    active: currentActive,
    refs,
    refWarnings,
  });

  const dataSignals = {
    hasOfficialData: allEvidenceFixtures.some(
      (fixture) => fixture.referee || fixture.refStatus || fixture.official
    ),
    hasPostponementData: recordedWeeks > 0 || currentPostponed.length > 0,
  };

  const evidenceReadiness = calculateEvidenceReadiness({
    recordedWeeks: evidenceWeekCount,
    activeFixtures: evidenceActive,
    club,
    pitchCfg,
    teamCfg,
    configuredRefs: refs,
    dataSignals,
  });

  const facilitiesScore = clamp(
    100
      - parkingOverCapacityWeeks * 12
      - parkingPressureWeeks * 4
      - Math.max(0, busiestPitchShare - 35)
      - asArray(closedPitches).length * 8
  );
  const workforceScore = currentActive.length ? clamp(officials.score) : clamp(officialCoverage || 70);
  const deliveryScore = totalRecordedFixtures ? clamp(deliveryRate) : 50;
  const participationScore = clamp(
    Math.min(100, deliveredFixtures * 2 + Math.min(30, asArray(teamCfg).length * 2))
  );
  const overallHealth = clamp(
    evidenceReadiness * 0.3 +
      deliveryScore * 0.25 +
      facilitiesScore * 0.25 +
      workforceScore * 0.2
  );

  const priorities = [];

  if (parkingOverCapacityWeeks > 0 || currentParking?.isOverCapacity) {
    priorities.push(
      buildPriority({
        id: "parking-capacity",
        title: "Matchday access and parking capacity",
        detail: "Demand is exceeding the safe operating capacity of the current site.",
        evidence: `${parkingOverCapacityWeeks || 1} recorded matchday${parkingOverCapacityWeeks === 1 ? "" : "s"} over capacity${seasonParkingPeak ? `; peak use ${seasonParkingPeak.utilisation}%` : ""}.`,
        severity: "high",
        grantAngle: "Site access, overflow parking, traffic management and safer arrival infrastructure.",
      })
    );
  } else if (parkingPressureWeeks > 0 || currentParking?.utilisation >= 85) {
    priorities.push(
      buildPriority({
        id: "parking-pressure",
        title: "Protect matchday access capacity",
        detail: "The site is operating close to its configured parking limit.",
        evidence: `${parkingPressureWeeks || 1} recorded matchday${parkingPressureWeeks === 1 ? "" : "s"} at 85% capacity or above.`,
        severity: "medium",
        grantAngle: "Arrival management, signage, stewarding equipment and sustainable travel support.",
      })
    );
  }

  if (postponementRate >= 10) {
    priorities.push(
      buildPriority({
        id: "surface-resilience",
        title: "Playing-surface resilience",
        detail: "Postponements are reducing reliable access to football activity.",
        evidence: `${postponedFixtures} of ${totalRecordedFixtures} recorded fixtures postponed (${postponementRate}%).`,
        severity: postponementRate >= 20 ? "high" : "medium",
        grantAngle: "Drainage, maintenance equipment, surface improvement and all-weather provision.",
      })
    );
  }

  if (busiestPitchShare >= 40 && deliveredFixtures >= 5) {
    priorities.push(
      buildPriority({
        id: "pitch-concentration",
        title: "Reduce pressure on the busiest pitch",
        detail: "A large share of activity is concentrated on one playing area.",
        evidence: `${busiestPitch?.[0] || "The busiest pitch"} hosted ${busiestPitch?.[1] || 0} fixtures (${busiestPitchShare}% of delivered activity).`,
        severity: "medium",
        grantAngle: "Additional playable space, pitch renovation, lighting or surface conversion.",
      })
    );
  }

  if (currentActive.length > 0 && (officials.metrics?.confirmed || 0) < currentActive.length) {
    priorities.push(
      buildPriority({
        id: "officials-workforce",
        title: "Officials and volunteer workforce",
        detail: "Current delivery depends on closing gaps in matchday staffing.",
        evidence: `${officials.metrics?.confirmed || 0} of ${currentActive.length} current fixtures have confirmed officials.`,
        severity: (officials.metrics?.confirmed || 0) / Math.max(1, currentActive.length) < 0.65 ? "high" : "medium",
        grantAngle: "Recruitment, training, accreditation, equipment and volunteer retention.",
      })
    );
  }

  if (evidenceWeekCount < 4) {
    priorities.push(
      buildPriority({
        id: "evidence-depth",
        title: "Build the evidence baseline",
        detail: "More saved matchdays will make future applications materially stronger.",
        evidence: `${evidenceWeekCount} matchday${evidenceWeekCount === 1 ? "" : "s"} currently available as evidence.`,
        severity: "development",
        grantAngle: "Demonstrate sustained demand, facility pressure and measurable community reach.",
      })
    );
  }

  if (!priorities.length) {
    priorities.push(
      buildPriority({
        id: "capacity-protection",
        title: "Protect growing delivery capacity",
        detail: "Operations are stable; the next case is maintaining quality as participation grows.",
        evidence: `${deliveryRate}% fixture delivery across ${evidenceWeekCount} recorded matchday${evidenceWeekCount === 1 ? "" : "s"}.`,
        severity: "positive",
        grantAngle: "Preventative maintenance, equipment renewal and capacity-building investment.",
      })
    );
  }

  const narrativeParts = [];
  if (deliveredFixtures > 0) {
    narrativeParts.push(
      `${club?.name || "The club"} delivered ${deliveredFixtures} fixtures across ${evidenceWeekCount} recorded matchday${evidenceWeekCount === 1 ? "" : "s"}, creating ${teamOpportunitySlots} team participation opportunities and approximately ${facilityHours} hours of organised activity.`
    );
  } else {
    narrativeParts.push(
      `${club?.name || "The club"} is establishing its Ground Control evidence baseline. Saving completed matchdays will create a measurable record of activity, demand and operational pressure.`
    );
  }
  if (youthFixtures > 0 || femaleFixtures > 0) {
    narrativeParts.push(
      `${youthFixtures} delivered fixture${youthFixtures === 1 ? "" : "s"} supported youth football${femaleFixtures > 0 ? `, including ${femaleFixtures} girls' or women's fixture${femaleFixtures === 1 ? "" : "s"}` : ""}.`
    );
  }
  if (postponedFixtures > 0) {
    narrativeParts.push(
      `${postponedFixtures} postponement${postponedFixtures === 1 ? " was" : "s were"} recorded, providing evidence of the need to improve reliability and facility resilience.`
    );
  }
  if (parkingPressureWeeks > 0) {
    narrativeParts.push(
      `Parking reached at least 85% of capacity on ${parkingPressureWeeks} recorded matchday${parkingPressureWeeks === 1 ? "" : "s"}, demonstrating pressure on safe site access.`
    );
  }

  const themes = [
    {
      id: "participation",
      label: "Participation",
      score: participationScore,
      tone: getTone(participationScore),
      headline: `${deliveredFixtures} fixtures delivered`,
      detail: `${teamOpportunitySlots} team opportunities across the evidence period.`,
    },
    {
      id: "facilities",
      label: "Facilities",
      score: facilitiesScore,
      tone: getTone(facilitiesScore),
      headline: `${facilityHours} activity hours`,
      detail: `${pitchesUsed}/${asArray(pitchCfg).length || pitchesUsed || 0} configured pitches evidenced in use.`,
    },
    {
      id: "resilience",
      label: "Resilience",
      score: deliveryScore,
      tone: getTone(deliveryScore),
      headline: `${deliveryRate}% delivery rate`,
      detail: `${postponedFixtures} postponement${postponedFixtures === 1 ? "" : "s"} recorded.`,
    },
    {
      id: "workforce",
      label: "Workforce",
      score: workforceScore,
      tone: getTone(workforceScore),
      headline: currentActive.length
        ? `${officials.metrics?.confirmed || 0}/${currentActive.length} officials confirmed`
        : `${officialCoverage}% historic confirmation`,
      detail: currentActive.length
        ? "Live weekend officials position."
        : "Based on recorded fixture status data.",
    },
  ];

  return {
    health: {
      score: overallHealth,
      tone: getTone(overallHealth),
      label: overallHealth >= 80 ? "Healthy platform" : overallHealth >= 60 ? "Developing well" : "Needs evidence",
    },
    evidence: {
      score: evidenceReadiness,
      tone: getTone(evidenceReadiness),
      label: evidenceLabel(evidenceReadiness),
      recordedWeeks: evidenceWeekCount,
      isUsingCurrentWeekend: recordedWeeks === 0 && evidenceWeekCount > 0,
    },
    current: {
      fixtures: currentActive.length,
      postponed: currentPostponed.length,
      officialsConfirmed: officials.metrics?.confirmed || 0,
      officialCoverage: currentActive.length
        ? Math.round(((officials.metrics?.confirmed || 0) / currentActive.length) * 100)
        : 0,
      parkingUtilisation: currentParking?.utilisation || 0,
      parkingPeak: currentParking?.peakTime || "Pending",
    },
    metrics: {
      deliveredFixtures,
      postponedFixtures,
      postponementRate,
      postponementLabel: rateLabel(postponementRate),
      youthFixtures,
      femaleFixtures,
      teamOpportunitySlots,
      facilityHours,
      pitchesUsed,
      pitchesConfigured: asArray(pitchCfg).length,
      teamsConfigured: asArray(teamCfg).length,
      busiestPitch: busiestPitch?.[0] || "No pitch data",
      busiestPitchFixtures: busiestPitch?.[1] || 0,
      busiestPitchShare,
      officialCoverage,
      confirmedOfficials,
      parkingPressureWeeks,
      parkingOverCapacityWeeks,
      seasonParkingPeak: seasonParkingPeak?.utilisation || 0,
    },
    themes,
    priorities: priorities.slice(0, 4),
    narrative: narrativeParts.join(" "),
  };
}

export default buildGrantImpactModel;
