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


function normaliseClubProfile(row = {}) {
  return {
    id: row.id,
    parentClubId: row.parent_club_id ?? row.parentClubId,
    parentClubName: clean(row.parent_club_name ?? row.parentClubName),
    billingEmail: clean(row.billing_email ?? row.billingEmail).toLowerCase(),
    ccEmails: asArray(row.cc_emails ?? row.ccEmails).map((value) => clean(value).toLowerCase()).filter(Boolean),
    accountReference: clean(row.account_reference ?? row.accountReference),
    paymentTermsDays: Math.max(1, number(row.payment_terms_days ?? row.paymentTermsDays, 30)),
    remindersEnabled: row.reminders_enabled ?? row.remindersEnabled ?? true,
    reminderDays: asArray(row.reminder_days ?? row.reminderDays).map((value) => number(value)).filter((value) => Number.isFinite(value)),
    purchaseOrderRequired: boolean(row.purchase_order_required ?? row.purchaseOrderRequired),
    notes: clean(row.notes),
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function normaliseBillingTemplate(row = {}) {
  return {
    id: row.id,
    name: clean(row.name),
    chargeTypeId: row.charge_type_id ?? row.chargeTypeId,
    chargeName: clean(row.charge_name ?? row.chargeName),
    scope: row.scope || "club",
    seasonId: row.season_id ?? row.seasonId ?? null,
    quantity: Math.max(0.001, number(row.quantity, 1)),
    dueDays: Math.max(1, number(row.due_days ?? row.dueDays, 30)),
    active: row.active !== false,
    notes: clean(row.notes),
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function normaliseBillingRun(row = {}) {
  return {
    id: row.id,
    name: clean(row.name),
    status: row.status || "draft",
    seasonId: row.season_id ?? row.seasonId ?? null,
    templateId: row.template_id ?? row.templateId ?? null,
    invoiceCount: number(row.invoice_count ?? row.invoiceCount),
    totalPence: number(row.total_pence ?? row.totalPence),
    issueOn: dateKey(row.issue_on ?? row.issueOn),
    dueOn: dateKey(row.due_on ?? row.dueOn),
    createdAt: row.created_at ?? row.createdAt ?? null,
    completedAt: row.completed_at ?? row.completedAt ?? null,
  };
}

function normaliseDeliveryEvent(row = {}) {
  return {
    id: row.id,
    invoiceId: row.invoice_id ?? row.invoiceId,
    invoiceNumber: clean(row.invoice_number ?? row.invoiceNumber),
    parentClubName: clean(row.parent_club_name ?? row.parentClubName),
    deliveryKind: row.delivery_kind ?? row.deliveryKind ?? "invoice",
    status: row.status || "queued",
    recipients: asArray(row.recipients).map(clean).filter(Boolean),
    provider: clean(row.provider),
    providerReference: clean(row.provider_reference ?? row.providerReference),
    errorMessage: clean(row.error_message ?? row.errorMessage),
    createdAt: row.created_at ?? row.createdAt ?? null,
    completedAt: row.completed_at ?? row.completedAt ?? null,
  };
}

function normalisePaymentImport(row = {}) {
  return {
    id: row.id,
    filename: clean(row.filename),
    status: row.status || "preview",
    rowCount: number(row.row_count ?? row.rowCount),
    matchedCount: number(row.matched_count ?? row.matchedCount),
    appliedCount: number(row.applied_count ?? row.appliedCount),
    totalPence: number(row.total_pence ?? row.totalPence),
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
  const clubProfiles = asArray(payload.club_profiles ?? payload.clubProfiles).map(normaliseClubProfile);
  const billingTemplates = asArray(payload.billing_templates ?? payload.billingTemplates).map(normaliseBillingTemplate);
  const billingRuns = asArray(payload.billing_runs ?? payload.billingRuns).map(normaliseBillingRun);
  const deliveryEvents = asArray(payload.delivery_events ?? payload.deliveryEvents).map(normaliseDeliveryEvent);
  const paymentImports = asArray(payload.payment_imports ?? payload.paymentImports).map(normalisePaymentImport);
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
    clubProfiles,
    billingTemplates,
    billingRuns,
    deliveryEvents,
    paymentImports,
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


function htmlEscape(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function money(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(number(pence) / 100);
}

export function leagueInvoiceToHtml(invoice = {}, { leagueName = "League", profile = {}, generatedAt = new Date() } = {}) {
  const lines = asArray(invoice.lines).map((line) => `<tr><td><strong>${htmlEscape(line.description)}</strong>${line.sourceLabel ? `<div class="muted">${htmlEscape(line.sourceLabel)}</div>` : ""}</td><td class="number">${htmlEscape(line.quantity)}</td><td class="number">${htmlEscape(money(line.unitAmountPence))}</td><td class="number">${htmlEscape(line.taxRate)}%</td><td class="number"><strong>${htmlEscape(money(line.totalPence))}</strong></td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${htmlEscape(invoice.invoiceNumber || "Invoice")}</title><style>*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#0f172a;font-family:Arial,sans-serif}main{max-width:900px;margin:32px auto;background:white;padding:46px;box-shadow:0 20px 55px rgba(15,23,42,.12)}.brand{font-size:12px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#047857}.header{display:flex;justify-content:space-between;gap:24px;padding-bottom:26px;border-bottom:4px solid #10b981}.header h1{font-size:34px;margin:8px 0 0}.right{text-align:right}.meta{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin:28px 0}.panel{padding:18px;border:1px solid #cbd5e1;border-radius:14px}.label{font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#64748b}.value{margin-top:7px;font-size:14px;font-weight:800}.muted{margin-top:4px;color:#64748b;font-size:12px}table{width:100%;border-collapse:collapse;font-size:13px}th{padding:11px;text-align:left;background:#f1f5f9;font-size:10px;letter-spacing:.1em;text-transform:uppercase}td{padding:13px 11px;border-bottom:1px solid #e2e8f0}.number{text-align:right}.totals{margin:24px 0 0 auto;width:340px}.total-row{display:flex;justify-content:space-between;padding:8px 0}.grand{border-top:2px solid #0f172a;margin-top:5px;padding-top:13px;font-size:18px;font-weight:900}.balance{margin-top:15px;padding:15px;border-radius:12px;background:${invoice.balancePence > 0 ? "#fff7ed" : "#ecfdf5"};display:flex;justify-content:space-between;font-weight:900}.footer{margin-top:34px;padding-top:20px;border-top:1px solid #cbd5e1;font-size:11px;color:#64748b;line-height:1.6}@media print{body{background:white}main{margin:0;box-shadow:none;max-width:none;padding:24px}}</style></head><body><main><div class="header"><div><div class="brand">Daxora League Operations</div><h1>Invoice</h1><div class="muted">${htmlEscape(leagueName)}</div></div><div class="right"><div class="label">Invoice number</div><div class="value">${htmlEscape(invoice.invoiceNumber)}</div><div class="label" style="margin-top:14px">Status</div><div class="value">${htmlEscape(String(invoice.status || "draft").replaceAll("_", " "))}</div></div></div><div class="meta"><div class="panel"><div class="label">Bill to</div><div class="value">${htmlEscape(invoice.parentClubName)}</div>${profile.accountReference ? `<div class="muted">Account ${htmlEscape(profile.accountReference)}</div>` : ""}${profile.billingEmail ? `<div class="muted">${htmlEscape(profile.billingEmail)}</div>` : ""}</div><div class="panel"><div class="label">Issue date</div><div class="value">${htmlEscape(invoice.issueOn || "—")}</div><div class="label" style="margin-top:14px">Payment due</div><div class="value">${htmlEscape(invoice.dueOn || "—")}</div></div></div>${invoice.periodLabel ? `<div class="panel" style="margin-bottom:22px"><div class="label">Billing period / description</div><div class="value">${htmlEscape(invoice.periodLabel)}</div></div>` : ""}<table><thead><tr><th>Description</th><th class="number">Qty</th><th class="number">Unit</th><th class="number">Tax</th><th class="number">Total</th></tr></thead><tbody>${lines || '<tr><td colspan="5">No invoice lines.</td></tr>'}</tbody></table><div class="totals"><div class="total-row"><span>Subtotal</span><strong>${htmlEscape(money(invoice.subtotalPence))}</strong></div><div class="total-row"><span>Tax</span><strong>${htmlEscape(money(invoice.taxPence))}</strong></div><div class="total-row grand"><span>Total</span><span>${htmlEscape(money(invoice.totalPence))}</span></div><div class="total-row"><span>Payments and credits</span><strong>−${htmlEscape(money(number(invoice.paidPence) + number(invoice.creditedPence)))}</strong></div><div class="balance"><span>Balance due</span><span>${htmlEscape(money(invoice.balancePence))}</span></div></div>${invoice.notes ? `<div class="panel" style="margin-top:28px"><div class="label">Notes</div><div class="value">${htmlEscape(invoice.notes)}</div></div>` : ""}<div class="footer">Generated by Daxora on ${htmlEscape(new Date(generatedAt).toLocaleString("en-GB"))}. This invoice reflects the league finance records held at that time. Please quote ${htmlEscape(invoice.invoiceNumber)} when paying.</div></main></body></html>`;
}

export function leagueClubStatementToHtml(data = {}, parentClubId = "", { leagueName = "League", profile = {}, generatedAt = new Date() } = {}) {
  const model = data.invoices ? data : normaliseLeagueFinanceData(data);
  const invoices = model.invoices.filter((invoice) => !parentClubId || invoice.parentClubId === parentClubId);
  const rows = buildClubStatementRows(model, parentClubId);
  const clubName = invoices[0]?.parentClubName || profile.parentClubName || "Club";
  let balance = 0;
  const body = rows.map((row) => { balance += row.debitPence - row.creditPence; return `<tr><td>${htmlEscape(row.date)}</td><td>${htmlEscape(row.type)}</td><td>${htmlEscape(row.reference)}</td><td>${htmlEscape(row.description)}</td><td class="number">${row.debitPence ? htmlEscape(money(row.debitPence)) : "—"}</td><td class="number">${row.creditPence ? htmlEscape(money(row.creditPence)) : "—"}</td><td class="number"><strong>${htmlEscape(money(balance))}</strong></td></tr>`; }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${htmlEscape(clubName)} statement</title><style>body{font-family:Arial,sans-serif;color:#0f172a;margin:0}main{max-width:1050px;margin:auto;padding:40px}.brand{font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#047857}.head{border-bottom:4px solid #10b981;padding-bottom:20px}h1{font-size:30px;margin:8px 0 3px}.muted{color:#64748b;font-size:12px}.summary{display:flex;justify-content:space-between;gap:20px;margin:24px 0;padding:18px;border:1px solid #cbd5e1;border-radius:14px}.balance{font-size:26px;font-weight:900}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f1f5f9;text-align:left;text-transform:uppercase;font-size:9px;letter-spacing:.08em}th,td{padding:10px;border-bottom:1px solid #e2e8f0}.number{text-align:right}@media print{main{padding:18px}}</style></head><body><main><div class="head"><div class="brand">Daxora League Operations</div><h1>${htmlEscape(clubName)} account statement</h1><div class="muted">${htmlEscape(leagueName)} · generated ${htmlEscape(new Date(generatedAt).toLocaleString("en-GB"))}</div></div><div class="summary"><div><strong>${htmlEscape(profile.accountReference || clubName)}</strong><div class="muted">${htmlEscape(profile.billingEmail || "League club account")}</div></div><div style="text-align:right"><div class="muted">Balance outstanding</div><div class="balance">${htmlEscape(money(invoices.reduce((sum, invoice) => sum + invoice.balancePence, 0)))}</div></div></div><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th class="number">Debit</th><th class="number">Credit</th><th class="number">Balance</th></tr></thead><tbody>${body || '<tr><td colspan="7">No transactions recorded.</td></tr>'}</tbody></table></main></body></html>`;
}

export function parseFinancePaymentCsv(text = "") {
  const rows = [];
  let current = [], cell = "", quoted = false;
  for (let index = 0; index < String(text).length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { current.push(cell); cell = ""; }
    else if (character === "\n") { current.push(cell.replace(/\r$/, "")); rows.push(current); current = []; cell = ""; }
    else cell += character;
  }
  if (cell || current.length) { current.push(cell.replace(/\r$/, "")); rows.push(current); }
  const headers = asArray(rows.shift()).map((value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  return rows.filter((row) => row.some((value) => clean(value))).map((row, index) => {
    const item = Object.fromEntries(headers.map((header, column) => [header, clean(row[column])]));
    const amountValue = item.amount || item.amount_gbp || item.value || item.credit || "0";
    return { rowNumber: index + 2, date: dateKey(item.date || item.paid_on || item.transaction_date), amountPence: moneyPoundsToPence(amountValue), reference: clean(item.reference || item.payment_reference || item.description), invoiceNumber: clean(item.invoice || item.invoice_number), clubName: clean(item.club || item.club_name || item.payer), raw: item };
  });
}

export function matchFinancePaymentRows(rows = [], invoices = []) {
  return asArray(rows).map((row) => {
    const openInvoices = asArray(invoices).filter((invoice) => invoice.balancePence > 0 && !["draft", "void", "paid"].includes(invoice.status));
    const reference = `${row.invoiceNumber} ${row.reference}`.toLowerCase();
    const direct = openInvoices.filter((invoice) => reference.includes(String(invoice.invoiceNumber || "").toLowerCase()));
    const clubMatches = direct.length ? direct : openInvoices.filter((invoice) => row.clubName && String(invoice.parentClubName || "").toLowerCase().includes(row.clubName.toLowerCase()));
    const amountMatches = clubMatches.filter((invoice) => row.amountPence > 0 && row.amountPence <= invoice.balancePence);
    const candidates = amountMatches.length ? amountMatches : clubMatches;
    return { ...row, matchedInvoiceId: candidates.length === 1 ? candidates[0].id : "", matchedInvoiceNumber: candidates.length === 1 ? candidates[0].invoiceNumber : "", matchStatus: candidates.length === 1 ? "matched" : candidates.length > 1 ? "ambiguous" : "unmatched", candidateInvoiceIds: candidates.map((invoice) => invoice.id) };
  });
}

export default normaliseLeagueFinanceData;
