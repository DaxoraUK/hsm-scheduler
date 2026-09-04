import { describe, expect, test } from "vitest";
import { getOfficialStatus } from "../../src/lib/operationsEngine.js";
import { isFixtureOfficialConfirmed } from "../../src/lib/engines/officialsEngine.js";

describe("league-appointed referee readiness", () => {
  test("keeps league appointment source separate from confirmation status", () => {
    const fixture = {
      referee: "Ivor Altdorf",
      officialSource: "League-appointed",
      refStatus: "Pending",
    };
    expect(getOfficialStatus(fixture)).toEqual({
      label: "Awaiting",
      variant: "warning",
      ok: false,
    });
    expect(isFixtureOfficialConfirmed(fixture)).toBe(false);
  });

  test("keeps missing and awaiting appointments outstanding", () => {
    expect(getOfficialStatus({ referee: "", refStatus: "TBC" }).ok).toBe(false);
    expect(getOfficialStatus({ referee: "Ivor Altdorf", refStatus: "Awaiting" }).ok).toBe(false);
    expect(isFixtureOfficialConfirmed({ referee: "Ivor Altdorf", refStatus: "Awaiting" })).toBe(false);
  });
});
