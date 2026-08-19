import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildClubStatementRows,
  leagueClubStatementToCsv,
  leagueExpensesToCsv,
  leagueInvoicesToCsv,
  normaliseLeagueFinanceData,
} from "../../src/lib/league/leagueFinanceEngine.js";
import { buildLeagueCommandCentre } from "../../src/lib/league/leagueCommandCentre.js";

const migration = readFileSync("supabase/migrations/202607150001_league_finance_commercial_administration.sql", "utf8");
const leaguePage = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const financeWorkspace = readFileSync("src/components/league/LeagueFinanceWorkspace.jsx", "utf8");
const clubPortal = readFileSync("src/components/league/LeagueClubPortalPage.jsx", "utf8");
const clubFinance = readFileSync("src/components/league/LeagueClubFinancePanel.jsx", "utf8");
const commandCentre = readFileSync("src/components/league/LeagueCommandCentreWorkspace.jsx", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");

function payload() {
  return {
    access: { role: "finance", can_view: true, can_manage: true },
    charge_types: [{ id: "charge-1", name: "Affiliation fee", code: "AFF", category: "affiliation", default_amount_pence: 10000 }],
    invoices: [
      { id: "inv-1", parent_club_id: "club-1", parent_club_name: "Alpha FC", invoice_number: "L26-0001", status: "issued", issue_on: "2026-06-01", due_on: "2026-06-30" },
      { id: "inv-2", parent_club_id: "club-2", parent_club_name: "Bravo FC", invoice_number: "L26-0002", status: "draft", issue_on: "2026-07-01", due_on: "2026-07-31" },
    ],
    invoice_lines: [
      { id: "line-1", invoice_id: "inv-1", description: "Affiliation fee", quantity: 1, unit_amount_pence: 10000, tax_rate: 0, net_pence: 10000, tax_pence: 0, total_pence: 10000 },
      { id: "line-2", invoice_id: "inv-2", description: "Cup entry", quantity: 2, unit_amount_pence: 2500, tax_rate: 20, net_pence: 5000, tax_pence: 1000, total_pence: 6000 },
    ],
    payments: [{ id: "pay-1", invoice_id: "inv-1", parent_club_id: "club-1", amount_pence: 3000, paid_on: "2026-06-15", payment_method: "bank_transfer", status: "received" }],
    credits: [{ id: "credit-1", invoice_id: "inv-1", parent_club_id: "club-1", amount_pence: 1000, credit_on: "2026-06-20", reason: "Goodwill", status: "applied" }],
    expenses: [{ id: "expense-1", official_name: "Alex Ref", expense_type: "match_fee", amount_pence: 4500, expense_on: "2026-07-10", status: "approved" }],
    unbilled_fines: [{ id: "fine-1", case_reference: "DISC-001", parent_club_id: "club-1", parent_club_name: "Alpha FC", subject_label: "Alpha FC", amount_pence: 7500 }],
  };
}

describe("League Operations v3.9 finance and commercial administration", () => {
  it("calculates invoice balances, overdue queues and club statements", () => {
    const data = normaliseLeagueFinanceData(payload(), { today: "2026-07-15" });
    expect(data.access).toEqual(expect.objectContaining({ role: "finance", canManage: true }));
    expect(data.invoices.find((row) => row.id === "inv-1")).toEqual(expect.objectContaining({ status: "overdue", totalPence: 10000, paidPence: 3000, creditedPence: 1000, balancePence: 6000, isOverdue: true }));
    expect(data.summary).toEqual(expect.objectContaining({ draftInvoices: 1, outstandingInvoices: 1, overdueInvoices: 1, overduePence: 6000, unpaidExpenses: 1, unbilledFines: 1 }));
    expect(buildClubStatementRows(data, "club-1").map((row) => row.type)).toEqual(["Invoice", "Payment", "Credit"]);
    expect(leagueInvoicesToCsv(data)).toContain("L26-0001,Alpha FC,overdue");
    expect(leagueClubStatementToCsv(data, "club-1")).toContain("Running balance pence");
    expect(leagueClubStatementToCsv(data)).toContain("Club,Date,Type");
    expect(leagueClubStatementToCsv(data)).toContain("Alpha FC");
    expect(leagueExpensesToCsv(data)).toContain("Alex Ref");
  });

  it("prioritises overdue balances, unbilled fines and expenses for finance officers", () => {
    const finance = normaliseLeagueFinanceData(payload(), { today: "2026-07-15" });
    const command = buildLeagueCommandCentre({
      role: "finance",
      workspace: { fixtures: [], divisions: [], teams: [], venues: [], cupTies: [] },
      operations: { requirements: [], assignments: [], postponements: [] },
      clubOperations: { publications: [], acknowledgements: [], changeRequests: [] },
      results: { submissions: [], publishedFixtures: [], results: [] },
      finance,
      readiness: { percentage: 100, checks: [] },
      today: "2026-07-15",
    });
    expect(command.roleFocus?.label).toBe("Finance officer focus");
    expect(command.counts).toEqual(expect.objectContaining({ overdueInvoices: 1, outstandingPence: 6000, unbilledFines: 1, unpaidExpenses: 1 }));
    expect(command.actions.slice(0, 3).map((row) => row.id)).toEqual(["finance-overdue-invoices", "finance-unbilled-fines", "finance-unpaid-expenses"]);
  });

  it("ships finance RLS, operator workflows, club statements and role controls", () => {
    ["league_finance_charge_types", "league_finance_invoices", "league_finance_invoice_lines", "league_finance_payments", "league_finance_credits", "league_finance_expenses"].forEach((name) => expect(migration).toContain(name));
    expect(migration).toContain("can_view_league_finance");
    expect(migration).toContain("can_manage_league_finance");
    expect(migration).toContain("get_league_finance_data");
    expect(migration).toContain("get_league_club_finance_data");
    expect(migration).toContain("invoice_league_discipline_fine");
    expect(migration).toContain("Payment cannot exceed the outstanding invoice balance");
    expect(migration).toContain("Credit cannot exceed the outstanding invoice balance");
    expect(migration).toContain("Reverse payments and credits before voiding this invoice");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("'finance','viewer'");

    expect(leaguePage).toContain('"finance", "Finance & commercial"');
    expect(leaguePage).toContain('value="finance"');
    expect(leaguePage).toContain("canViewFinance");
    expect(financeWorkspace).toContain("Finance and commercial administration");
    expect(financeWorkspace).toContain("Invoice register");
    expect(financeWorkspace).toContain("Club statements");
    expect(clubPortal).toContain('["finance", "Finance", ReceiptPoundSterling]');
    expect(clubFinance).toContain("Download statement");
    expect(commandCentre).toContain("getLeagueFinanceData");
    expect(commandCentre).toContain("PGRST202");

    ["getLeagueFinanceData", "getLeagueClubFinanceData", "upsertLeagueFinanceChargeType", "upsertLeagueFinanceInvoice", "updateLeagueFinanceInvoiceStatus", "recordLeagueFinancePayment", "addLeagueFinanceCredit", "invoiceLeagueDisciplineFine", "upsertLeagueFinanceExpense", "updateLeagueFinanceExpenseStatus"].forEach((name) => expect(supabase).toContain(name));
  });
});
