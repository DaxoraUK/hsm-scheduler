import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  alignTeamContacts,
  extractLegacyTeamContacts,
  stripTeamContactsFromConfig,
} from "../../src/lib/communications/contactModel.js";
import { buildCommunicationsModel } from "../../src/lib/communications/communicationsEngine.js";
import {
  communicationPrivacyGaps,
  normaliseCommunicationPrivacy,
} from "../../src/lib/communications/privacyModel.js";

const migration = readFileSync(
  new URL("../../supabase/migrations/202607110002_communications_privacy_and_audit.sql", import.meta.url),
  "utf8"
);
const communicationsPage = readFileSync(
  new URL("../../src/pages/CommunicationsPage.jsx", import.meta.url),
  "utf8"
);
const teamSettings = readFileSync(
  new URL("../../src/components/Settings/TeamSettingsPanel.jsx", import.meta.url),
  "utf8"
);

function fixture() {
  return {
    id: "fixture-1",
    homeTeam: "HSM U14",
    awayTeam: "Visitors U14",
    koTime: "10:00",
    pitchLabel: "Pitch 1",
    format: "11v11",
    referee: "Official One",
    refStatus: "confirmed",
  };
}

describe("coach contact privacy and communications audit", () => {
  test("removes confidential contact fields from the general team configuration", () => {
    const source = [{
      id: "team-1",
      name: "HSM U14",
      format: "11v11",
      managerName: "Coach One",
      managerPhone: "07123 456789",
      assistantEmail: "assistant@example.org",
    }];
    const contacts = extractLegacyTeamContacts(source);
    const stripped = stripTeamContactsFromConfig(source);

    expect(contacts[0].coachName).toBe("Coach One");
    expect(contacts[0].coachPhone).toBe("07123 456789");
    expect(stripped[0]).toEqual({ id: "team-1", name: "HSM U14", format: "11v11" });
  });

  test("supports a primary coach and optional assistant in the bulk queue", () => {
    const teams = [{ id: "team-1", name: "HSM U14", format: "11v11" }];
    const contacts = alignTeamContacts(teams, [{
      teamKey: "team-1",
      teamName: "HSM U14",
      coachName: "Coach One",
      coachPhone: "07123 456789",
      preferredChannel: "whatsapp",
      assistantName: "Coach Two",
      assistantPhone: "07999 123456",
      assistantEnabled: true,
      receiveMatchdayMessages: true,
    }]);
    const model = buildCommunicationsModel({
      club: { name: "Horwich St Mary's" },
      teamCfg: teams,
      teamContacts: contacts,
      satFinal: [fixture()],
      satHasRun: true,
      midweekEnabled: false,
    });

    expect(model.counts.ready).toBe(1);
    expect(model.counts.recipients).toBe(2);
    expect(model.rows[0].recipients.map((item) => item.name)).toEqual(["Coach One", "Coach Two"]);
  });

  test("requires a documented privacy setup before bulk processing", () => {
    const incomplete = normaliseCommunicationPrivacy({ controllerName: "Horwich St Mary's" });
    expect(incomplete.configured).toBe(false);
    expect(communicationPrivacyGaps(incomplete)).toContain("Lawful basis");
    expect(communicationPrivacyGaps(incomplete)).toContain("DPIA screening");

    const complete = normaliseCommunicationPrivacy({
      controllerName: "Horwich St Mary's",
      privacyContactEmail: "privacy@example.org",
      lawfulBasis: "legitimate_interests",
      purpose: "Operational matchday communication with adult team coaches.",
      privacyNoticeUrl: "https://example.org/privacy",
      retentionDays: 365,
      dpiaStatus: "screened_no_high_risk",
    });
    expect(complete.configured).toBe(true);
    expect(communicationPrivacyGaps(complete)).toEqual([]);
  });

  test("keeps contact tables RPC-only, club-scoped and retention controlled", () => {
    expect(migration).toContain("create table if not exists public.team_contacts");
    expect(migration).toContain("create table if not exists public.communication_events");
    expect(migration).toContain("create trigger team_config_strip_contact_fields");
    expect(migration).toContain("public.can_manage_club(target_club_id)");
    expect(migration).toContain("public.can_operate_club(target_club_id)");
    expect(migration).toContain("purge_expired_communication_events");
    expect(migration).toContain("Provider confirmation is required");
    expect(migration).toMatch(/revoke all on public\.team_contacts from public, anon, authenticated/i);
    expect(migration).toMatch(/revoke all on public\.communication_events from public, anon, authenticated/i);
    expect(migration).not.toMatch(/create policy[\s\S]{0,160}team_contacts/i);
  });

  test("customer UI uses one bulk queue and never claims copy-out is delivery", () => {
    expect(communicationsPage).toContain("Send coach messages");
    expect(communicationsPage).toContain("Copy selected messages");
    expect(communicationsPage).toContain("does not prove the message was sent or delivered");
    expect(communicationsPage).toContain("Shared audit trail");
    expect(teamSettings).toContain("Primary adult contact");
    expect(teamSettings).toContain("Assistant coach");
    expect(teamSettings).toContain("player or child contact information");
  });
});
