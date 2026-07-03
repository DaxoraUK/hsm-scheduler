import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  buildAcceptancePayload,
  canSelfServePlan,
  normaliseBillingReadiness,
  normalisePlatformBillingReadiness,
  validatePlatformLegalSettings,
} from "../../src/lib/billing/billingModel.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

describe("billing and legal readiness", () => {
  it("normalises published documents and provider state", () => {
    const billing = normaliseBillingReadiness({
      club_id: "club-1",
      provider: "stripe",
      external_customer_id: "cus_123",
      billing_enabled: true,
      legal_acceptance_complete: false,
      checkout_ready: false,
      documents: [
        { code: "service_terms", version: "1.0", title: "Terms", status: "published", required_for_checkout: true, document_url: "https://example.test/terms", accepted: false },
        { code: "privacy_notice", version: "1.0", title: "Privacy", status: "published", required_for_checkout: false, document_url: "https://example.test/privacy", accepted: false },
      ],
    });

    expect(billing.provider).toBe("stripe");
    expect(billing.externalCustomerId).toBe("cus_123");
    expect(billing.requiredDocuments).toHaveLength(1);
    expect(buildAcceptancePayload(billing.documents)).toEqual({ service_terms: "1.0" });
  });

  it("limits self-service checkout to configured package intervals", () => {
    expect(canSelfServePlan("link", "monthly")).toBe(true);
    expect(canSelfServePlan("link", "annual")).toBe(true);
    expect(canSelfServePlan("core", "monthly")).toBe(true);
    expect(canSelfServePlan("core", "annual")).toBe(false);
    expect(canSelfServePlan("elite", "monthly")).toBe(false);
  });

  it("requires a complete sole-trader billing identity", () => {
    expect(validatePlatformLegalSettings({
      legalName: "",
      tradingName: "Daxora",
      serviceAddress: "",
      supportEmail: "bad",
      privacyEmail: "",
      taxStatus: "vat_registered",
      vatNumber: "",
    })).toHaveLength(5);

    expect(validatePlatformLegalSettings({
      legalName: "Andrew Example",
      tradingName: "Daxora",
      serviceAddress: "Service address, Bolton, UK",
      supportEmail: "support@example.test",
      privacyEmail: "privacy@example.test",
      taxStatus: "not_vat_registered",
      vatNumber: "",
    })).toEqual([]);
  });

  it("normalises platform readiness metrics", () => {
    const readiness = normalisePlatformBillingReadiness({
      configuration_ready: true,
      settings: { legal_name: "Andrew Example", stripe_mode: "test" },
      metrics: { clubs_with_stripe_customer: 2, active_paid_clubs: 1, failed_events: 3 },
    });
    expect(readiness.configurationReady).toBe(true);
    expect(readiness.settings.stripeMode).toBe("test");
    expect(readiness.metrics.failedEvents).toBe(3);
  });

  it("keeps legal documents draft and checkout fail-closed after migration", () => {
    const migration = read("supabase/migrations/202607030006_billing_legal_readiness.sql");
    expect(migration).toContain("'service_terms', '1.0-draft'");
    expect(migration).toContain("status = 'published'");
    expect(migration).toContain("private.billing_legal_configuration_ready()");
    expect(migration).toContain("Club owner access required");
  });


  it("requires HTTPS legal documents and limits acceptance visibility", () => {
    const migration = read("supabase/migrations/202607030006_billing_legal_readiness.sql");
    expect(migration).toContain("document.document_url ~* '^https://'");
    expect(migration).toContain("public.has_club_role(club_id, array['owner', 'admin'])");
  });

  it("retries failed or stale Stripe events without double-processing completed events", () => {
    const webhook = read("supabase/functions/stripe-webhook/index.ts");
    expect(webhook).toContain('["processed", "ignored"].includes(existingEvent.processing_status)');
    expect(webhook).toContain("Date.now() - receivedAt < 120_000");
    expect(webhook).toContain('processing_status: "processing"');
  });

  it("verifies Stripe signatures and keeps secrets outside browser source", () => {
    const webhook = read("supabase/functions/stripe-webhook/index.ts");
    const checkout = read("supabase/functions/create-checkout-session/index.ts");
    const browserClient = read("src/lib/supabase.js");
    expect(webhook).toContain("constructEventAsync");
    expect(webhook).toContain("STRIPE_WEBHOOK_SECRET");
    expect(checkout).toContain("requireBillingReady");
    expect(browserClient).not.toContain("STRIPE_SECRET_KEY");
    expect(browserClient).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
