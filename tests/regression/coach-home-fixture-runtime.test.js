/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import CoachHubPage from "../../src/pages/CoachHubPage.jsx";
import { DB } from "../../src/lib/supabase.js";
vi.mock("../../src/lib/supabase.js", () => ({ DB: {
  ensureMyCoachHubRoleAccess: vi.fn(async () => ({})), getCoachHubWorkspace: vi.fn(),
  getMyCoachTrainingPreferences: vi.fn(async () => ({})),
  listMyAnnualPlannerAlternatives: vi.fn(async () => []), listMyAnnualPlannerWaitlistOffers: vi.fn(async () => []),
}, Auth: {} }));
test("Coach Home next-up and coming-up identify Away fixtures with unknown kick-off", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("React", React);
  DB.getCoachHubWorkspace.mockResolvedValue({ person: { display_name: "Coach" }, bookings: [{
    id: "away", title: "Away match", status: "confirmed", booking_type: "match", fixture_venue_role: "away", fixture_time_known: false,
    start_at: "2099-10-10T00:00:00Z", end_at: "2099-10-10T01:00:00Z",
  }] });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(React.createElement(CoachHubPage, { clubId: "test-club" })));
    expect(host.textContent.match(/Away fixture/g)).toHaveLength(2);
    expect(host.textContent.match(/Kick-off TBC/g)).toHaveLength(2);
    expect(host.textContent).not.toContain("00:00");
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
