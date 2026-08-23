import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const router = readFileSync("api/[...path].js", "utf8");
const vercel = readFileSync("vercel.json", "utf8");

describe("explicit Vercel email routes", () => {
  test("exposes Coach Hub invitation delivery without relying on a catch-all route", () => {
    expect(router).toContain('["/api/coach-invite", coachInvite]');
    expect(vercel).toContain('"source": "/api/coach/invite"');
    expect(vercel).toContain('"destination": "/api/coach-invite"');
  });

  test("exposes communications and Resend webhook endpoints at their public paths", () => {
    expect(router).toContain('["/api/communications-capabilities", communicationsCapabilities]');
    expect(router).toContain('["/api/communications-dispatch", communicationsDispatch]');
    expect(router).toContain('["/api/communications-webhooks-resend", resendWebhook]');
    expect(vercel).toContain('"source": "/api/communications/webhooks/resend"');
    expect(vercel).toContain('"destination": "/api/communications-webhooks-resend"');
  });
});
