import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { buildCommunicationsModel } from "../../src/lib/communications/communicationsEngine.js";
import {
  buildDeliveryMessages,
  EMPTY_DELIVERY_CAPABILITIES,
} from "../../src/lib/communications/deliveryService.js";
import {
  publicCommunicationCapabilities,
} from "../../server/communications/config.js";
import {
  normaliseDestination,
  sanitiseOutboundMessages,
} from "../../server/communications/normalise.js";
import {
  mapResendStatus,
  mapTwilioStatus,
} from "../../server/communications/webhooks.js";

const migration = readFileSync(
  new URL("../../supabase/migrations/202607110003_communications_delivery_foundation.sql", import.meta.url),
  "utf8",
);
const page = readFileSync(new URL("../../src/pages/CommunicationsPage.jsx", import.meta.url), "utf8");
const dispatchApi = readFileSync(new URL("../../server-api/communications/dispatch.js", import.meta.url), "utf8");
const productionEnv = readFileSync(new URL("../../.env.production.example", import.meta.url), "utf8");

const ENV_NAMES = [
  "COMMUNICATIONS_WEB_SEND_ENABLED",
  "COMMUNICATIONS_EMAIL_ENABLED",
  "COMMUNICATIONS_SMS_ENABLED",
  "COMMUNICATIONS_WHATSAPP_ENABLED",
  "COMMUNICATIONS_EMAIL_FROM",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_MESSAGING_SERVICE_SID",
  "TWILIO_SMS_FROM",
  "TWILIO_WHATSAPP_FROM",
  "TWILIO_WHATSAPP_CONTENT_SID",
  "COMMUNICATIONS_PUBLIC_BASE_URL",
];

const originalEnvironment = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
afterEach(() => {
  ENV_NAMES.forEach((name) => {
    if (originalEnvironment[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnvironment[name];
  });
});

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

function configureEmail() {
  process.env.COMMUNICATIONS_WEB_SEND_ENABLED = "true";
  process.env.COMMUNICATIONS_EMAIL_ENABLED = "true";
  process.env.COMMUNICATIONS_EMAIL_FROM = "Ground Control <matchday@example.org>";
  process.env.RESEND_API_KEY = "re_test_key";
}

describe("web messaging delivery foundation", () => {
  test("keeps every provider disabled until explicit server-side flags and credentials exist", () => {
    ENV_NAMES.forEach((name) => delete process.env[name]);
    const capabilities = publicCommunicationCapabilities();
    expect(capabilities.webSendingEnabled).toBe(false);
    expect(capabilities.channels.email.enabled).toBe(false);
    expect(capabilities.channels.sms.enabled).toBe(false);
    expect(capabilities.channels.whatsapp.enabled).toBe(false);

    configureEmail();
    const configured = publicCommunicationCapabilities();
    expect(configured.webSendingEnabled).toBe(true);
    expect(configured.channels.email.provider).toBe("Resend");
    expect(configured.channels.sms.enabled).toBe(false);
  });

  test("normalises UK destinations and creates deterministic provider idempotency keys", () => {
    expect(normaliseDestination("sms", "07123 456789")).toBe("+447123456789");
    expect(normaliseDestination("email", " Coach@Example.ORG ")).toBe("coach@example.org");

    const input = {
      clientKey: "fixture-1:coach",
      messageKey: "fixture-1",
      messageHash: "hash-1",
      teamName: "HSM U14",
      recipientType: "coach",
      recipientLabel: "Coach One",
      channel: "sms",
      destination: "07123 456789",
      message: "This is a complete operational matchday message.",
    };
    const first = sanitiseOutboundMessages("club-1", [input])[0];
    const second = sanitiseOutboundMessages("club-1", [input])[0];
    expect(first.destination).toBe("+447123456789");
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(first.recipientHint).toBe("•••• 6789");
  });

  test("personalises primary and assistant messages before dispatch", () => {
    const model = buildCommunicationsModel({
      teamCfg: [{ id: "team-1", name: "HSM U14" }],
      teamContacts: [{
        teamKey: "team-1",
        teamName: "HSM U14",
        coachName: "Jordan",
        coachEmail: "jordan@example.org",
        assistantName: "Taylor",
        assistantEmail: "taylor@example.org",
        assistantEnabled: true,
        preferredChannel: "email",
        privacyNoticeProvidedAt: "2026-07-11T12:00:00.000Z",
      }],
      satFinal: [fixture()],
      satHasRun: true,
      midweekEnabled: false,
    });
    const capabilities = {
      ...EMPTY_DELIVERY_CAPABILITIES,
      webSendingEnabled: true,
      channels: {
        ...EMPTY_DELIVERY_CAPABILITIES.channels,
        email: { enabled: true, provider: "Resend", statusTracking: true },
      },
    };
    const prepared = buildDeliveryMessages(model.rows, capabilities);
    expect(prepared.messages).toHaveLength(2);
    expect(prepared.messages[0].message).toContain("Hi Jordan,");
    expect(prepared.messages[1].message).toContain("Hi Taylor,");
  });

  test("creates RPC-only delivery batches with retention, duplicate protection and service-role provider updates", () => {
    expect(migration).toContain("create table if not exists public.communication_delivery_batches");
    expect(migration).toContain("create table if not exists public.communication_deliveries");
    expect(migration).toContain("create table if not exists public.communication_batch_items");
    expect(migration).toContain("now() - interval '24 hours'");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("validate_communication_delivery_recipients");
    expect(migration).toContain("The selected recipient does not match the saved adult team contact");
    expect(migration).toContain("The club web-sending safety limit has been reached");
    expect(migration).toContain("export_communication_delivery_data");
    expect(migration).toContain("Complete Privacy & contacts before using web sending");
    expect(migration).toMatch(/grant execute on function public\.create_communication_delivery_batch[\s\S]*to authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.complete_communication_delivery[\s\S]*to service_role/i);
    expect(migration).toMatch(/revoke all on public\.communication_deliveries from public, anon, authenticated/i);
  });

  test("prepares secure dispatch and provider-confirmed statuses without exposing secrets to the browser", () => {
    expect(page).toContain("Send selected via web");
    expect(page).toContain("Web delivery foundation installed");
    expect(page).toContain("Delivery status will update only when the provider confirms it");
    expect(dispatchApi).toContain("verifySupabaseUser");
    expect(dispatchApi).toContain("validate_communication_delivery_recipients");
    expect(dispatchApi).toContain("claim_communication_delivery");
    expect(dispatchApi).toContain("complete_communication_delivery");
    expect(productionEnv).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(productionEnv).toContain("COMMUNICATIONS_WEB_SEND_ENABLED=false");
    expect(productionEnv).not.toContain("VITE_RESEND_API_KEY");
    expect(productionEnv).not.toContain("VITE_TWILIO_AUTH_TOKEN");
  });

  test("maps provider callbacks into distinct accepted, sent, delivered and failure states", () => {
    expect(mapResendStatus("email.sent")).toBe("sent");
    expect(mapResendStatus("email.delivered")).toBe("delivered");
    expect(mapResendStatus("email.bounced")).toBe("undelivered");
    expect(mapTwilioStatus("queued")).toBe("provider_accepted");
    expect(mapTwilioStatus("delivered")).toBe("delivered");
    expect(mapTwilioStatus("read")).toBe("read");
    expect(mapTwilioStatus("failed")).toBe("failed");
  });
});
