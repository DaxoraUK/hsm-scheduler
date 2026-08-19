import { describe, expect, it } from "vitest";
import {
  createPartnerEnvelope,
  mapPartnerClubToDaxora,
  mapPartnerEventToDaxora,
  mapPartnerPersonToDaxora,
  mapPartnerTeamToDaxora,
  MockTeamFeePayAdapter,
  validatePartnerEnvelope,
} from "../../src/lib/integrations/teamfeepay/index.js";

describe("TeamFeePay acquisition integration layer", () => {
  it("maps flexible partner club fields to the Daxora canonical model", () => {
    expect(mapPartnerClubToDaxora({
      club_id: "club-1",
      club_name: "Example FC",
      contact_email: "ops@example.test",
      postal_code: "BL1 1AA",
    })).toMatchObject({
      externalSource: "teamfeepay",
      externalId: "club-1",
      name: "Example FC",
      contactEmail: "ops@example.test",
      address: { postcode: "BL1 1AA" },
    });
  });

  it("maps teams, people and events without assuming a private provider schema", () => {
    expect(mapPartnerTeamToDaxora({ teamId: "t-1", teamName: "U14 Athletic", ageGroup: "U14" })).toMatchObject({
      externalId: "t-1",
      name: "U14 Athletic",
      ageGroup: "U14",
    });

    expect(mapPartnerPersonToDaxora({ member_id: "p-1", firstName: "Alex", lastName: "Morgan", role: "Coach" })).toMatchObject({
      externalId: "p-1",
      displayName: "Alex Morgan",
      roles: ["coach"],
    });

    expect(mapPartnerEventToDaxora({ fixture_id: "e-1", name: "Friendly", start: "2026-07-21T18:00:00Z" })).toMatchObject({
      externalId: "e-1",
      title: "Friendly",
      startsAt: "2026-07-21T18:00:00.000Z",
    });
  });

  it("creates a valid versioned and idempotent partner envelope", () => {
    const envelope = createPartnerEnvelope({
      eventType: "team.updated",
      sourceId: "team-1",
      occurredAt: "2026-07-21T09:00:00.000Z",
      data: { name: "U14 Athletic" },
    });
    expect(validatePartnerEnvelope(envelope)).toEqual({ valid: true, errors: [] });
    expect(envelope.idempotencyKey).toContain("team.updated");
  });

  it("previews and safely deduplicates mock sync batches", async () => {
    const adapter = new MockTeamFeePayAdapter({ latencyMs: 0 });
    const input = {
      eventType: "team.batch.updated",
      entityType: "team",
      records: [{ id: "t-1", name: "U14 Athletic" }],
      idempotencyKey: "test-batch-1",
    };
    const first = await adapter.commitSync(input);
    const duplicate = await adapter.commitSync(input);
    expect(first).toMatchObject({ duplicate: false, written: 1 });
    expect(duplicate).toMatchObject({ duplicate: true, written: 0 });
  });
});
