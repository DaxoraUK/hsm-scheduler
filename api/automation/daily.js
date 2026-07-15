import { json, methodNotAllowed } from "../../server/communications/http.js";
import { serviceRpc } from "../../server/communications/supabase.js";
import { sendDaxoraEmail } from "../../server/notifications/email.js";
import { processLeagueReportRun } from "../../server/reports/processor.js";
import { deliverLeagueFinanceDocument } from "../../server/finance/delivery.js";

function authorised(request) {
  const secret = String(process.env.CRON_SECRET || process.env.DAXORA_AUTOMATION_SECRET || "").trim();
  if (!secret) return false;
  return String(request.headers.get("authorization") || "") === `Bearer ${secret}`;
}

function digestHtml(item = {}) {
  const rows = (Array.isArray(item.notifications) ? item.notifications : []).map((notification) => `<tr><td style="padding:12px;border-bottom:1px solid #e2e8f0"><div style="font-weight:800;color:#0f172a">${String(notification.title || "Daxora update").replaceAll("<", "&lt;")}</div><div style="margin-top:4px;color:#64748b;font-size:13px;line-height:1.5">${String(notification.description || "").replaceAll("<", "&lt;")}</div></td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><main style="max-width:680px;margin:0 auto;padding:28px"><div style="background:#07121f;color:white;padding:26px;border-radius:20px 20px 0 0"><div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#6ee7b7;font-weight:800">Daxora Ground Control</div><h1 style="margin:8px 0 0;font-size:25px">${item.cadence === "weekly" ? "Weekly" : "Daily"} activity digest</h1></div><div style="background:white;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 20px 20px;overflow:hidden"><table style="width:100%;border-collapse:collapse">${rows || '<tr><td style="padding:24px">No unread activity.</td></tr>'}</table><div style="padding:18px;background:#ecfdf5;color:#065f46;font-size:12px;font-weight:700">Open Daxora to review and resolve these items.</div></div></main></body></html>`;
}

export async function GET(request) {
  if (!authorised(request)) return json({ error: "Automation secret rejected.", code: "AUTOMATION_UNAUTHORISED" }, 401);
  const summary = { reportsEnqueued: 0, reportsProcessed: [], financeRemindersProcessed: [], digestsProcessed: [] };
  try {
    summary.reportsEnqueued = Number(await serviceRpc("enqueue_due_league_report_deliveries", {})) || 0;
    const runs = await serviceRpc("claim_due_league_report_deliveries", { batch_size: 20 });
    for (const run of Array.isArray(runs) ? runs : []) summary.reportsProcessed.push(await processLeagueReportRun(run));

    const financeReminders = await serviceRpc("claim_due_league_finance_reminders", { batch_size: 50 });
    for (const reminder of Array.isArray(financeReminders) ? financeReminders : []) {
      try {
        const result = await deliverLeagueFinanceDocument(reminder);
        await serviceRpc("complete_league_finance_delivery", { target_delivery_id: result.deliveryId, next_status: "delivered", provider_name: result.provider || "resend", provider_reference_value: result.reference || "", error_message_value: "" });
        summary.financeRemindersProcessed.push({ deliveryId: result.deliveryId, invoiceNumber: result.invoiceNumber, status: "delivered", reference: result.reference });
      } catch (error) {
        const deliveryId = reminder?.delivery_id || reminder?.deliveryId;
        if (deliveryId) await serviceRpc("complete_league_finance_delivery", { target_delivery_id: deliveryId, next_status: "failed", provider_name: "resend", provider_reference_value: "", error_message_value: error?.message || "Automated finance reminder failed." }).catch(() => null);
        summary.financeRemindersProcessed.push({ deliveryId, status: "failed", error: error?.message });
      }
    }

    const digests = await serviceRpc("claim_daxora_notification_digests", { batch_size: 50 });
    for (const digest of Array.isArray(digests) ? digests : []) {
      try {
        const result = await sendDaxoraEmail({
          to: [digest.email],
          subject: `Daxora ${digest.cadence === "weekly" ? "weekly" : "daily"} activity digest`,
          html: digestHtml(digest),
          idempotencyKey: `daxora-digest-${digest.user_id}-${digest.cadence}-${new Date().toISOString().slice(0, 10)}`,
          tags: { product: "ground-control", type: `${digest.cadence}-digest` },
        });
        await serviceRpc("complete_daxora_notification_digest", { target_user_id: digest.user_id, digest_cadence: digest.cadence, delivered: true });
        summary.digestsProcessed.push({ userId: digest.user_id, status: "delivered", reference: result.reference });
      } catch (error) {
        await serviceRpc("complete_daxora_notification_digest", { target_user_id: digest.user_id, digest_cadence: digest.cadence, delivered: false }).catch(() => null);
        summary.digestsProcessed.push({ userId: digest.user_id, status: "failed", error: error?.message });
      }
    }
    return json(summary);
  } catch (error) {
    return json({ ...summary, error: error?.message || "Daily automation failed.", code: error?.code || "DAILY_AUTOMATION_FAILED" }, Number(error?.status) || 500);
  }
}

export function POST() { return methodNotAllowed("GET"); }
