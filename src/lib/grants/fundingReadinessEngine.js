const STATUS_ORDER = Object.freeze({ missing: 0, in_progress: 1, ready: 2, not_applicable: 3 });

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function slugify(value) {
  return String(value || "requirement")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "requirement";
}

function guidance({ why, steps, acceptedEvidence = [], refresh = "Review before every application." }) {
  return { why, steps, acceptedEvidence, refresh };
}

const GUIDANCE_RULES = [
  {
    test: /(legal structure|organisation type|applicant type)/i,
    value: guidance({
      why: "The legal structure determines whether the club can apply, sign a grant agreement, hold assets and meet the funder's governance requirements.",
      steps: [
        "Confirm the exact legal name and structure used by the applicant.",
        "Check the programme accepts that applicant type and whether registration is required.",
        "Make sure the governing document, bank account and accounts use the same organisation name.",
        "Record registration numbers and obtain professional advice before changing structure solely for a grant.",
      ],
      acceptedEvidence: ["Constitution or articles", "Charity or CIC registration", "CASC confirmation", "Companies House record", "Committee confirmation"],
      refresh: "Review before each application and after any incorporation, merger or registration change.",
    }),
  },
  {
    test: /(constitution|governing document|articles|rules of the club)/i,
    value: guidance({
      why: "Funders use the governing document to confirm that the club is properly constituted, not-for-profit and able to enter into the grant agreement.",
      steps: [
        "Locate the latest signed constitution, articles or governing rules.",
        "Check the club name, purpose, dissolution clause and committee powers are current.",
        "Approve any changes through the process stated in the document and keep the meeting minutes.",
        "Upload the final approved copy and record its approval date.",
      ],
      acceptedEvidence: ["Signed constitution", "Articles of association", "CASC or charity governing document", "Approval minutes"],
      refresh: "Review annually and whenever the club changes its legal structure or rules.",
    }),
  },
  {
    test: /(account|financial statement|annual report)/i,
    value: guidance({
      why: "Accounts demonstrate financial control, organisational stability and the club's ability to manage public or charitable money.",
      steps: [
        "Prepare the most recent approved annual accounts or income-and-expenditure statement.",
        "Ensure the period, club name and approval are clear.",
        "Explain any significant deficit, reserve or unusual transaction in the application notes.",
        "Upload the signed or formally approved version.",
      ],
      acceptedEvidence: ["Approved annual accounts", "Income and expenditure statement", "Treasurer's report", "Independent examination report"],
      refresh: "Replace after each financial year and retain earlier years where a funder requests them.",
    }),
  },
  {
    test: /(bank account|bank statement|bank evidence)/i,
    value: guidance({
      why: "The funder needs proof that an account exists in the applicant organisation's name and usually requires more than one authorised signatory.",
      steps: [
        "Use an organisational bank account rather than a personal account.",
        "Download a recent statement showing the account name, sort code and account number.",
        "Redact transactions only when the funder's guidance permits it.",
        "Confirm the required number of unrelated signatories.",
      ],
      acceptedEvidence: ["Recent bank statement", "Bank welcome letter", "Mandate or signatory confirmation"],
      refresh: "Use a statement within the age limit stated by the funder, commonly the last three months.",
    }),
  },
  {
    test: /(safeguarding|child protection)/i,
    value: guidance({
      why: "Clubs working with children or adults at risk must show that safeguarding responsibilities, reporting routes and safer recruitment are understood.",
      steps: [
        "Use the current governing-body safeguarding template as the starting point.",
        "Name the club welfare or safeguarding lead and escalation route.",
        "Confirm DBS, safer recruitment, reporting and training arrangements.",
        "Approve the policy and communicate it to coaches, volunteers and parents.",
      ],
      acceptedEvidence: ["Safeguarding policy", "Welfare officer details", "Safeguarding training records", "DBS process statement"],
      refresh: "Review at least annually and after any governing-body guidance change or incident.",
    }),
  },
  {
    test: /(equality|equity|diversity|inclusion policy)/i,
    value: guidance({
      why: "Funders need assurance that access, decision-making and project delivery will be fair and inclusive.",
      steps: [
        "Adopt an equality, diversity and inclusion policy suitable for the club.",
        "Describe how discrimination, complaints and reasonable adjustments are handled.",
        "Identify practical actions for the proposed project, not only a policy statement.",
        "Approve and publish the policy.",
      ],
      acceptedEvidence: ["Equality and diversity policy", "Inclusion action plan", "Accessibility review", "Committee approval minutes"],
      refresh: "Review annually and alongside each major facility or participation project.",
    }),
  },
  {
    test: /(insurance)/i,
    value: guidance({
      why: "Insurance confirms that the club and proposed activity are protected against the material risks identified by the funder.",
      steps: [
        "Check public liability, employer's liability where relevant, buildings, contents and equipment cover.",
        "Confirm the proposed project and funded assets will be covered.",
        "Request an updated schedule from the insurer when the policy wording is unclear.",
        "Upload the certificate and schedule, not only the payment receipt.",
      ],
      acceptedEvidence: ["Insurance certificate", "Policy schedule", "Insurer confirmation of funded asset cover"],
      refresh: "Replace at every renewal and after material changes to facilities or activities.",
    }),
  },
  {
    test: /(affiliation|accreditation|clubmark|charter standard)/i,
    value: guidance({
      why: "Affiliation or accreditation can be an eligibility condition and demonstrates minimum governance and safeguarding standards.",
      steps: [
        "Confirm the relevant County FA, national association or governing-body affiliation.",
        "Resolve any outstanding fees, sanctions or renewal actions.",
        "Download the current certificate or portal confirmation.",
        "Record the renewal date so it does not expire during assessment.",
      ],
      acceptedEvidence: ["Affiliation certificate", "Governing-body portal confirmation", "Accreditation certificate"],
      refresh: "Replace every season or accreditation cycle.",
    }),
  },
  {
    test: /(tenure|lease|landlord consent|ownership|title|maintenance agreement)/i,
    value: guidance({
      why: "Capital funders need confidence that the club has sufficient control of the site for the required grant-condition or clawback period.",
      steps: [
        "Identify whether the club owns, leases, licenses or informally uses the site.",
        "Check the unexpired term against the funder's minimum tenure requirement.",
        "Obtain written landlord consent for the exact proposed works.",
        "Ask a solicitor or property adviser to resolve breaks, restrictions or unclear repairing obligations.",
      ],
      acceptedEvidence: ["Land Registry title", "Signed lease or licence", "Maintenance agreement", "Landlord consent letter", "Heads of terms"],
      refresh: "Review before every capital application and after any lease variation or ownership change.",
    }),
  },
  {
    test: /(planning|building control|building regulations|regulatory consent|statutory approval)/i,
    value: guidance({
      why: "The project must be deliverable. Missing planning or regulatory consent is a common readiness risk for capital applications.",
      steps: [
        "Ask the local planning authority whether permission is required.",
        "Confirm building regulations, drainage, highways, environmental and licensing requirements.",
        "Prepare drawings and supporting surveys at the level the authority requires.",
        "Upload the decision, exemption confirmation or a realistic consent timetable.",
      ],
      acceptedEvidence: ["Planning decision notice", "Pre-application advice", "Building-control approval", "Lawful development or exemption confirmation", "Consent timetable"],
      refresh: "Update whenever the design, scope or statutory position changes.",
    }),
  },
  {
    test: /(quotation|quote|supplier price|contractor price)/i,
    value: guidance({
      why: "Comparable quotations demonstrate value for money and make the project budget credible.",
      steps: [
        "Write one clear specification so suppliers price the same scope.",
        "Obtain the number of quotations required by the funder, normally from independent suppliers.",
        "Check VAT, delivery, installation, contingency and validity dates.",
        "Explain objectively why the preferred supplier offers best value; lowest price is not always mandatory.",
      ],
      acceptedEvidence: ["Dated supplier quotation", "Tender return", "Procurement comparison", "Single-source justification where permitted"],
      refresh: "Replace expired quotations before submission or award acceptance.",
    }),
  },
  {
    test: /(project budget|cost plan|project costs)/i,
    value: guidance({
      why: "A complete budget shows exactly what the grant will pay for, what the club will contribute and how cost changes will be controlled.",
      steps: [
        "List every eligible and ineligible cost, including VAT and professional fees.",
        "Tie each major budget line to a quotation or cost basis.",
        "Show confirmed and pending partnership funding separately.",
        "Include a justified contingency where the programme permits it.",
      ],
      acceptedEvidence: ["Detailed project budget", "Cost plan", "Funding package table", "Cash-flow forecast"],
      refresh: "Update after every quotation, scope or funding-package change.",
    }),
  },
  {
    test: /(business plan|income plan|sustainability plan)/i,
    value: guidance({
      why: "Funders need confidence that the facility or programme can be operated and maintained after the grant ends.",
      steps: [
        "Set out current activity, demand, management responsibilities and the proposed change.",
        "Forecast income, operating costs, maintenance and replacement reserves.",
        "State the assumptions behind utilisation, pricing and volunteer capacity.",
        "Test a downside scenario and explain how the club will respond.",
      ],
      acceptedEvidence: ["Business plan", "Three-to-five-year financial forecast", "Facility operating plan", "Maintenance reserve policy"],
      refresh: "Review at least annually and after material cost or income changes.",
    }),
  },
  {
    test: /(maintenance plan|grounds workforce plan|six-year maintenance plan)/i,
    value: guidance({
      why: "Facility investment only delivers lasting benefit when routine and specialist maintenance are planned, funded and assigned.",
      steps: [
        "List daily, weekly, seasonal and annual maintenance tasks.",
        "Assign trained people or contractors and identify required machinery or materials.",
        "Budget the full lifecycle cost rather than only the first year.",
        "Record inspections, work completed and future review dates.",
      ],
      acceptedEvidence: ["Maintenance schedule", "PitchPower action plan", "Contractor agreement", "Lifecycle cost plan", "Training certificates"],
      refresh: "Review each season and after pitch assessments, major works or equipment changes.",
    }),
  },
  {
    test: /(pitchpower|pitch power)/i,
    value: guidance({
      why: "PitchPower provides an evidence-based grass-pitch assessment and is a gateway requirement for several Football Foundation routes.",
      steps: [
        "Register the site and complete the required pitch inspection in PitchPower.",
        "Submit accurate measurements, photographs and condition observations.",
        "Review the assessment and prioritised recommendations with the County FA or grounds adviser.",
        "Upload the current assessment and ensure the proposed purchase or work matches its recommendation.",
      ],
      acceptedEvidence: ["PitchPower assessment report", "PitchPower recommendation", "Inspection photographs", "Action plan"],
      refresh: "Repeat at the interval required by the programme and after major works.",
    }),
  },
  {
    test: /(photograph|photo|site drawing|aerial|site plan|drawing|specification|design|feasibility)/i,
    value: guidance({
      why: "Clear visual and technical evidence helps assessors understand the current problem, proposed solution and deliverability.",
      steps: [
        "Take dated photographs from consistent viewpoints showing the issue and wider context.",
        "Mark the project location and access on a site or aerial plan.",
        "Use dimensions, labels and a simple scope note so non-technical assessors can understand the proposal.",
        "For complex projects, obtain proportionate professional design or feasibility advice.",
      ],
      acceptedEvidence: ["Dated photographs", "Annotated site plan", "Drawings", "Specification", "Feasibility study", "Condition survey"],
      refresh: "Update when site conditions or project scope change.",
    }),
  },
  {
    test: /(consultation|letter of support|community support|stakeholder)/i,
    value: guidance({
      why: "Consultation demonstrates that the project responds to evidenced need rather than assumptions made only by the applicant.",
      steps: [
        "Identify users, non-users, neighbours, partners and groups facing barriers.",
        "Ask focused questions about need, access, design and intended outcomes.",
        "Keep response counts, themes, quotations and changes made because of feedback.",
        "Request specific letters of support that explain the partner's role and the need they observe.",
      ],
      acceptedEvidence: ["Survey results", "Consultation report", "Meeting notes", "Letters of support", "Partner commitment letters"],
      refresh: "Refresh when the project changes or consultation becomes too old to represent current need.",
    }),
  },
  {
    test: /(beneficiar|participant|attendance|registered player|target group)/i,
    value: guidance({
      why: "Funders need a defensible estimate of who will benefit, how often and whether priority groups will gain meaningful access.",
      steps: [
        "Count unique people separately from sessions or fixture opportunities.",
        "Define age, gender and inclusion categories only where data is collected lawfully and consistently.",
        "Separate current beneficiaries from additional beneficiaries expected because of the project.",
        "Record the calculation method and avoid double counting.",
      ],
      acceptedEvidence: ["Registration totals", "Attendance records", "Team census", "Waiting-list evidence", "Beneficiary calculation note"],
      refresh: "Update each season and create a dated baseline before project delivery.",
    }),
  },
  {
    test: /(outcome|monitoring|evaluation|baseline|impact)/i,
    value: guidance({
      why: "A credible monitoring plan connects the identified need to measurable changes the project is expected to deliver.",
      steps: [
        "Define a small number of specific outcomes rather than only activities purchased.",
        "Choose baseline measures, targets, data owners and reporting dates.",
        "Use the same definitions before and after delivery.",
        "Explain limitations and combine operational figures with appropriate qualitative evidence.",
      ],
      acceptedEvidence: ["Monitoring and evaluation plan", "Baseline snapshot", "Outcome framework", "Target table", "Post-project review plan"],
      refresh: "Lock the baseline before delivery and review progress at agreed milestones.",
    }),
  },
  {
    test: /(partnership funding|match funding|club contribution)/i,
    value: guidance({
      why: "Many programmes require the applicant to demonstrate that the remaining project cost is secured or realistically achievable.",
      steps: [
        "List cash, confirmed grants, fundraising and eligible in-kind contributions separately.",
        "Obtain written confirmation for committed external funding.",
        "Do not count the same contribution against more than one funding gap.",
        "Prepare a contingency if a pending contribution is not secured.",
      ],
      acceptedEvidence: ["Bank balance evidence", "Award letter", "Pledge or sponsorship letter", "Fundraising plan", "Funding package table"],
      refresh: "Update whenever a contribution is confirmed, rejected or changes value.",
    }),
  },
  {
    test: /(energy audit|energy|solar|led|heating|environment|sustainability)/i,
    value: guidance({
      why: "Environmental applications need a quantified baseline and a credible estimate of financial and carbon benefits.",
      steps: [
        "Collect at least 12 months of energy or fuel bills where possible.",
        "Record opening hours, equipment and known inefficiencies.",
        "Obtain a survey or supplier calculation covering savings, assumptions and payback.",
        "Explain how savings will be monitored after installation.",
      ],
      acceptedEvidence: ["Energy bills", "Energy audit", "Installer calculation", "Carbon-saving estimate", "Monitoring plan"],
      refresh: "Refresh calculations when tariffs, design or equipment specifications change.",
    }),
  },
  {
    test: /(certificate|qualification|training record|gma level)/i,
    value: guidance({
      why: "Training and qualification evidence demonstrates that the club has people capable of delivering and sustaining the funded activity safely.",
      steps: [
        "Identify the specific qualification or training standard required.",
        "Check certificate holder, level, awarding body and expiry date.",
        "Book missing training and record the completion plan.",
        "Upload certificates and maintain a renewal register.",
      ],
      acceptedEvidence: ["Training certificate", "Qualification record", "Course booking confirmation", "Workforce development plan"],
      refresh: "Track expiry and renewal dates continuously.",
    }),
  },
];

const DEFAULT_GUIDANCE = guidance({
  why: "This item appears in the programme guidance and needs explicit evidence before the club can rely on it in an application.",
  steps: [
    "Open the current official programme guidance and find the exact wording for this requirement.",
    "Assign a named owner and target date.",
    "Create or obtain the evidence, checking dates, signatures and organisation names.",
    "Upload the final version and record any limitations or outstanding actions.",
  ],
  acceptedEvidence: ["Official document", "Signed confirmation", "Dated supporting record", "Written explanation where the programme permits it"],
});

export function getFundingRequirementGuidance(title) {
  return GUIDANCE_RULES.find((rule) => rule.test.test(String(title || "")))?.value || DEFAULT_GUIDANCE;
}

export function createRequirementKey(prefix, title) {
  return `${slugify(prefix)}:${slugify(title)}`;
}

function savedStatus(record, fallback) {
  const value = String(record?.status || "").toLowerCase();
  return Object.hasOwn(STATUS_ORDER, value) ? value : fallback;
}

function projectRequirement({ id, title, field, value, detail, guidanceTitle = title }) {
  const ready = String(value ?? "").trim().length > 0;
  return {
    id,
    key: createRequirementKey("project", id),
    category: "Project case",
    title,
    source: "project",
    status: ready ? "ready" : "missing",
    evidence: ready ? String(value).trim() : detail,
    guidance: getFundingRequirementGuidance(guidanceTitle),
    field,
    allowsUpload: false,
    automatic: true,
  };
}

export function buildFundingReadinessChecklist({
  programme = null,
  framework = { requirements: [] },
  project = {},
  requirementRecords = [],
  documents = [],
} = {}) {
  const recordsByKey = new Map(asArray(requirementRecords).map((record) => [record.requirementKey || record.requirement_key, record]));
  const documentsByKey = new Map();
  asArray(documents).forEach((document) => {
    const key = document.requirementKey || document.requirement_key;
    if (!key) return;
    documentsByKey.set(key, [...(documentsByKey.get(key) || []), document]);
  });

  const items = [];

  if (programme) {
    asArray(programme.evidenceRequirementIds).forEach((requirementId) => {
      const frameworkItem = asArray(framework.requirements).find((item) => item.id === requirementId);
      if (!frameworkItem) return;
      const key = createRequirementKey("operational", requirementId);
      const record = recordsByKey.get(key);
      const fallback = frameworkItem.status === "available" ? "ready" : frameworkItem.status === "partial" ? "in_progress" : "missing";
      items.push({
        id: `operational-${requirementId}`,
        key,
        category: "Operational evidence",
        title: frameworkItem.title,
        source: frameworkItem.source,
        status: savedStatus(record, fallback),
        evidence: frameworkItem.evidence,
        nextAction: frameworkItem.nextAction,
        guidance: getFundingRequirementGuidance(`${frameworkItem.title} ${frameworkItem.nextAction}`),
        notes: record?.notes || "",
        dueDate: record?.dueDate || record?.due_date || "",
        documents: documentsByKey.get(key) || [],
        allowsUpload: true,
        automatic: true,
      });
    });

    asArray(programme.eligibilityNotes).forEach((title) => {
      const key = createRequirementKey("eligibility", title);
      const record = recordsByKey.get(key);
      const docs = documentsByKey.get(key) || [];
      items.push({
        id: key,
        key,
        category: "Eligibility",
        title,
        source: "official guidance",
        status: savedStatus(record, docs.length ? "ready" : "missing"),
        evidence: record?.notes || (docs.length ? `${docs.length} supporting document${docs.length === 1 ? "" : "s"} attached.` : "Not yet confirmed."),
        guidance: getFundingRequirementGuidance(title),
        notes: record?.notes || "",
        dueDate: record?.dueDate || record?.due_date || "",
        documents: docs,
        allowsUpload: true,
        automatic: false,
      });
    });

    asArray(programme.manualRequirements).forEach((title) => {
      const key = createRequirementKey("document", title);
      const record = recordsByKey.get(key);
      const docs = documentsByKey.get(key) || [];
      items.push({
        id: key,
        key,
        category: "Documents and evidence",
        title,
        source: "official guidance",
        status: savedStatus(record, docs.length ? "ready" : "missing"),
        evidence: docs.length ? `${docs.length} supporting document${docs.length === 1 ? "" : "s"} attached.` : "No supporting document attached.",
        guidance: getFundingRequirementGuidance(title),
        notes: record?.notes || "",
        dueDate: record?.dueDate || record?.due_date || "",
        documents: docs,
        allowsUpload: true,
        automatic: false,
      });
    });
  }

  const projectItems = [
    projectRequirement({ id: "project-title", title: "Project title", field: "title", value: project.title, detail: "Give the project a clear working title." }),
    projectRequirement({ id: "target-programme", title: "Target funding programme", field: "selectedProgrammeId", value: programme ? `${programme.funder} — ${programme.name}` : project.selectedProgrammeId, detail: "Select the programme whose live criteria should drive this checklist." }),
    projectRequirement({ id: "legal-structure", title: "Applicant legal structure", field: "legalStructure", value: project.legalStructure, detail: "Record the exact organisation type and registered name.", guidanceTitle: "legal structure organisation type" }),
    projectRequirement({ id: "affiliation", title: "Football affiliation or accreditation", field: "affiliation", value: project.affiliation, detail: "Record the current governing-body affiliation or accreditation.", guidanceTitle: "affiliation accreditation" }),
    projectRequirement({ id: "site-tenure", title: "Site tenure and control", field: "tenure", value: project.tenure, detail: "Record ownership, lease or licence details and the unexpired term.", guidanceTitle: "tenure lease landlord consent" }),
    projectRequirement({ id: "project-summary", title: "Project need and proposed solution", field: "summary", value: project.summary, detail: "Explain the problem, who experiences it and what will change.", guidanceTitle: "project plan outcomes" }),
    projectRequirement({ id: "project-budget", title: "Estimated project cost", field: "estimatedCost", value: Number(project.estimatedCost) > 0 ? `£${Number(project.estimatedCost).toLocaleString("en-GB")}` : "", detail: "Enter the full estimated project cost.", guidanceTitle: "project budget quotations" }),
    projectRequirement({ id: "funding-target", title: "Funding request and contribution", field: "targetFunding", value: Number(project.targetFunding) > 0 ? `£${Number(project.targetFunding).toLocaleString("en-GB")}` : "", detail: "Enter the planned funding request and confirm how the balance will be met.", guidanceTitle: "partnership funding club contribution" }),
    projectRequirement({ id: "beneficiaries", title: "Beneficiaries", field: "beneficiaries", value: project.beneficiaries, detail: "Define current and additional beneficiaries without double counting.", guidanceTitle: "beneficiaries participants" }),
    projectRequirement({ id: "outcomes", title: "Measurable outcomes", field: "outcomes", value: project.outcomes, detail: "State the measurable changes the project should deliver.", guidanceTitle: "outcomes monitoring baseline" }),
    projectRequirement({ id: "delivery-plan", title: "Delivery plan", field: "deliveryPlan", value: project.deliveryPlan, detail: "Record milestones, responsibilities, risks and the intended delivery timetable.", guidanceTitle: "project plan delivery milestones" }),
    projectRequirement({ id: "site-postcode", title: "Project location", field: "postcode", value: project.postcode, detail: "Add the project postcode so local and place-based funding can be matched.", guidanceTitle: "site location" }),
  ].map((item) => {
    const record = recordsByKey.get(item.key);
    return {
      ...item,
      status: savedStatus(record, item.status),
      notes: record?.notes || "",
      dueDate: record?.dueDate || record?.due_date || "",
      documents: documentsByKey.get(item.key) || [],
    };
  });
  items.push(...projectItems);

  const deduplicated = [...new Map(items.map((item) => [item.key, item])).values()];
  deduplicated.sort((a, b) => {
    const statusDifference = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDifference) return statusDifference;
    return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
  });

  const included = deduplicated.filter((item) => item.status !== "not_applicable");
  const counts = deduplicated.reduce(
    (result, item) => ({ ...result, [item.status]: (result[item.status] || 0) + 1 }),
    { ready: 0, in_progress: 0, missing: 0, not_applicable: 0 }
  );
  const score = included.length
    ? Math.round(included.reduce((total, item) => total + ({ ready: 100, in_progress: 50, missing: 0 }[item.status] || 0), 0) / included.length)
    : 0;

  const groups = ["Eligibility", "Documents and evidence", "Project case", "Operational evidence"]
    .map((category) => ({ category, items: deduplicated.filter((item) => item.category === category) }))
    .filter((group) => group.items.length);

  return {
    score,
    counts,
    total: deduplicated.length,
    items: deduplicated,
    groups,
    missing: deduplicated.filter((item) => item.status === "missing"),
    inProgress: deduplicated.filter((item) => item.status === "in_progress"),
    ready: deduplicated.filter((item) => item.status === "ready"),
    nextActions: deduplicated.filter((item) => item.status === "missing").slice(0, 5),
  };
}

export default buildFundingReadinessChecklist;
