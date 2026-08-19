import { createHash } from "node:crypto";
import { leagueInvoiceToHtml, normaliseLeagueFinanceData } from "../../src/lib/league/leagueFinanceEngine.js";
import { sendDaxoraEmail } from "../notifications/email.js";

function clean(value) {
  return String(value || "").trim();
}

function slug(value = "document") {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "document";
}

function normalisePreparedDelivery(payload = {}) {
  const invoice = payload.invoice && typeof payload.invoice === "object" ? payload.invoice : {};
  const profile = payload.profile && typeof payload.profile === "object" ? payload.profile : {};
  return {
    deliveryId: payload.delivery_id || payload.deliveryId,
    leagueId: payload.league_id || payload.leagueId,
    leagueName: clean(payload.league_name || payload.leagueName || "League"),
    deliveryKind: payload.delivery_kind || payload.deliveryKind || "invoice",
    recipients: Array.isArray(payload.recipients) ? payload.recipients : [],
    invoice,
    profile,
  };
}

function money(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(pence || 0) / 100);
}

export async function deliverLeagueFinanceDocument(preparedInput = {}) {
  const prepared = normalisePreparedDelivery(preparedInput);
  if (!prepared.deliveryId) throw Object.assign(new Error("The finance delivery record is missing."), { code: "FINANCE_DELIVERY_INVALID", status: 400 });
  if (!prepared.invoice?.id) throw Object.assign(new Error("The invoice record is missing."), { code: "FINANCE_INVOICE_MISSING", status: 409 });
  if (!prepared.recipients.length) throw Object.assign(new Error("The club finance profile has no valid billing recipient."), { code: "FINANCE_RECIPIENT_MISSING", status: 409 });

  const model = normaliseLeagueFinanceData({
    invoices: [prepared.invoice],
    invoice_lines: Array.isArray(prepared.invoice?.lines) ? prepared.invoice.lines : [],
    club_profiles: prepared.profile?.parent_club_id || prepared.profile?.parentClubId ? [prepared.profile] : [],
  });
  const invoice = model.invoices[0];
  const profile = model.clubProfiles[0] || {};
  if (!invoice?.id) throw Object.assign(new Error("The prepared finance delivery could not be normalised."), { code: "FINANCE_DELIVERY_PAYLOAD_INVALID", status: 409 });
  const isReminder = prepared.deliveryKind === "reminder";
  const invoiceHtml = leagueInvoiceToHtml(invoice, { leagueName: prepared.leagueName, profile });
  const dueLabel = invoice.dueOn ? new Date(`${invoice.dueOn}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "the recorded due date";
  const subject = isReminder
    ? `${prepared.leagueName} · payment reminder ${invoice.invoiceNumber}`
    : `${prepared.leagueName} · invoice ${invoice.invoiceNumber}`;
  const intro = isReminder
    ? `<p style="margin:0 0 16px">This is a payment reminder for <strong>${invoice.invoiceNumber}</strong>. The outstanding balance is <strong>${money(invoice.balancePence)}</strong> and payment was due ${dueLabel}.</p>`
    : `<p style="margin:0 0 16px">A league invoice has been issued to <strong>${invoice.parentClubName}</strong>. The balance due is <strong>${money(invoice.balancePence)}</strong>.</p>`;
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#eef2f6;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:680px;margin:0 auto;padding:28px"><div style="background:#07121f;border-radius:18px 18px 0 0;padding:24px;color:white"><div style="font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#6ee7b7">Daxora League Operations</div><h1 style="margin:9px 0 0;font-size:24px">${isReminder ? "Payment reminder" : "League invoice"}</h1></div><div style="background:white;border-radius:0 0 18px 18px;padding:26px;line-height:1.6">${intro}<p style="margin:0 0 16px">Invoice: <strong>${invoice.invoiceNumber}</strong><br>Club: <strong>${invoice.parentClubName}</strong><br>Due: <strong>${dueLabel}</strong></p><p style="margin:0;color:#64748b;font-size:13px">The detailed invoice is attached as an HTML document. It can be opened in a browser and printed or saved as PDF. Please quote the invoice number when paying.</p></div></div></body></html>`;
  const digest = createHash("sha256").update(String(prepared.deliveryId)).digest("hex").slice(0, 24);
  const result = await sendDaxoraEmail({
    to: prepared.recipients,
    subject,
    html,
    attachments: [{ filename: `${slug(invoice.invoiceNumber)}.html`, content: invoiceHtml, contentType: "text/html; charset=utf-8" }],
    idempotencyKey: `daxora-finance-${prepared.deliveryId}`,
    tags: { product: "league-manager", finance: prepared.deliveryKind, delivery: digest },
  });
  return { ...result, deliveryId: prepared.deliveryId, invoiceNumber: invoice.invoiceNumber, deliveryKind: prepared.deliveryKind };
}
