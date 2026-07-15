import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  leagueInvoiceToHtml,
  leagueClubStatementToHtml,
  matchFinancePaymentRows,
  normaliseLeagueFinanceData,
  parseFinancePaymentCsv,
} from "../../src/lib/league/leagueFinanceEngine.js";

const migration = readFileSync("supabase/migrations/202607150002_league_finance_automation_reconciliation.sql", "utf8");
const automationWorkspace = readFileSync("src/components/league/LeagueFinanceAutomationWorkspace.jsx", "utf8");
const financeWorkspace = readFileSync("src/components/league/LeagueFinanceWorkspace.jsx", "utf8");
const clubFinance = readFileSync("src/components/league/LeagueClubFinancePanel.jsx", "utf8");
const apiRoute = readFileSync("api/league/finance-delivery.js", "utf8");
const serverDelivery = readFileSync("server/finance/delivery.js", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");
const dailyAutomation = readFileSync("api/automation/daily.js", "utf8");

function payload() {
  return {
    access: { role: "finance", can_view: true, can_manage: true },
    invoices: [{
      id: "inv-1",
      parent_club_id: "club-1",
      parent_club_name: "Alpha FC",
      invoice_number: "L26-0042",
      status: "issued",
      issue_on: "2026-07-01",
      due_on: "2026-07-31",
      period_label: "2026/27 affiliation",
      subtotal_pence: 10000,
      tax_pence: 2000,
      total_pence: 12000,
    }],
    invoice_lines: [{
      id: "line-1",
      invoice_id: "inv-1",
      description: "League affiliation",
      quantity: 1,
      unit_amount_pence: 10000,
      tax_rate: 20,
      net_pence: 10000,
      tax_pence: 2000,
      total_pence: 12000,
    }],
    payments: [],
    credits: [],
    club_profiles: [{
      id: "profile-1",
      parent_club_id: "club-1",
      parent_club_name: "Alpha FC",
      billing_email: "treasurer@alpha.example",
      cc_emails: ["secretary@alpha.example"],
      account_reference: "ALPHA-001",
      payment_terms_days: 30,
      reminder_days: [0, 7, 14],
    }],
    billing_templates: [{
      id: "template-1",
      name: "Annual affiliation",
      charge_type_id: "charge-1",
      charge_name: "Affiliation",
      scope: "club",
      quantity: 1,
      due_days: 30,
      active: true,
    }],
    billing_runs: [{ id: "run-1", name: "2026/27 fees", status: "issued", invoice_count: 12, total_pence: 144000 }],
    delivery_events: [{ id: "delivery-1", invoice_id: "inv-1", invoice_number: "L26-0042", parent_club_name: "Alpha FC", delivery_kind: "invoice", status: "delivered", recipients: ["treasurer@alpha.example"] }],
    payment_imports: [{ id: "import-1", filename: "bank.csv", status: "applied", row_count: 3, matched_count: 3, applied_count: 3, total_pence: 36000 }],
  };
}

describe("League Operations v3.9.1 finance automation and reconciliation", () => {
  it("normalises billing profiles, templates, runs, deliveries and payment imports", () => {
    const model = normaliseLeagueFinanceData(payload(), { today: "2026-07-15" });
    expect(model.clubProfiles[0]).toEqual(expect.objectContaining({ parentClubId: "club-1", billingEmail: "treasurer@alpha.example", accountReference: "ALPHA-001", reminderDays: [0, 7, 14] }));
    expect(model.billingTemplates[0]).toEqual(expect.objectContaining({ name: "Annual affiliation", scope: "club", dueDays: 30 }));
    expect(model.billingRuns[0]).toEqual(expect.objectContaining({ invoiceCount: 12, totalPence: 144000 }));
    expect(model.deliveryEvents[0]).toEqual(expect.objectContaining({ deliveryKind: "invoice", status: "delivered" }));
    expect(model.paymentImports[0]).toEqual(expect.objectContaining({ appliedCount: 3, totalPence: 36000 }));
  });

  it("produces branded printable invoice and statement documents", () => {
    const model = normaliseLeagueFinanceData(payload(), { today: "2026-07-15" });
    const invoiceHtml = leagueInvoiceToHtml(model.invoices[0], { leagueName: "Lancashire Test League", profile: model.clubProfiles[0], generatedAt: "2026-07-15T10:00:00Z" });
    expect(invoiceHtml).toContain("Daxora League Operations");
    expect(invoiceHtml).toContain("Lancashire Test League");
    expect(invoiceHtml).toContain("L26-0042");
    expect(invoiceHtml).toContain("Alpha FC");
    expect(invoiceHtml).toContain("£120.00");
    expect(invoiceHtml).toContain("ALPHA-001");

    const statementHtml = leagueClubStatementToHtml(model, "club-1", { leagueName: "Lancashire Test League", profile: model.clubProfiles[0], generatedAt: "2026-07-15T10:00:00Z" });
    expect(statementHtml).toContain("Alpha FC account statement");
    expect(statementHtml).toContain("Balance outstanding");
    expect(statementHtml).toContain("£120.00");
  });

  it("parses common bank CSV headings and matches invoice references safely", () => {
    const model = normaliseLeagueFinanceData(payload(), { today: "2026-07-15" });
    const rows = parseFinancePaymentCsv('date,amount,reference,club\n2026-07-15,120.00,"Payment L26-0042",Alpha FC\n2026-07-15,20.00,Unknown payment,Other FC');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.objectContaining({ amountPence: 12000, reference: "Payment L26-0042", clubName: "Alpha FC" }));
    const matched = matchFinancePaymentRows(rows, model.invoices);
    expect(matched[0]).toEqual(expect.objectContaining({ matchedInvoiceId: "inv-1", matchedInvoiceNumber: "L26-0042", matchStatus: "matched" }));
    expect(matched[1].matchStatus).toBe("unmatched");
  });

  it("ships hardened finance automation tables, forced RLS and controlled RPCs", () => {
    [
      "league_finance_club_profiles",
      "league_finance_billing_templates",
      "league_finance_billing_runs",
      "league_finance_delivery_events",
      "league_finance_payment_imports",
      "league_finance_payment_import_rows",
    ].forEach((name) => expect(migration).toContain(name));
    expect(migration.match(/force row level security/g)?.length).toBeGreaterThanOrEqual(7);
    expect(migration).toContain("create_league_finance_billing_run");
    expect(migration).toContain("apply_league_finance_payment_batch");
    expect(migration).toContain("prepare_league_finance_delivery");
    expect(migration).toContain("claim_due_league_finance_reminders");
    expect(migration).toContain("complete_league_finance_delivery");
    expect(migration).toContain("private.is_service_role()");
    expect(migration).toContain("unique (league_id,idempotency_key)");
    expect(migration).toContain("Payment exceeds the outstanding invoice balance");
    expect(migration).toContain("grant execute on function public.complete_league_finance_delivery");
    expect(migration).toContain("to service_role");
  });

  it("provides bulk billing, payment reconciliation and professional delivery workflows", () => {
    expect(automationWorkspace).toContain("Club billing profiles");
    expect(automationWorkspace).toContain("Bulk seasonal billing");
    expect(automationWorkspace).toContain("Payment reconciliation");
    expect(automationWorkspace).toContain("idempotencyKey");
    expect(automationWorkspace).toContain("Apply payments");
    expect(financeWorkspace).toContain('["automation", "Automation", Sparkles]');
    expect(financeWorkspace).toContain("Email invoice");
    expect(financeWorkspace).toContain("Send reminder");
    expect(financeWorkspace).toContain("Print / save PDF");
    expect(clubFinance).toContain("Print statement");
    expect(clubFinance).toContain("Print / save PDF");
    ["alert(", "confirm(", "prompt("].forEach((nativeCall) => {
      expect(automationWorkspace).not.toContain(nativeCall);
      expect(financeWorkspace).not.toContain(nativeCall);
    });
  });

  it("protects delivery behind authenticated preparation and service-role completion", () => {
    expect(apiRoute).toContain("verifySupabaseUser");
    expect(apiRoute).toContain('userRpc(token, "prepare_league_finance_delivery"');
    expect(apiRoute).toContain('serviceRpc("complete_league_finance_delivery"');
    expect(apiRoute).toContain('methodNotAllowed("POST")');
    expect(serverDelivery).toContain("normaliseLeagueFinanceData");
    expect(serverDelivery).toContain("sendDaxoraEmail");
    expect(serverDelivery).toContain("idempotencyKey");
    expect(dailyAutomation).toContain("claim_due_league_finance_reminders");
    expect(dailyAutomation).toContain("financeRemindersProcessed");
    expect(supabase).toContain("upsertLeagueFinanceClubProfile");
    expect(supabase).toContain("upsertLeagueFinanceBillingTemplate");
    expect(supabase).toContain("createLeagueFinanceBillingRun");
    expect(supabase).toContain("applyLeagueFinancePaymentBatch");
  });
});
