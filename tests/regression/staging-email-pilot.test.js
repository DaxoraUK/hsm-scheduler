import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  communicationProviderConfig,
  publicCommunicationCapabilities,
} from "../../server/communications/config.js";
import { sendProviderMessage } from "../../server/communications/providers.js";
import { mapResendStatus } from "../../server/communications/webhooks.js";

const dispatchSource = readFileSync(new URL("../../api/communications/dispatch.js", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../../src/pages/CommunicationsPage.jsx", import.meta.url), "utf8");
const stagingEnv = readFileSync(new URL("../../.env.staging.example", import.meta.url), "utf8");

const ENV_NAMES = [
  "VERCEL_ENV",
  "COMMUNICATIONS_DEPLOYMENT_ENVIRONMENT",
  "COMMUNICATIONS_WEB_SEND_ENABLED",
  "COMMUNICATIONS_EMAIL_ENABLED",
  "COMMUNICATIONS_EMAIL_FROM",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "COMMUNICATIONS_EMAIL_PILOT_MODE",
  "COMMUNICATIONS_EMAIL_PILOT_RECIPIENT",
  "COMMUNICATIONS_EMAIL_PILOT_OPERATOR_EMAILS",
  "COMMUNICATIONS_EMAIL_PILOT_MAX_BATCH",
];
const originalEnvironment = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));

function configurePreviewEmail() {
  process.env.VERCEL_ENV = "preview";
  process.env.COMMUNICATIONS_WEB_SEND_ENABLED = "true";
  process.env.COMMUNICATIONS_EMAIL_ENABLED = "true";
  process.env.COMMUNICATIONS_EMAIL_FROM = "Ground Control Staging <matchday@example.org>";
  process.env.RESEND_API_KEY = "re_test_key";
}

function configurePilot() {
  configurePreviewEmail();
  process.env.COMMUNICATIONS_EMAIL_PILOT_MODE = "true";
  process.env.COMMUNICATIONS_EMAIL_PILOT_RECIPIENT = "internal.test@example.org";
  process.env.COMMUNICATIONS_EMAIL_PILOT_OPERATOR_EMAILS = "andrew@example.org, support@example.org";
  process.env.COMMUNICATIONS_EMAIL_PILOT_MAX_BATCH = "5";
}

afterEach(() => {
  vi.unstubAllGlobals();
  ENV_NAMES.forEach((name) => {
    if (originalEnvironment[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnvironment[name];
  });
});

describe("staging email pilot", () => {
  test("fails closed on Vercel Preview until redirect recipient and operator allowlist are configured", () => {
    configurePreviewEmail();
    let capabilities = publicCommunicationCapabilities();
    expect(capabilities.channels.email.enabled).toBe(false);
    expect(capabilities.channels.email.blockedReason).toBe("staging-pilot-incomplete");

    configurePilot();
    capabilities = publicCommunicationCapabilities();
    expect(capabilities.webSendingEnabled).toBe(true);
    expect(capabilities.mode).toBe("staging-email-pilot");
    expect(capabilities.channels.email.pilotMode).toBe(true);
    expect(capabilities.channels.email.pilotRecipientHint).toMatch(/^in•+@example\.org$/);
    expect(capabilities.channels.email.maxBatch).toBe(5);
  });

  test("redirects provider email to the internal pilot inbox and clearly marks the message as a test", async () => {
    configurePilot();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email-provider-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendProviderMessage({
      channel: "email",
      destination: "coach@example.org",
      subject: "HSM U14 matchday details",
      messageBody: "Hi Coach, your fixture is scheduled for Saturday at 10:00.",
      recipientLabel: "Coach One",
      recipientType: "coach",
      recipientHint: "co•••@example.org",
      idempotencyKey: "a".repeat(64),
      clubTag: "club123",
      messageTag: "message123",
    });

    expect(result.status).toBe("provider_accepted");
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.to).toEqual(["internal.test@example.org"]);
    expect(request.subject).toBe("[STAGING TEST] HSM U14 matchday details");
    expect(request.text).toContain("It was not sent to the saved coach or assistant contact.");
    expect(request.text).toContain("Coach One (co•••@example.org)");
    expect(request.tags).toContainEqual({ name: "environment", value: "staging" });
  });

  test("restricts the pilot to authorised operators, email only, explicit acknowledgement and a small batch", () => {
    expect(dispatchSource).toContain("EMAIL_PILOT_OPERATOR_NOT_AUTHORISED");
    expect(dispatchSource).toContain("EMAIL_PILOT_ACKNOWLEDGEMENT_REQUIRED");
    expect(dispatchSource).toContain("EMAIL_PILOT_CHANNEL_RESTRICTED");
    expect(dispatchSource).toContain("EMAIL_PILOT_BATCH_LIMIT");
    expect(dispatchSource).toContain("providerConfig.email.pilotOperatorEmails.includes(actorEmail)");
    expect(dispatchSource).toContain("body?.pilotAcknowledged !== true");
  });

  test("makes the redirect boundary visible in Communications and keeps SMS and WhatsApp off in the staging template", () => {
    expect(pageSource).toContain("Staging email pilot is active");
    expect(pageSource).toContain("No coach will receive these messages");
    expect(pageSource).toContain("Send staging email test");
    expect(stagingEnv).toContain("COMMUNICATIONS_EMAIL_PILOT_MODE=true");
    expect(stagingEnv).toContain("COMMUNICATIONS_EMAIL_PILOT_RECIPIENT=YOUR_INTERNAL_ADULT_TEST_EMAIL");
    expect(stagingEnv).toContain("COMMUNICATIONS_SMS_ENABLED=false");
    expect(stagingEnv).toContain("COMMUNICATIONS_WHATSAPP_ENABLED=false");
  });

  test("maps Resend hard failures and suppression separately from delivery", () => {
    expect(mapResendStatus("email.failed")).toBe("failed");
    expect(mapResendStatus("email.suppressed")).toBe("undelivered");
    expect(mapResendStatus("email.delivered")).toBe("delivered");
  });

  test("does not expose the full pilot recipient through public capabilities", () => {
    configurePilot();
    const config = communicationProviderConfig();
    const capabilities = publicCommunicationCapabilities();
    expect(config.email.pilotRecipient).toBe("internal.test@example.org");
    expect(JSON.stringify(capabilities)).not.toContain("internal.test@example.org");
    expect(capabilities.channels.email.pilotRecipientHint).toContain("@example.org");
  });
});
