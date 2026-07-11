import { describe, expect, test } from "vitest";
import { buildMatchdayEmail, escapeHtml, MATCHDAY_EMAIL_TEMPLATE_VERSION } from "../../server/communications/emailTemplates.js";
import { sanitiseOutboundMessages, sha256 } from "../../server/communications/normalise.js";
import { buildDeliveryMessages } from "../../src/lib/communications/deliveryService.js";

const capabilities = {
  channels: {
    email: { enabled: true },
    sms: { enabled: false },
    whatsapp: { enabled: false },
  },
};

const row = {
  id: "saturday:fixture-1",
  messageHash: "hash-1",
  clubName: "Horwich St Mary's FC",
  status: "scheduled",
  dateLabel: "Saturday, 11 July 2026",
  teamName: "U8 Sharks",
  opposition: "Westhoughton Juniors U8",
  ko: "08:30",
  venue: "Scholes Bank",
  pitch: "P5",
  format: "5v5",
  referee: "Parent Ref",
  contact: { teamKey: "u8-sharks" },
  recipients: [{
    type: "coach",
    name: "Andrew Manville",
    destination: "andrew@example.org",
    channel: "email",
    message: "Hi Andrew Manville, fixture details.",
  }],
  raw: { id: "fixture-1" },
};

describe("professional matchday email", () => {
  test("carries structured fixture information through the browser and server boundary", () => {
    const prepared = buildDeliveryMessages([row], capabilities).messages[0];
    expect(prepared).toMatchObject({
      clubName: "Horwich St Mary's FC",
      status: "scheduled",
      opposition: "Westhoughton Juniors U8",
      kickOff: "08:30",
      venue: "Scholes Bank",
      pitch: "P5",
      subject: "U8 Sharks | matchday details",
    });

    const sanitised = sanitiseOutboundMessages("club-1", [prepared])[0];
    expect(sanitised).toMatchObject({
      clubName: "Horwich St Mary's FC",
      status: "scheduled",
      dateLabel: "Saturday, 11 July 2026",
      opposition: "Westhoughton Juniors U8",
      kickOff: "08:30",
      venue: "Scholes Bank",
    });
  });

  test("versions email delivery identity so a redesigned template creates a fresh provider request", () => {
    const prepared = buildDeliveryMessages([row], capabilities).messages[0];
    const sanitised = sanitiseOutboundMessages("club-1", [prepared])[0];
    const legacyKey = sha256([
      "club-1",
      "email",
      "andrew@example.org",
      "hash-1",
      "coach",
    ].join("|"));

    expect(sanitised.contentVersion).toBe(MATCHDAY_EMAIL_TEMPLATE_VERSION);
    expect(sanitised.idempotencyKey).not.toBe(legacyKey);
  });

  test("builds a responsive branded HTML email and a complete plain-text fallback", () => {
    const email = buildMatchdayEmail({
      ...buildDeliveryMessages([row], capabilities).messages[0],
      recipientHint: "a***@example.org",
      idempotencyKey: "abc1234567890",
      messageTag: "message-reference-123",
    }, { pilotMode: true });

    expect(email.subject).toBe("[STAGING TEST] U8 Sharks | matchday details");
    expect(email.html).toContain("Daxora");
    expect(email.html).toContain("Ground Control");
    expect(email.html).toContain("Internal staging test");
    expect(email.html).toContain("U8 Sharks v Westhoughton Juniors U8");
    expect(email.html).toContain("Saturday, 11 July 2026");
    expect(email.html).toContain("Scholes Bank");
    expect(email.html).toContain("Parent Ref");
    expect(email.html).toContain('name="viewport"');
    expect(email.text).toContain("No saved coach or assistant address received it.");
    expect(email.text).toContain("Kick-off: 08:30");
    expect(email.text).toContain("Sent on behalf of Horwich St Mary's FC");
  });

  test("uses clear status-specific subjects and messaging", () => {
    const cancelled = buildMatchdayEmail({ ...row, recipientLabel: "Coach", status: "cancelled" });
    const postponed = buildMatchdayEmail({ ...row, recipientLabel: "Coach", status: "postponed" });
    const unresolved = buildMatchdayEmail({ ...row, recipientLabel: "Coach", status: "unresolved" });

    expect(cancelled.subject).toBe("U8 Sharks | fixture cancelled");
    expect(cancelled.html).toContain("Fixture cancelled");
    expect(postponed.subject).toBe("U8 Sharks | fixture postponed");
    expect(postponed.html).toContain("do not travel");
    expect(unresolved.subject).toBe("U8 Sharks | fixture update");
    expect(unresolved.html).toContain("do not circulate final arrangements");
  });

  test("escapes user-controlled club and fixture content before inserting it into HTML", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    const email = buildMatchdayEmail({
      ...row,
      recipientLabel: '<img src=x onerror="alert(1)">',
      clubName: "Club & Community",
    });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("Club &amp; Community");
  });
});
