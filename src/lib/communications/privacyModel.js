export const COMMUNICATION_LAWFUL_BASES = Object.freeze([
  ["legitimate_interests", "Legitimate interests"],
  ["contract", "Contract"],
  ["consent", "Consent"],
  ["legal_obligation", "Legal obligation"],
  ["public_task", "Public task"],
  ["vital_interests", "Vital interests"],
]);

export const DPIA_STATUSES = Object.freeze([
  ["not_assessed", "Not assessed"],
  ["screened_no_high_risk", "Screened — no high risk identified"],
  ["full_dpia_required", "Full DPIA required"],
  ["completed", "DPIA completed"],
]);

export const DEFAULT_COMMUNICATION_PRIVACY = Object.freeze({
  lawfulBasis: "",
  purpose: "Operational matchday communication with adult team coaches and managers.",
  privacyNoticeUrl: "",
  privacyContactEmail: "",
  controllerName: "",
  retentionDays: 365,
  dpiaStatus: "not_assessed",
  lastReviewedAt: null,
  configured: false,
});

export function clubPrivacySlug(club = {}) {
  const configured = text(club.slug || club.club_slug);
  if (configured) return configured.toLowerCase();
  return text(club.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildHostedPrivacyNoticeUrl(club = {}, origin = "https://app.daxora.co.uk") {
  const slug = clubPrivacySlug(club);
  return slug ? `${String(origin || "https://app.daxora.co.uk").replace(/\/$/, "")}/privacy/${encodeURIComponent(slug)}` : "";
}

function text(value) {
  return String(value || "").trim();
}

export function normaliseCommunicationPrivacy(value = {}) {
  const retention = Number(value.retentionDays ?? value.retention_days ?? 365);
  const lawfulBasis = text(value.lawfulBasis || value.lawful_basis).toLowerCase();
  const dpiaStatus = text(value.dpiaStatus || value.dpia_status || "not_assessed").toLowerCase();
  const next = {
    lawfulBasis: COMMUNICATION_LAWFUL_BASES.some(([key]) => key === lawfulBasis) ? lawfulBasis : "",
    purpose: text(value.purpose || DEFAULT_COMMUNICATION_PRIVACY.purpose),
    privacyNoticeUrl: text(value.privacyNoticeUrl || value.privacy_notice_url),
    privacyContactEmail: text(value.privacyContactEmail || value.privacy_contact_email).toLowerCase(),
    controllerName: text(value.controllerName || value.controller_name),
    retentionDays: Math.max(30, Math.min(Number.isFinite(retention) ? retention : 365, 2555)),
    dpiaStatus: DPIA_STATUSES.some(([key]) => key === dpiaStatus) ? dpiaStatus : "not_assessed",
    lastReviewedAt: value.lastReviewedAt || value.last_reviewed_at || null,
    updatedAt: value.updatedAt || value.updated_at || null,
  };
  return {
    ...next,
    configured: Boolean(next.lawfulBasis && next.purpose && next.privacyNoticeUrl && next.privacyContactEmail && next.controllerName),
  };
}

export function communicationPrivacyGaps(value = {}) {
  const privacy = normaliseCommunicationPrivacy(value);
  const gaps = [];
  if (!privacy.controllerName) gaps.push("Controller name");
  if (!privacy.privacyContactEmail) gaps.push("Privacy contact email");
  if (!privacy.lawfulBasis) gaps.push("Lawful basis");
  if (!privacy.purpose) gaps.push("Purpose");
  if (!privacy.privacyNoticeUrl) gaps.push("Privacy notice URL");
  if (privacy.dpiaStatus === "not_assessed") gaps.push("DPIA screening");
  return gaps;
}
