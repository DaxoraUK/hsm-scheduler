import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCoachRequestDraft,
  normaliseCoachHubWorkspace,
} from "../../src/lib/coach/coachHubEngine.js";
import { detectAnnualPlannerConflicts } from "../../src/lib/planning/annualPlannerEngine.js";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("supabase/migrations/202607160009_coach_hub_request_live_capacity.sql");
const coachPage = read("src/pages/CoachHubPage.jsx");
const conversation = read("src/components/coach/CoachRequestConversation.jsx");
const pitchSettings = read("src/components/Settings/PitchSettingsPanel.jsx");
const appCore = read("src/AppCore.jsx");

describe("Ground Control v3.10.4 Coach Hub requests and training capacity", () => {
  it("loads selectable pitches and clamps simultaneous training capacity", () => {
    const workspace = normaliseCoachHubWorkspace({
      pitches: [
        { id: "P4", label: "Pitch 4", trainingCapacity: 2 },
        { id: "P5", label: "Pitch 5", training_capacity: 99 },
      ],
    });
    expect(workspace.pitches[0]).toMatchObject({ id: "P4", label: "Pitch 4", trainingCapacity: 2 });
    expect(workspace.pitches[1].trainingCapacity).toBe(20);
  });

  it("reopens editable submitted requests with their existing values", () => {
    const draft = buildCoachRequestDraft({
      id: "request-1",
      assignment_id: "assignment-1",
      status: "submitted",
      request_type: "training",
      title: "U14 Spartans training",
      preferred_pitch_id: "P4",
      preferred_pitch_name: "Pitch 4",
      preferred_start_at: "2026-08-03T18:00:00.000Z",
      preferred_end_at: "2026-08-03T19:30:00.000Z",
    }, [{ id: "assignment-1", teamKey: "u14-spartans" }]);
    expect(draft.requestId).toBe("request-1");
    expect(draft.pitchId).toBe("P4");
    expect(draft.title).toBe("U14 Spartans training");
  });

  it("allows two simultaneous training teams on a pitch configured for two", () => {
    const candidate = {
      id: "candidate",
      title: "Team B training",
      bookingType: "training",
      status: "confirmed",
      teamKey: "team-b",
      pitchId: "P4",
      pitchName: "Pitch 4",
      startAt: "2026-08-03T18:00:00.000Z",
      endAt: "2026-08-03T19:30:00.000Z",
    };
    const conflicts = detectAnnualPlannerConflicts(candidate, {
      bookings: [{ ...candidate, id: "existing", teamKey: "team-a", title: "Team A training" }],
      pitches: [{ id: "P4", trainingCapacity: 2 }],
    });
    expect(conflicts.some((row) => row.type === "pitch_training_capacity")).toBe(false);
  });

  it("blocks a third simultaneous training team when capacity is two", () => {
    const candidate = {
      id: "candidate",
      title: "Team C training",
      bookingType: "training",
      status: "confirmed",
      teamKey: "team-c",
      pitchId: "P4",
      pitchName: "Pitch 4",
      startAt: "2026-08-03T18:00:00.000Z",
      endAt: "2026-08-03T19:30:00.000Z",
    };
    const conflicts = detectAnnualPlannerConflicts(candidate, {
      bookings: [
        { ...candidate, id: "a", teamKey: "team-a" },
        { ...candidate, id: "b", teamKey: "team-b" },
      ],
      pitches: [{ id: "P4", trainingCapacity: 2 }],
    });
    expect(conflicts.some((row) => row.type === "pitch_training_capacity")).toBe(true);
  });

  it("keeps friendlies and matches exclusive even on a shared training pitch", () => {
    const candidate = {
      id: "friendly",
      title: "Friendly",
      bookingType: "friendly",
      status: "confirmed",
      teamKey: "team-b",
      pitchId: "P4",
      startAt: "2026-08-03T18:00:00.000Z",
      endAt: "2026-08-03T19:30:00.000Z",
    };
    const conflicts = detectAnnualPlannerConflicts(candidate, {
      bookings: [{ ...candidate, id: "training", bookingType: "training", teamKey: "team-a" }],
      pitches: [{ id: "P4", trainingCapacity: 2 }],
    });
    expect(conflicts.some((row) => row.type === "pitch_double_booking")).toBe(true);
  });

  it("adds request editing and a pitch selector to Coach Hub", () => {
    expect(coachPage).toContain("Edit request");
    expect(coachPage).toContain("DB.updateMyCoachHubRequest");
    expect(coachPage).toContain('label="Preferred pitch"');
    expect(coachPage).toContain("workspace.pitches");
  });

  it("silently refreshes request messages so the conversation behaves like live chat", () => {
    expect(conversation).toContain("const LIVE_REFRESH_MS = 6000");
    expect(conversation).toContain("load({ quiet: true })");
    expect(conversation).toContain('document.addEventListener("visibilitychange"');
    expect(conversation).toContain('window.addEventListener("focus"');
    expect(conversation).toContain('live ? "Live" : "Reconnecting"');
  });

  it("adds per-pitch training capacity settings", () => {
    expect(pitchSettings).toContain("Simultaneous training teams");
    expect(pitchSettings).toContain("trainingCapacity");
    expect(pitchSettings).toContain("Training slots");
  });

  it("enforces the same capacity rules in Supabase and permits coaches to update their own pending requests", () => {
    expect(migration).toContain("private.pitch_slot_available");
    expect(migration).toContain("private.pitch_training_capacity");
    expect(migration).toContain("create or replace function public.update_my_coach_hub_request");
    expect(migration).toContain("current_request.status not in ('submitted','needs_information')");
    expect(migration).toContain("grant execute on function public.update_my_coach_hub_request");
  });

  it("contains Coach Hub faults inside a route-level recovery boundary", () => {
    expect(appCore).toContain('title="Coach Hub needs a refresh"');
    expect(appCore).toContain("<DaxoraSectionErrorBoundary");
  });
});
