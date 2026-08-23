import { describe, expect, test } from "vitest";
import { getOfficialStatus } from "../../src/lib/operationsEngine.js";
import { isFixtureOfficialConfirmed } from "../../src/lib/engines/officialsEngine.js";

describe("league-appointed referee readiness", () => {
  test("treats a named league appointment as operationally confirmed", () => {
    const fixture = { referee: "Ivor Altdorf", refStatus: "Assigned" };
    expect(getOfficialStatus(fixture)).toEqual({
      label: "League appointed",
      variant: "success",
      ok: true,
    });
    expect(isFixtureOfficialConfirmed(fixture)).toBe(true);
  });

  test("keeps missing and awaiting appointments outstanding", () => {
    expect(getOfficialStatus({ referee: "", refStatus: "TBC" }).ok).toBe(false);
    expect(getOfficialStatus({ referee: "Ivor Altdorf", refStatus: "Awaiting" }).ok).toBe(false);
    expect(isFixtureOfficialConfirmed({ referee: "Ivor Altdorf", refStatus: "Awaiting" })).toBe(false);
  });
});
