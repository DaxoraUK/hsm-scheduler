import { createHash } from "node:crypto";
import { leagueAnalyticsArtifact, leagueAnalyticsModelFromSnapshot, leagueAnalyticsSnapshotAgeHours, leagueAnalyticsToHtml } from "../../src/lib/league/leagueAnalyticsEngine.js";
import { sendDaxoraEmail } from "../notifications/email.js";

function slug(value = "report") {
  return String(value || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "report";
}

function normaliseRun(run = {}) {
  return {
    id: run.id,
    leagueId: run.league_id || run.leagueId,
    leagueName: run.league_name || run.leagueName || "League",
    definitionName: run.definition_name || run.definitionName || "League report",
    reportType: run.report_type || run.reportType || "executive",
    deliveryFormat: run.delivery_format || run.deliveryFormat || "html",
    recipients: Array.isArray(run.recipients) ? run.recipients : [],
    freshnessHours: Number(run.freshness_hours ?? run.freshnessHours ?? 24),
    snapshotCreatedAt: run.snapshot_created_at || run.snapshotCreatedAt || null,
    snapshot: run.snapshot && typeof run.snapshot === "object" ? run.snapshot : null,
  };
}

export async function deliverLeagueReport(runInput = {}) {
  const run = normaliseRun(runInput);
  if (!run.id) throw Object.assign(new Error("The report delivery run has no identifier."), { code: "REPORT_RUN_INVALID", status: 400 });
  if (!run.snapshot) throw Object.assign(new Error("No report snapshot is available. Open Analytics and refresh the report data before retrying."), { code: "REPORT_SNAPSHOT_MISSING", status: 409 });
  const ageHours = leagueAnalyticsSnapshotAgeHours({ generatedAt: run.snapshotCreatedAt || run.snapshot.generatedAt });
  if (ageHours > run.freshnessHours) throw Object.assign(new Error(`The newest report snapshot is ${Math.floor(ageHours)} hours old. Refresh Analytics before delivery.`), { code: "REPORT_SNAPSHOT_STALE", status: 409 });
  if (!run.recipients.length) throw Object.assign(new Error("The report schedule has no email recipients or active distribution list."), { code: "REPORT_RECIPIENTS_MISSING", status: 409 });

  const model = leagueAnalyticsModelFromSnapshot(run.snapshot);
  model.league = { ...model.league, id: run.leagueId || model.league?.id || "", name: run.leagueName || model.league?.name || "League" };
  const artifact = leagueAnalyticsArtifact(model, run.reportType, run.deliveryFormat);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${slug(run.leagueName)}-${slug(run.reportType)}-${date}.${artifact.extension}`;
  const reportHtml = leagueAnalyticsToHtml(model, run.reportType);
  const digest = createHash("sha256").update(String(run.id)).digest("hex").slice(0, 24);
  const result = await sendDaxoraEmail({
    to: run.recipients,
    subject: `${run.leagueName} · ${run.definitionName}`,
    html: `${reportHtml.replace("</main>", `<div class="note"><strong>Automated delivery:</strong> This pack was produced by Daxora reporting automation from a governed snapshot captured ${new Date(run.snapshotCreatedAt || run.snapshot.generatedAt).toLocaleString("en-GB")}.</div></main>`)}`,
    attachments: [{ filename, content: artifact.content, contentType: artifact.contentType }],
    idempotencyKey: `daxora-report-${run.id}`,
    tags: { product: "league-manager", report: slug(run.reportType), run: digest },
  });
  return { ...result, filename, snapshotAgeHours: Math.round(ageHours * 10) / 10 };
}
