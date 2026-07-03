import { describe, expect, test } from "vitest";

import { buildClientEvent, redactSensitiveText } from "../../src/lib/monitoring/clientTelemetry.js";


describe("client telemetry privacy", () => {
  test("redacts bearer tokens, JWT-like values and email addresses", () => {
    const value = redactSensitiveText("Bearer abcdefghijklmnop and person@example.com and eyJabcdefghijk.abcdefghijklmnop.abcdefghijklmnop");
    expect(value).not.toContain("person@example.com");
    expect(value).not.toContain("abcdefghijklmnop");
    expect(value).toContain("[redacted-email]");
    expect(value).toContain("[redacted-token]");
  });

  test("drops context keys that could contain club or credential data", () => {
    const event = buildClientEvent({
      level: "unexpected",
      category: "unknown",
      message: "Failure for owner@example.com",
      context: {
        token: "secret",
        fixture: "private fixture",
        routeState: "safe",
        count: 3,
      },
    });

    expect(event.level).toBe("error");
    expect(event.category).toBe("manual_report");
    expect(event.message).toContain("[redacted-email]");
    expect(event.context).toEqual({ routeState: "safe", count: "3" });
  });
});
