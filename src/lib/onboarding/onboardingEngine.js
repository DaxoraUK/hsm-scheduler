const clean = (value) => String(value ?? "").trim();
const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const ONBOARDING_STEPS = Object.freeze([
  { id: "welcome", label: "Welcome", title: "Set up Ground Control" },
  { id: "club", label: "Club", title: "Club profile" },
  { id: "workspace", label: "Modules", title: "Choose your workspace" },
  { id: "venue", label: "Venue", title: "Primary venue" },
  { id: "schedule", label: "Rules", title: "Scheduling rules" },
  { id: "resources", label: "Resources", title: "Teams and pitches" },
  { id: "fixtures", label: "Fixtures", title: "Fixture source" },
  { id: "review", label: "Review", title: "Review and finish" },
]);

export const ONBOARDING_STATUS = Object.freeze({
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETE: "complete",
});

const FORMAT_DEFAULTS = Object.freeze({
  "3v3": { teamType: "youth", gameMins: 40 },
  "5v5": { teamType: "youth", gameMins: 40 },
  "7v7": { teamType: "youth", gameMins: 50 },
  "9v9": { teamType: "youth", gameMins: 60 },
  "11v11-youth": { teamType: "youth", gameMins: 70 },
  "11v11-small": { teamType: "youth", gameMins: 80 },
  "11v11": { teamType: "adult", gameMins: 90 },
});

function slugify(value, fallback = "main-ground") {
  const slug = clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function getPrimarySite(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites : [];
  return sites.find((site) => site?.isPrimary || site?.id === club.primarySiteId)
    || sites[0]
    || {
      id: club.primarySiteId || "main-ground",
      name: club.venue || "Main Ground",
      venue: club.venue || "",
      postcode: club.postcode || club.weatherPostcode || "",
      carParkSpaces: club.carParkSpaces ?? 0,
      weatherEnabled: true,
      isPrimary: true,
    };
}

function createResourceRows(rows, type, primarySiteId) {
  const source = Array.isArray(rows) ? rows : [];
  if (type === "teams") {
    return source.map((team, index) => ({
      ...team,
      name: clean(team?.name),
      teamType: clean(team?.teamType) || FORMAT_DEFAULTS[team?.format]?.teamType || "youth",
      format: clean(team?.format) || "11v11-youth",
      day: clean(team?.day) || "Saturday",
      gameMins: number(team?.gameMins, FORMAT_DEFAULTS[team?.format]?.gameMins || 70),
      siteId: clean(team?.siteId) || primarySiteId,
      defaultPitch: clean(team?.defaultPitch) || null,
      altPitch: clean(team?.altPitch) || null,
      ageOrder: number(team?.ageOrder, index + 1),
    }));
  }

  return source.map((pitch, index) => ({
    ...pitch,
    id: clean(pitch?.id) || `P${index + 1}`,
    label: clean(pitch?.label || pitch?.name) || `Pitch ${index + 1}`,
    format: clean(pitch?.format) || "11v11",
    surface: clean(pitch?.surface) || "grass",
    siteId: clean(pitch?.siteId) || primarySiteId,
    innerOf: clean(pitch?.innerOf) || null,
    independent: Boolean(pitch?.independent),
    affectsParking: pitch?.affectsParking !== false,
    desc: clean(pitch?.desc || pitch?.description),
  }));
}

export function createOnboardingDraft({
  club = {},
  teamCfg = [],
  pitchCfg = [],
  scheduling = {},
} = {}) {
  const primarySite = getPrimarySite(club);
  const siteId = clean(primarySite.id) || slugify(primarySite.name || primarySite.venue);
  const fullTime = club.integrations?.fullTimeFa || {};
  const timing = club.timingSettings || club.timing || {};

  return {
    club: {
      name: clean(club.name),
      sport: clean(club.sport) || "Football",
      region: clean(club.region || club.county),
      governingBody: clean(club.governingBody),
      contactName: clean(club.contactName),
      contactRole: clean(club.contactRole),
      contactEmail: clean(club.contactEmail),
      contactPhone: clean(club.contactPhone),
    },
    features: {
      midweekEnabled: club.features?.midweekEnabled !== false,
      parkingEnabled: club.features?.parkingEnabled !== false,
    },
    venue: {
      id: siteId,
      name: clean(primarySite.name) || "Main Ground",
      venue: clean(primarySite.venue || primarySite.name),
      postcode: clean(primarySite.postcode || club.postcode || club.weatherPostcode).toUpperCase(),
      carParkSpaces: Math.max(0, number(primarySite.carParkSpaces ?? club.carParkSpaces, 0)),
      weatherEnabled: primarySite.weatherEnabled !== false,
    },
    scheduling: {
      startHour: number(scheduling.startHour ?? timing.startHour ?? club.startHour, 8),
      startMin: number(scheduling.startMin ?? timing.startMin ?? club.startMin, 30),
      endHour: number(scheduling.endHour ?? timing.endHour, 11),
      endMin: number(scheduling.endMin ?? timing.endMin, 30),
      bufferYouth: number(scheduling.bufferYouth ?? timing.youthBuffer ?? club.bufferYouth, 15),
      bufferAdult: number(scheduling.bufferAdult ?? timing.adultBuffer ?? club.bufferAdult, 30),
      maxConcurrent: Math.max(1, number(club.maxConcurrent, 3)),
    },
    teams: createResourceRows(teamCfg, "teams", siteId),
    pitches: createResourceRows(pitchCfg, "pitches", siteId),
    fixtures: {
      enabled: Boolean(fullTime.enabled),
      sourceUrl: clean(fullTime.sourceUrl),
      clubId: clean(fullTime.clubId),
      mode: clean(fullTime.mode) || "import",
    },
  };
}

export function normaliseOnboardingState(value = {}) {
  const status = Object.values(ONBOARDING_STATUS).includes(value?.status)
    ? value.status
    : ONBOARDING_STATUS.PENDING;
  const currentStep = Math.max(0, Math.min(number(value?.currentStep ?? value?.current_step, 0), ONBOARDING_STEPS.length - 1));
  return {
    status,
    currentStep,
    completedSteps: Array.isArray(value?.completedSteps ?? value?.completed_steps)
      ? [...new Set(value.completedSteps ?? value.completed_steps)].filter(Boolean)
      : [],
    draft: value?.draft && typeof value.draft === "object" ? value.draft : {},
    required: Boolean(value?.required ?? value?.is_required),
    startedAt: value?.startedAt ?? value?.started_at ?? null,
    completedAt: value?.completedAt ?? value?.completed_at ?? null,
    updatedAt: value?.updatedAt ?? value?.updated_at ?? null,
  };
}

function validPostcode(value) {
  const postcode = clean(value).toUpperCase().replace(/\s+/g, " ");
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(postcode);
}

function validEmail(value) {
  const email = clean(value);
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateClub(draft) {
  const errors = [];
  if (clean(draft?.club?.name).length < 2) errors.push("Enter the club name.");
  if (!clean(draft?.club?.sport)) errors.push("Choose the primary sport.");
  if (!validEmail(draft?.club?.contactEmail)) errors.push("Enter a valid contact email address.");
  return errors;
}

function validateVenue(draft) {
  const errors = [];
  if (clean(draft?.venue?.name).length < 2) errors.push("Enter the site name.");
  if (clean(draft?.venue?.venue).length < 2) errors.push("Enter the venue or ground name.");
  if (!validPostcode(draft?.venue?.postcode)) errors.push("Enter a valid UK postcode.");
  if (draft?.features?.parkingEnabled && number(draft?.venue?.carParkSpaces, -1) < 0) {
    errors.push("Parking capacity cannot be negative.");
  }
  return errors;
}

function validateSchedule(draft) {
  const errors = [];
  const scheduling = draft?.scheduling || {};
  const start = number(scheduling.startHour, 8) * 60 + number(scheduling.startMin, 30);
  const end = number(scheduling.endHour, 11) * 60 + number(scheduling.endMin, 30);
  if (start >= end) errors.push("The youth scheduling window must end after it starts.");
  if (number(scheduling.bufferYouth, -1) < 0) errors.push("Youth turnaround cannot be negative.");
  if (number(scheduling.bufferAdult, -1) < 0) errors.push("Adult turnaround cannot be negative.");
  if (number(scheduling.maxConcurrent, 0) < 1) errors.push("Maximum concurrent games must be at least one.");
  return errors;
}

function validateResources(draft) {
  const errors = [];
  const teams = (Array.isArray(draft?.teams) ? draft.teams : []).filter((team) => clean(team?.name));
  const pitches = (Array.isArray(draft?.pitches) ? draft.pitches : []).filter((pitch) => clean(pitch?.id) && clean(pitch?.label));
  if (!teams.length) errors.push("Add at least one team.");
  if (!pitches.length) errors.push("Add at least one pitch or playing area.");
  const ids = pitches.map((pitch) => clean(pitch.id).toLowerCase());
  if (new Set(ids).size !== ids.length) errors.push("Every pitch ID must be unique.");
  return errors;
}

function validateFixtures(draft) {
  if (!draft?.fixtures?.enabled) return [];
  const url = clean(draft?.fixtures?.sourceUrl);
  if (!/^https:\/\//i.test(url)) return ["Enter the secure Full-Time FA fixture URL, or disable the connection for now."];
  return [];
}

export function validateOnboardingStep(stepId, draft = {}) {
  let errors = [];
  if (stepId === "club") errors = validateClub(draft);
  if (stepId === "venue") errors = validateVenue(draft);
  if (stepId === "schedule") errors = validateSchedule(draft);
  if (stepId === "resources") errors = validateResources(draft);
  if (stepId === "fixtures") errors = validateFixtures(draft);
  if (stepId === "review") {
    errors = [
      ...validateClub(draft),
      ...validateVenue(draft),
      ...validateSchedule(draft),
      ...validateResources(draft),
      ...validateFixtures(draft),
    ];
  }
  return { ok: errors.length === 0, errors };
}

export function getOnboardingReadiness(draft = {}) {
  const requiredSteps = ["club", "venue", "schedule", "resources", "fixtures"];
  const results = requiredSteps.map((id) => ({ id, ...validateOnboardingStep(id, draft) }));
  const completed = results.filter((result) => result.ok).length;
  return {
    completed,
    total: results.length,
    percentage: Math.round((completed / results.length) * 100),
    ready: completed === results.length,
    results,
  };
}

export function buildOnboardingConfiguration(draft = {}, currentClub = {}) {
  const venue = draft.venue || {};
  const siteId = clean(venue.id) || slugify(venue.name || venue.venue);
  const existingSites = Array.isArray(currentClub.sites) ? currentClub.sites : [];
  const otherSites = existingSites.filter((site) => site?.id !== currentClub.primarySiteId && !site?.isPrimary);
  const primarySite = {
    id: siteId,
    name: clean(venue.name) || "Main Ground",
    venue: clean(venue.venue || venue.name),
    postcode: clean(venue.postcode).toUpperCase(),
    isPrimary: true,
    carParkSpaces: Math.max(0, number(venue.carParkSpaces, 0)),
    weatherEnabled: venue.weatherEnabled !== false,
    notes: "Primary matchday site",
  };
  const scheduling = draft.scheduling || {};
  const fixtures = draft.fixtures || {};
  const existingIntegrations = currentClub.integrations || {};

  const club = {
    ...currentClub,
    ...(draft.club || {}),
    primarySiteId: siteId,
    sites: [primarySite, ...otherSites],
    venue: primarySite.venue,
    postcode: primarySite.postcode,
    weatherPostcode: primarySite.weatherEnabled ? primarySite.postcode : clean(currentClub.weatherPostcode),
    carParkSpaces: primarySite.carParkSpaces,
    maxConcurrent: Math.max(1, number(scheduling.maxConcurrent, 3)),
    features: {
      ...(currentClub.features || {}),
      midweekEnabled: draft.features?.midweekEnabled !== false,
      parkingEnabled: draft.features?.parkingEnabled !== false,
    },
    timingSettings: {
      ...(currentClub.timingSettings || {}),
      startHour: number(scheduling.startHour, 8),
      startMin: number(scheduling.startMin, 30),
      endHour: number(scheduling.endHour, 11),
      endMin: number(scheduling.endMin, 30),
      earliestKickOff: `${String(number(scheduling.startHour, 8)).padStart(2, "0")}:${String(number(scheduling.startMin, 30)).padStart(2, "0")}`,
      latestYouthKickOff: `${String(number(scheduling.endHour, 11)).padStart(2, "0")}:${String(number(scheduling.endMin, 30)).padStart(2, "0")}`,
      youthBuffer: Math.max(0, number(scheduling.bufferYouth, 15)),
      adultBuffer: Math.max(0, number(scheduling.bufferAdult, 30)),
    },
    integrations: {
      ...existingIntegrations,
      fullTimeFa: {
        ...(existingIntegrations.fullTimeFa || {}),
        enabled: Boolean(fixtures.enabled),
        sourceUrl: clean(fixtures.sourceUrl),
        clubId: clean(fixtures.clubId),
        mode: clean(fixtures.mode) || "import",
      },
    },
  };

  const previousPrimarySiteId = clean(currentClub.primarySiteId);
  const pitches = createResourceRows(draft.pitches, "pitches", siteId).map((pitch, index) => ({
    ...pitch,
    id: clean(pitch.id) || `P${index + 1}`,
    siteId: !clean(pitch.siteId) || clean(pitch.siteId) === previousPrimarySiteId
      ? siteId
      : clean(pitch.siteId),
  }));
  const teams = createResourceRows(draft.teams, "teams", siteId).map((team, index) => {
    const resourceSiteId = !clean(team.siteId) || clean(team.siteId) === previousPrimarySiteId
      ? siteId
      : clean(team.siteId);
    const compatiblePitch = pitches.find((pitch) =>
      pitch.siteId === resourceSiteId && pitch.format === team.format
    ) || pitches.find((pitch) => pitch.siteId === resourceSiteId) || pitches[0];
    return {
      ...team,
      siteId: resourceSiteId,
      defaultPitch: clean(team.defaultPitch) || compatiblePitch?.id || null,
      ageOrder: number(team.ageOrder, index + 1),
    };
  });

  return {
    club,
    teams,
    pitches,
    scheduling: {
      startHour: club.timingSettings.startHour,
      startMin: club.timingSettings.startMin,
      endHour: club.timingSettings.endHour,
      endMin: club.timingSettings.endMin,
      bufferYouth: club.timingSettings.youthBuffer,
      bufferAdult: club.timingSettings.adultBuffer,
    },
  };
}
