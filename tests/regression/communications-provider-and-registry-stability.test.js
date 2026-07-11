import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  normaliseEditableTeamContact,
  normaliseTeamContact,
} from "../../src/lib/communications/contactModel.js";
import { describeCommunicationDispatchFailure } from "../../src/lib/communications/deliveryService.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const dispatch = read("../../api/communications/dispatch.js");
const communications = read("../../src/pages/CommunicationsPage.jsx");
const teams = read("../../src/components/Settings/TeamSettingsPanel.jsx");
const pitches = read("../../src/components/Settings/PitchSettingsPanel.jsx");
const migration = read("../../supabase/migrations/202607110006_harden_communication_delivery_functions.sql");

describe("communications provider and settings registry stability", () => {
  test("preserves the preferred channel returned by Supabase snake_case records", () => {
    expect(normaliseTeamContact({ preferred_channel: "email" }).preferredChannel).toBe("email");
    expect(normaliseEditableTeamContact({ preferred_channel: "email" }).preferredChannel).toBe("email");
    expect(normaliseTeamContact({ preferred_channel: "sms" }).preferredChannel).toBe("sms");
  });

  test("returns provider rejections as completed batch results instead of hiding them behind a generic 502", () => {
    expect(dispatch).toContain('const outcome = failed && accepted ? "partial" : failed ? "failed" : accepted ? "accepted" : reused ? "duplicate" : "processed"');
    expect(dispatch).toContain("providerStatus: Number(error?.status) || null");
    expect(dispatch).toContain("Return the completed batch as JSON");
    expect(dispatch).toContain("}, 200);");
    expect(communications).toContain("describeCommunicationDispatchFailure");
    expect(communications).toContain("setSendFailure(failure)");
    expect(communications).toContain("Reference: {sendFailure.code}");
  });

  test("turns common Resend failures into actionable instructions", () => {
    expect(describeCommunicationDispatchFailure({
      failure: { providerStatus: 401, message: "Unauthorized", code: "validation_error" },
    })).toMatchObject({ title: "Email provider authentication failed" });

    expect(describeCommunicationDispatchFailure({
      failure: { providerStatus: 403, message: "You can only send testing emails to your own email address", code: "validation_error" },
    })).toMatchObject({ title: "Resend blocked the test email" });
  });

  test("uses a wide-screen-only master-detail split and keeps save controls near the top", () => {
    expect(teams).toContain("2xl:grid-cols-[320px_minmax(0,1fr)]");
    expect(teams).toContain("sm:grid-cols-2 lg:grid-cols-3 2xl:block");
    expect(teams.indexOf("<SaveBar")).toBeLessThan(teams.indexOf('label="Teams"'));
    expect(teams).toContain("md:grid-cols-2");
    expect(teams).not.toContain("xl:grid-cols-[300px_minmax(0,1fr)]");

    expect(pitches).toContain("2xl:grid-cols-[320px_minmax(0,1fr)]");
    expect(pitches).toContain("sm:grid-cols-2 lg:grid-cols-3 2xl:block");
    expect(pitches.indexOf("<SaveBar sticky")).toBeLessThan(pitches.indexOf('label="Pitches"'));
    expect(pitches).toContain("md:grid-cols-2");
    expect(pitches).not.toContain("xl:grid-cols-[300px_minmax(0,1fr)]");
  });

  test("hardens all downstream delivery functions against PL/pgSQL identifier ambiguity", () => {
    expect((migration.match(/#variable_conflict error/g) || []).length).toBeGreaterThanOrEqual(6);
    expect(migration).toContain("v_safe_status text");
    expect(migration).toContain("v_batch_id uuid");
    expect(migration).toContain("delivery_row.provider_reference");
    expect(migration).toContain("batch_item_row.delivery_id = v_delivery.id");
  });
});
