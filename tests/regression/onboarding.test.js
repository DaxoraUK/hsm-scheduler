import { describe, expect, test } from "vitest";
import {
  buildOnboardingConfiguration,
  createOnboardingDraft,
  getOnboardingReadiness,
  normaliseOnboardingState,
  validateOnboardingStep,
} from "../../src/lib/onboarding/onboardingEngine.js";
import { makeClub } from "./fixtures.js";

const teams = [{
  name: "U14 Spartans",
  teamType: "youth",
  format: "11v11-youth",
  day: "Saturday",
  gameMins: 70,
}];

const pitches = [{
  id: "P1",
  label: "Main Pitch",
  format: "11v11-youth",
  surface: "grass",
}];

describe("customer onboarding engine", () => {
  test("creates a resumable draft from the live club configuration", () => {
    const club = makeClub({ capacity: 0, parkingEnabled: true });
    const draft = createOnboardingDraft({
      club,
      teamCfg: teams,
      pitchCfg: pitches,
      scheduling: {
        startHour: 9,
        startMin: 0,
        endHour: 12,
        endMin: 0,
        bufferYouth: 20,
        bufferAdult: 35,
      },
    });

    expect(draft.club.name).toBe(club.name);
    expect(draft.venue.carParkSpaces).toBe(0);
    expect(draft.scheduling).toMatchObject({ startHour: 9, endHour: 12, bufferYouth: 20 });
    expect(draft.teams).toHaveLength(1);
    expect(draft.pitches).toHaveLength(1);
  });

  test("blocks completion when launch-critical setup is incomplete", () => {
    const readiness = getOnboardingReadiness({
      club: { name: "", sport: "Football" },
      venue: { name: "", venue: "", postcode: "" },
      scheduling: { startHour: 11, startMin: 30, endHour: 9, endMin: 0, maxConcurrent: 0 },
      teams: [],
      pitches: [],
      fixtures: { enabled: false },
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.percentage).toBeLessThan(100);
    expect(validateOnboardingStep("review", {}).ok).toBe(false);
  });

  test("requires a secure Full-Time URL only when the integration is enabled", () => {
    expect(validateOnboardingStep("fixtures", { fixtures: { enabled: false } }).ok).toBe(true);
    expect(validateOnboardingStep("fixtures", {
      fixtures: { enabled: true, sourceUrl: "http://fulltime.example.test" },
    }).errors[0]).toContain("secure Full-Time FA");
  });

  test("rejects duplicate pitch IDs", () => {
    const result = validateOnboardingStep("resources", {
      teams,
      pitches: [pitches[0], { ...pitches[0], label: "Second Pitch" }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Every pitch ID must be unique.");
  });

  test("builds the final club, timing, team and pitch payload without restoring zero parking", () => {
    const currentClub = makeClub({ capacity: 70 });
    const draft = createOnboardingDraft({
      club: currentClub,
      teamCfg: teams,
      pitchCfg: pitches,
    });
    draft.club.name = "Launch Test FC";
    draft.features.parkingEnabled = true;
    draft.venue = {
      ...draft.venue,
      id: "launch-ground",
      name: "Launch Ground",
      venue: "Launch Ground, Bolton",
      postcode: "BL1 1AA",
      carParkSpaces: 0,
    };
    draft.scheduling = {
      startHour: 8,
      startMin: 45,
      endHour: 11,
      endMin: 45,
      bufferYouth: 20,
      bufferAdult: 40,
      maxConcurrent: 2,
    };

    const result = buildOnboardingConfiguration(draft, currentClub);

    expect(result.club.name).toBe("Launch Test FC");
    expect(result.club.carParkSpaces).toBe(0);
    expect(result.club.sites[0]).toMatchObject({ id: "launch-ground", carParkSpaces: 0, isPrimary: true });
    expect(result.club.timingSettings).toMatchObject({
      earliestKickOff: "08:45",
      latestYouthKickOff: "11:45",
      youthBuffer: 20,
      adultBuffer: 40,
    });
    expect(result.scheduling.bufferAdult).toBe(40);
    expect(result.teams[0].siteId).toBe("launch-ground");
    expect(result.pitches[0].siteId).toBe("launch-ground");
  });

  test("normalises database snake_case state safely", () => {
    expect(normaliseOnboardingState({
      status: "in_progress",
      current_step: 3,
      completed_steps: ["welcome", "club"],
      is_required: true,
    })).toMatchObject({
      status: "in_progress",
      currentStep: 3,
      completedSteps: ["welcome", "club"],
      required: true,
    });
  });
});
