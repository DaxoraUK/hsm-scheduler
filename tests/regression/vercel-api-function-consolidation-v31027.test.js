import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const apiRoot = join(root, "api");
const serverApiRoot = join(root, "server-api");
const gateway = readFileSync(join(apiRoot, "[...path].js"), "utf8");
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));

function allFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    return entry.isDirectory() ? allFiles(full) : [full];
  });
}

describe("Vercel API function consolidation v3.10.29", () => {
  it("keeps exactly one deployable JavaScript function entry under api", () => {
    const files = allFiles(apiRoot).filter((file) => file.endsWith(".js"));
    expect(files).toEqual([join(apiRoot, "[...path].js")]);
    expect(files.length).toBe(1);
  });

  it("keeps all existing public API paths in the gateway", () => {
    const expected = [
      "/api/automation/daily",
      "/api/coach/calendar",
      "/api/coach/invite",
      "/api/communications/capabilities",
      "/api/communications/dispatch",
      "/api/communications/webhooks/resend",
      "/api/communications/webhooks/twilio",
      "/api/full-time",
      "/api/health",
      "/api/league/calendar",
      "/api/league/finance-delivery",
      "/api/league/geocode-venues",
      "/api/league/official-response",
      "/api/league/report-delivery",
      "/api/notifications/push-test",
      "/api/planner/calendar",
      "/api/weather",
    ];
    for (const path of expected) expect(gateway).toContain(`["${path}",`);
  });

  it("retains the daily automation cron on its public path", () => {
    expect(vercel.crons).toEqual([
      { path: "/api/automation/daily", schedule: "15 7 * * *" },
    ]);
  });

  it("moves handler source out of the Vercel function discovery directory", () => {
    const sourceFiles = allFiles(serverApiRoot).filter((file) => file.endsWith(".js"));
    const normalizedSourceFiles = sourceFiles.map((file) => file.replaceAll("\\", "/"));
    expect(sourceFiles.length).toBe(17);
    expect(normalizedSourceFiles.some((file) => file.includes("communications/webhooks/resend.js"))).toBe(true);
    expect(normalizedSourceFiles.some((file) => file.includes("communications/webhooks/twilio.js"))).toBe(true);
  });
});
