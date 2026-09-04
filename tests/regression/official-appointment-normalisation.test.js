import { describe, expect, test } from "vitest";
import {
  getOfficialAppointmentSource,
  getOfficialAppointmentStatus,
} from "../../src/lib/engines/officialsEngine.js";

describe("official appointment source and status", () => {
  test("keeps League-appointed as a source and Confirmed as a separate status", () => {
    const fixture = { referee: "League Ref", officialSource: "League-appointed", refStatus: "Confirmed" };
    expect(getOfficialAppointmentSource(fixture)).toBe("league_appointed");
    expect(getOfficialAppointmentStatus(fixture)).toBe("confirmed");
  });

  test("maps legacy Assigned state to pending rather than treating it as an appointment source", () => {
    expect(getOfficialAppointmentStatus({ referee: "Sam Ref", refStatus: "Assigned" })).toBe("pending");
  });
});
