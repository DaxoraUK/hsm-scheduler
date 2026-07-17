import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => fs.readFileSync(path, "utf8");
const annualPlanner = read("src/pages/AnnualPlannerPage.jsx");
const requestWizard = read("src/components/coach/CoachRequestWizard.jsx");
const migration = read("supabase/migrations/202607170004_request_shadow_refresh_and_multi_submit.sql");

describe("Ground Control v3.10.5.3 request refresh and multi-submit repair", () => {
  it("refreshes only the Coach Hub request queue in the background", () => {
    expect(annualPlanner).toContain("refreshRequestQueueQuietly");
    expect(annualPlanner).toContain("DB.listCoachHubRequestQueue(clubId)");
    expect(annualPlanner).toContain("requestFingerprintRef");
    expect(annualPlanner).toContain("nextFingerprint !== requestFingerprintRef.current");
    expect(annualPlanner).not.toContain('refreshing ? "Refreshing requests quietly…"');
  });

  it("preserves the operator viewport during a shadow refresh", () => {
    expect(annualPlanner).toContain("const preservedScrollY");
    expect(annualPlanner).toContain("window.requestAnimationFrame");
    expect(annualPlanner).toContain('window.scrollTo({ top: preservedScrollY, left: 0, behavior: "auto" })');
  });

  it("keeps the manual full-workspace refresh available", () => {
    expect(annualPlanner).toContain('onClick={() => loadWorkspace({ quiet: true })}');
    expect(annualPlanner).toContain('Refreshing…');
  });

  it("shows request submission errors inside the wizard rather than failing silently", () => {
    expect(requestWizard).toContain("submitError");
    expect(requestWizard).toContain('role="alert"');
    expect(requestWizard).toContain("The request could not be submitted");
  });

  it("uses named pitch-area availability when submitting a second request", () => {
    expect(migration).toContain("private.pitch_area_slot_available");
    expect(migration).toContain("booking.pitch_area_id<>area_value");
    expect(migration).toContain("preferred_pitch_area_id,preferred_pitch_area_name");
    expect(migration).toContain("area-aware request submission");
  });

  it("checks the live availability snapshot before inserting a new request", () => {
    expect(migration).toContain("availability_value:=public.check_coach_hub_request_availability");
    expect(migration).toContain("The requested slot is unavailable");
    expect(migration).toContain("allow_advisory=false");
  });
});
