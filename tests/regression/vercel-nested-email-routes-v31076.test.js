import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

describe("explicit Vercel email routes", () => {
  test("exposes Coach Hub invitation delivery without relying on a catch-all route", () => {
    expect(readFileSync("api/coach/invite.js", "utf8")).toContain('server-api/coach/invite.js');
  });

  test("exposes communications and Resend webhook endpoints at their public paths", () => {
    expect(readFileSync("api/communications/capabilities.js", "utf8")).toContain('server-api/communications/capabilities.js');
    expect(readFileSync("api/communications/dispatch.js", "utf8")).toContain('server-api/communications/dispatch.js');
    expect(readFileSync("api/communications/webhooks/resend.js", "utf8")).toContain('server-api/communications/webhooks/resend.js');
  });
});
