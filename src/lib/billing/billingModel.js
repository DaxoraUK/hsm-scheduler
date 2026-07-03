export const LEGAL_DOCUMENT_CODES = Object.freeze({
  SERVICE_TERMS: "service_terms",
  DATA_PROCESSING_ADDENDUM: "data_processing_addendum",
  ACCEPTABLE_USE: "acceptable_use",
  PRIVACY_NOTICE: "privacy_notice",
  COOKIE_NOTICE: "cookie_notice",
  SECURITY_OVERVIEW: "security_overview",
  SUBPROCESSOR_LIST: "subprocessor_list",
});

export const SELF_SERVICE_PLANS = Object.freeze(["link", "core", "pro"]);

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normaliseDocument(document = {}) {
  return Object.freeze({
    code: String(document.code || "").trim(),
    version: String(document.version || "").trim(),
    title: String(document.title || "Legal document").trim(),
    category: String(document.category || "commercial").trim(),
    status: String(document.status || "draft").trim(),
    requiredForCheckout: Boolean(document.required_for_checkout ?? document.requiredForCheckout),
    documentUrl: String(document.document_url || document.documentUrl || "").trim(),
    contentHash: String(document.content_hash || document.contentHash || "").trim(),
    accepted: Boolean(document.accepted),
    effectiveAt: safeDate(document.effective_at || document.effectiveAt),
    updatedAt: safeDate(document.updated_at || document.updatedAt),
  });
}

export function normaliseBillingReadiness(payload = {}) {
  const documents = (Array.isArray(payload.documents) ? payload.documents : []).map(normaliseDocument);
  return Object.freeze({
    clubId: String(payload.club_id || payload.clubId || "").trim(),
    provider: String(payload.provider || "manual").trim(),
    externalCustomerId: String(payload.external_customer_id || payload.externalCustomerId || "").trim(),
    externalSubscriptionId: String(payload.external_subscription_id || payload.externalSubscriptionId || "").trim(),
    lastInvoiceStatus: String(payload.last_invoice_status || payload.lastInvoiceStatus || "").trim(),
    lastPaymentAt: safeDate(payload.last_payment_at || payload.lastPaymentAt),
    paymentFailureCount: Number(payload.payment_failure_count ?? payload.paymentFailureCount ?? 0) || 0,
    stripeMode: String(payload.stripe_mode || payload.stripeMode || "disabled").trim(),
    billingEnabled: Boolean(payload.billing_enabled ?? payload.billingEnabled),
    legalAcceptanceComplete: Boolean(payload.legal_acceptance_complete ?? payload.legalAcceptanceComplete),
    checkoutReady: Boolean(payload.checkout_ready ?? payload.checkoutReady),
    documents,
    requiredDocuments: documents.filter((document) => document.requiredForCheckout),
    businessIdentity: Object.freeze({
      legalName: String(payload.business_identity?.legal_name || payload.businessIdentity?.legalName || "").trim(),
      tradingName: String(payload.business_identity?.trading_name || payload.businessIdentity?.tradingName || "Daxora").trim(),
      supportEmail: String(payload.business_identity?.support_email || payload.businessIdentity?.supportEmail || "").trim(),
      privacyEmail: String(payload.business_identity?.privacy_email || payload.businessIdentity?.privacyEmail || "").trim(),
      websiteUrl: String(payload.business_identity?.website_url || payload.businessIdentity?.websiteUrl || "").trim(),
      governingLaw: String(payload.business_identity?.governing_law || payload.businessIdentity?.governingLaw || "England and Wales").trim(),
      taxStatus: String(payload.business_identity?.tax_status || payload.businessIdentity?.taxStatus || "not_configured").trim(),
      vatNumber: String(payload.business_identity?.vat_number || payload.businessIdentity?.vatNumber || "").trim(),
    }),
  });
}

export function buildAcceptancePayload(documents = []) {
  return Object.fromEntries(
    documents
      .filter((document) => document.requiredForCheckout && document.status === "published")
      .map((document) => [document.code, document.version])
  );
}

export function canSelfServePlan(planCode, billingInterval = "monthly") {
  const plan = String(planCode || "").toLowerCase();
  const interval = String(billingInterval || "monthly").toLowerCase();
  if (!SELF_SERVICE_PLANS.includes(plan)) return false;
  if (interval === "annual") return plan === "link";
  return interval === "monthly";
}

export function checkoutBlockers({ billing, subscription, authorityConfirmed = false } = {}) {
  const blockers = [];
  if (!billing?.billingEnabled) blockers.push("Daxora billing is not enabled yet.");
  if (!billing?.requiredDocuments?.length) blockers.push("Required commercial documents have not been published.");
  if (!billing?.legalAcceptanceComplete && !authorityConfirmed) blockers.push("The club owner must accept the current commercial documents.");
  if (subscription?.billingExempt || subscription?.isInternal) blockers.push("This workspace is billing exempt.");
  return blockers;
}

export function normalisePlatformBillingReadiness(payload = {}) {
  const settings = payload.settings || {};
  return Object.freeze({
    configurationReady: Boolean(payload.configuration_ready ?? payload.configurationReady),
    settings: Object.freeze({
      legalName: String(settings.legal_name || settings.legalName || "").trim(),
      tradingName: String(settings.trading_name || settings.tradingName || "Daxora").trim(),
      serviceAddress: String(settings.service_address || settings.serviceAddress || "").trim(),
      websiteUrl: String(settings.website_url || settings.websiteUrl || "").trim(),
      supportEmail: String(settings.support_email || settings.supportEmail || "").trim(),
      privacyEmail: String(settings.privacy_email || settings.privacyEmail || "").trim(),
      governingLaw: String(settings.governing_law || settings.governingLaw || "England and Wales").trim(),
      stripeMode: String(settings.stripe_mode || settings.stripeMode || "disabled").trim(),
      taxStatus: String(settings.tax_status || settings.taxStatus || "not_configured").trim(),
      vatNumber: String(settings.vat_number || settings.vatNumber || "").trim(),
      invoicePrefix: String(settings.invoice_prefix || settings.invoicePrefix || "DAX").trim(),
    }),
    documents: (Array.isArray(payload.documents) ? payload.documents : []).map(normaliseDocument),
    metrics: Object.freeze({
      clubsWithStripeCustomer: Number(payload.metrics?.clubs_with_stripe_customer || 0),
      activePaidClubs: Number(payload.metrics?.active_paid_clubs || 0),
      failedEvents: Number(payload.metrics?.failed_events || 0),
      unprocessedEvents: Number(payload.metrics?.unprocessed_events || 0),
    }),
  });
}

export function validatePlatformLegalSettings(settings = {}) {
  const errors = [];
  if (String(settings.legalName || "").trim().length < 2) errors.push("Legal owner name is required.");
  if (String(settings.tradingName || "").trim().length < 2) errors.push("Trading name is required.");
  if (String(settings.serviceAddress || "").trim().length < 6) errors.push("A service address is required.");
  if (!String(settings.supportEmail || "").includes("@")) errors.push("A valid support email is required.");
  if (!String(settings.privacyEmail || "").includes("@")) errors.push("A valid privacy email is required.");
  if (settings.taxStatus === "vat_registered" && String(settings.vatNumber || "").trim().length < 4) errors.push("VAT number is required.");
  return errors;
}
