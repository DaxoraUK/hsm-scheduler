import { expect, test, vi } from "vitest";
import { GET } from "../../server-api/coach/calendar.js";
import { serviceRpc } from "../../server/communications/supabase.js";
vi.mock("../../server/communications/supabase.js", () => ({ serviceRpc: vi.fn() }));

test("subscribed calendars retain stable UIDs and cancel inactive fixtures", async () => {
  serviceRpc.mockResolvedValue({ bookings: [
    { id: "home", title: "Cobras vs Visitors", status: "confirmed", fixture_venue_role: "home", start_at: "2026-10-10T09:00:00Z", end_at: "2026-10-10T10:00:00Z" },
    { id: "postponed", title: "Knights vs Visitors", status: "postponed", fixture_venue_role: "home", start_at: "2026-10-10T09:00:00Z", end_at: "2026-10-10T10:00:00Z" },
    { id: "away", title: "Visitors vs Crusaders", status: "confirmed", fixture_venue_role: "away", fixture_time_known: false, start_at: "2026-10-09T23:00:00Z", end_at: "2026-10-10T01:00:00Z" },
  ] });
  const response = await GET(new Request("https://example.org/calendar?token=test-token"));
  expect(response.status).toBe(200);
  const entries = (await response.text()).split("BEGIN:VEVENT").slice(1);
  expect(entries[0]).toContain("STATUS:CONFIRMED");
  expect(entries[1]).toContain("UID:postponed@daxora.co.uk");
  expect(entries[1]).toContain("STATUS:CANCELLED");
  expect(entries[1]).toContain("SUMMARY:POSTPONED");
  expect(entries[1]).toContain("TRANSP:TRANSPARENT");
  expect(entries[2]).toContain("SUMMARY:AWAY");
  expect(entries[2]).toContain("DTSTART;VALUE=DATE:20261010");
  expect(entries[2]).toContain("Kick-off TBC");
});

test("unknown kick-off occupies one calendar date when UK clocks go back", async () => {
  serviceRpc.mockResolvedValue({ bookings: [{ id: "dst-away", fixture_time_known: false,
    fixture_venue_role: "away", start_at: "2026-10-24T23:00:00Z", end_at: "2026-10-25T01:00:00Z" }] });
  const response = await GET(new Request("https://example.org/calendar?token=test-token"));
  const calendar = await response.text();
  expect(calendar).toContain("DTSTART;VALUE=DATE:20261025");
  expect(calendar).toContain("DTEND;VALUE=DATE:20261026");
});
