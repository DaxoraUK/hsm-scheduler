function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value || "").trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function dateKey(value) {
  return clean(value).slice(0, 10);
}

function todayKey(today = new Date()) {
  const date = today instanceof Date ? today : new Date(today);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function normaliseChargeType(row = {}) {
  return {
    id: row.id,
    name: clean(row.name),
    code: clean(row.code),
    category: row.category || "other",
    defaultAmountPence: number(row.default_amount_pence ?? row.defaultAmountPence),
    taxRate: number(row.tax_rate ?? row.taxRate),
    active: row.active !== false,
    notes: clean(row.notes),
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function normaliseInvoiceLine(row = {}) {
  const quantity = Math.max(0, number(row.quantity, 1));
  const unitAmountPence = number(row.unit_amount_pence ?? row.unitAmountPence);
  const taxRate = Math.max(0, number(row.tax_rate ?? row.taxRate));
  const netPence = number(row.net_pence ?? row.netPence, Math.round(quantity * unitAmountPence));
  const taxPence = number(row.tax_pence ?? row.taxPence, Math.round(netPence * taxRate / 100));
  return {
    id: row.id,
    invoiceId: row.invoice_id ?? row.invoiceId,
    chargeTypeId: row.charge_type_id ?? row.chargeTypeId ?? null,
    description: clean(row.description),
    quantity,
    unitAmountPence,
    taxRate,
    netPence,
    taxPence,
    totalPence: number(row.total_pence ?? row.totalPence, netPence + taxPence),
    sourceType: row.source_type ?? row.sourceType ?? null,
    sourceId: row.source_id ?? row.sourceId ?? null,
    sourceLabel: clean(row.source_label ?? row.sourceLabel),
    createdAt: row.created_at ?? row.createdAt ?? null,
  };
}

function normalisePayment(row = {}) {
  return {
    id: row.id,
    invoiceId: row.invoice_id ?? row.invoiceId,
    parentClubId: row.parent_club_id ?? row.parentClubId,
    amountPence: number(row.amount_pence ?? row.amountPence),
    paidOn: dateKey(row.paid_on ?? row.paidOn),
    paymentMethod: row.payment_method ?? row.paymentMethod ?? "bank_transfer",
    reference: clean(row.reference),
    notes: clean(row.notes),
    status: row.status || "received",
    createdAt: row.created_at ?? row.createdAt ?? null,
  };
}

function normaliseCredit(row = {}) {
  return {
    id: row.id,
    invoiceId: row.invoice_id ?? row.invoiceId,
    parentClubId: row.parent_club_id ?? row.parentClubId,
    amountPence: number(row.amount_pence ?? row.amountPence),
    creditOn: dateKey(row.credit_on ?? row.creditOn),
    reason: clean(row.reason),
    reference: clean(row.reference),
    status: row.status || "applied",
    createdAt: row.created_at ?? row.createdAt ?? null,
  };
}

function normaliseExpense(row = {}) {
  return {
    id: row.id,
    seasonId: row.season_id ?? row.seasonId ?? null,
    officialId: row.official_id ?? row.officialId ?? null,
    officialName: clean(row.official_name ?? row.officialName),
    publicationFixtureId: row.publication_fixture_id ?? row.publicationFixtureId ?? null,
    fixtureLabel: clean(row.fixture_label ?? row.fixtureLabel),
    expenseType: row.expense_type ?? row.expenseType ?? "match_fee",
    amountPence: number(row.amount_pence ?? row.amountPence),
    expenseOn: dateKey(row.expense_on ?? row.expenseOn),
    status: row.status || "submitted",
    paymentReference: clean(row.payment_reference ?? row.paymentReference),
    notes: clean(row.notes),
    approvedAt: row.approved_at ?? row.approvedAt ?? null,
    paidAt: row.paid_at ?? row.paidAt ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
  };
}

function normaliseInvoice(row = {}, lines = [], payments = [], credits = [], today = new Date()) {
  const invoiceLines = lines.filter((line) => line.invoiceId === row.id);
  const invoicePayments = payments.filter((payment) => payment.invoiceId === row.id && payment.status !== "reversed");
  const invoiceCredits = credits.filter((credit) => credit.invoiceId === row.id && credit.status !== "void");
  const subtotalPence = number(row.subtotal_pence ?? row.subtotalPence, invoiceLines.reduce((sum, line) => sum + line.netPence, 0));
  const taxPence = number(row.tax_pence ?? row.taxPence, invoiceLines.reduce((sum, line) => sum + line.taxPence, 0));
  const totalPence = number(row.total_pence ?? row.totalPence, subtotalPence + taxPence);
  const paidPence = invoicePayments.reduce((sum, payment) => sum + payment.amountPence, 0);
  const creditedPence = invoiceCredits.reduce((sum, credit) => sum + credit.amountPence, 0);
  const balancePence = Math.max(0, totalPence - paidPence - creditedPence);
  const dueOn = dateKey(row.due_on ?? row.dueOn);
  const status = row.status || "draft";
  const isOverdue = Boolean(dueOn && dueOn < todayKey(today) && balancePence > 0 && !["draft", "void", "paid"].includes(status));
  const effectiveStatus = balancePence === 0 && totalPence > 0 && status !== "void" ? "paid" : isOverdue ? "overdue" : status === "issued" && paidPence > 0 && balancePence > 0 ? "part_paid" : status;

  return {
    id: row.id,
    seasonId: row.season_id ?? row.seasonId ?? null,
    parentClubId: row.parent_club_id ?? row.parentClubId,
    parentClubName: clean(row.parent_club_name ?? row.parentClubName),
    invoiceNumber: clean(row.invoice_number ?? row.invoiceNumber),
    status: effectiveStatus,
    storedStatus: status,
    issueOn: dateKey(row.issue_on ?? row.issueOn),
    dueOn,
    periodLabel: clean(row.period_label ?? row.periodLabel),
    purchaseOrderReference: clean(row.purchase_order_reference ?? row.purchaseOrderReference),
    notes: clean(row.notes),
    subtotalPence,
    taxPence,
    totalPence,
    paidPence,
    creditedPence,
    balancePence,
    isOverdue,
    lines: invoiceLines,
    payments: invoicePayments,
    credits: invoiceCredits,
    issuedAt: row.issued_at ?? row.issuedAt ?? null,
    paidAt: row.paid_at ?? row.paidAt ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

export function normaliseLeagueFinanceData(payload = {}, { today = new Date() } = {}) {
  const chargeTypes = asArray(payload.charge_types ?? payload.chargeTypes).map(normaliseChargeType);
  const lines = asArray(payload.invoice_lines ?? payload.invoiceLines).map(normaliseInvoiceLine);
  const payments = asArray(payload.payments).map(normalisePayment);
  const credits = asArray(payload.credits).map(normaliseCredit);
  const expenses = asArray(payload.expenses).map(normaliseExpense);
  const invoices = asArray(payload.invoices)
    .map((row) => normaliseInvoice(row, lines, payments, credits, today))
    .sort((left, right) => String(right.issueOn || right.createdAt || "").localeCompare(String(left.issueOn || left.createdAt || "")));

  const outstandingInvoices = invoices.filter((invoice) => invoice.balancePence > 0 && !["draft", "void"].includes(invoice.status));
  const overdueInvoices = outstandingInvoices.filter((invoice) => invoice.isOverdue || invoice.status === "overdue");
  const draftInvoices = invoices.filter((invoice) => invoice.status === "draft");
  const pendingExpenses = expenses.filter((expense) => ["submitted", "approved"].includes(expense.status));
  const unpaidExpenses = expenses.filter((expense) => expense.status === "approved" && !expense.paidAt);
  const unbilledFines = asArray(payload.unbilled_fines ?? payload.unbilledFines).map((row) => ({
    id: row.id,
    caseId: row.case_id ?? row.caseId,
    caseReference: clean(row.case_reference ?? row.caseReference),
    parentClubId: row.parent_club_id ?? row.parentClubId,
    parentClubName: clean(row.parent_club_name ?? row.parentClubName),
    subjectLabel: clean(row.subject_label ?? row.subjectLabel),
    amountPence: number(row.amount_pence ?? row.amountPence),
    paymentDueOn: dateKey(row.payment_due_on ?? row.paymentDueOn),
  }));

  const summary = {
    invoiceCount: invoices.length,
    draftInvoices: draftInvoices.length,
    outstandingInvoices: outstandingInvoices.length,
    overdueInvoices: overdueInvoices.length,
    outstandingPence: outstandingInvoices.reduce((sum, invoice) => sum + invoice.balancePence, 0),
    overduePence: overdueInvoices.reduce((sum, invoice) => sum + invoice.balancePence, 0),
    invoicedPence: invoices.filter((invoice) => invoice.status !== "void").reduce((sum, invoice) => sum + invoice.totalPence, 0),
    receivedPence: payments.filter((payment) => payment.status !== "reversed").reduce((sum, payment) => sum + payment.amountPence, 0),
    creditedPence: credits.filter((credit) => credit.status !== "void").reduce((sum, credit) => sum + credit.amountPence, 0),
    pendingExpenses: pendingExpenses.length,
    unpaidExpenses: unpaidExpenses.length,
    unpaidExpensePence: unpaidExpenses.reduce((sum, expense) => sum + expense.amountPence, 0),
    unbilledFines: unbilledFines.length,
    unbilledFinePence: unbilledFines.reduce((sum, fine) => sum + fine.amountPence, 0),
  };

  return {
    access: {
      role: payload.access?.role || "viewer",
      canView: payload.access?.can_view ?? payload.access?.canView ?? false,
      canManage: payload.access?.can_manage ?? payload.access?.canManage ?? false,
      isClubPortal: boolean(payload.access?.is_club_portal ?? payload.access?.isClubPortal),
    },
    chargeTypes,
    invoices,
    invoiceLines: lines,
    payments,
    credits,
    expenses,
    unbilledFines,
    summary: { ...summary, ...(payload.summary || {}) },
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function leagueInvoicesToCsv(data = {}) {
  const model = data.invoices ? data : normaliseLeagueFinanceData(data);
  return csv([
    ["Invoice", "Club", "Status", "Issue date", "Due date", "Subtotal pence", "Tax pence", "Total pence", "Paid pence", "Credits pence", "Balance pence"],
    ...model.invoices.map((invoice) => [
      invoice.invoiceNumber,
      invoice.parentClubName,
      invoice.status,
      invoice.issueOn,
      invoice.dueOn,
      invoice.subtotalPence,
      invoice.taxPence,
      invoice.totalPence,
      invoice.paidPence,
      invoice.creditedPence,
      invoice.balancePence,
    ]),
  ]);
}

export function leaguePaymentsToCsv(data = {}) {
  const model = data.payments ? data : normaliseLeagueFinanceData(data);
  const invoiceById = new Map(model.invoices.map((invoice) => [invoice.id, invoice]));
  return csv([
    ["Paid on", "Invoice", "Club", "Amount pence", "Method", "Reference", "Status", "Notes"],
    ...model.payments.map((payment) => {
      const invoice = invoiceById.get(payment.invoiceId);
      return [payment.paidOn, invoice?.invoiceNumber || "", invoice?.parentClubName || "", payment.amountPence, payment.paymentMethod, payment.reference, payment.status, payment.notes];
    }),
  ]);
}

export function leagueExpensesToCsv(data = {}) {
  const model = data.expenses ? data : normaliseLeagueFinanceData(data);
  return csv([
    ["Expense date", "Official", "Fixture", "Type", "Status", "Amount pence", "Payment reference", "Notes"],
    ...model.expenses.map((expense) => [expense.expenseOn, expense.officialName, expense.fixtureLabel, expense.expenseType, expense.status, expense.amountPence, expense.paymentReference, expense.notes]),
  ]);
}

export function buildClubStatementRows(data = {}, parentClubId = "") {
  const model = data.invoices ? data : normaliseLeagueFinanceData(data);
  const invoices = parentClubId ? model.invoices.filter((invoice) => invoice.parentClubId === parentClubId) : model.invoices;
  return invoices.flatMap((invoice) => {
    const club = { parentClubId: invoice.parentClubId, parentClubName: invoice.parentClubName };
    return [
      { ...club, date: invoice.issueOn, type: "Invoice", reference: invoice.invoiceNumber, description: invoice.periodLabel || "League charges", debitPence: invoice.totalPence, creditPence: 0 },
      ...invoice.payments.map((payment) => ({ ...club, date: payment.paidOn, type: "Payment", reference: payment.reference || invoice.invoiceNumber, description: `${payment.paymentMethod.replaceAll("_", " ")} payment`, debitPence: 0, creditPence: payment.amountPence })),
      ...invoice.credits.map((credit) => ({ ...club, date: credit.creditOn, type: "Credit", reference: credit.reference || invoice.invoiceNumber, description: credit.reason || "Credit adjustment", debitPence: 0, creditPence: credit.amountPence })),
    ];
  }).sort((left, right) => String(left.parentClubName).localeCompare(String(right.parentClubName)) || String(left.date).localeCompare(String(right.date)) || String(left.type).localeCompare(String(right.type)));
}

export function leagueClubStatementToCsv(data = {}, parentClubId = "") {
  const rows = buildClubStatementRows(data, parentClubId);
  if (parentClubId) {
    let balance = 0;
    return csv([
      ["Date", "Type", "Reference", "Description", "Debit pence", "Credit pence", "Running balance pence"],
      ...rows.map((row) => {
        balance += row.debitPence - row.creditPence;
        return [row.date, row.type, row.reference, row.description, row.debitPence, row.creditPence, balance];
      }),
    ]);
  }
  const balances = new Map();
  return csv([
    ["Club", "Date", "Type", "Reference", "Description", "Debit pence", "Credit pence", "Running club balance pence"],
    ...rows.map((row) => {
      const current = balances.get(row.parentClubId) || 0;
      const next = current + row.debitPence - row.creditPence;
      balances.set(row.parentClubId, next);
      return [row.parentClubName, row.date, row.type, row.reference, row.description, row.debitPence, row.creditPence, next];
    }),
  ]);
}

export function moneyPoundsToPence(value) {
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export default normaliseLeagueFinanceData;
