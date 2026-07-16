function text(value) {
  return String(value ?? "").trim();
}

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
}

function dateKey(value) {
  if (!value) return "";
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDateExceptions(value) {
  const values = Array.isArray(value)
    ? value
    : text(value).split(/[\s,;]+/g);
  return [...new Set(values.map(dateKey).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row)))].sort();
}

export function normaliseRequestThreadEntry(row = {}) {
  return Object.freeze({
    id: text(row.id),
    clubId: text(row.club_id || row.clubId),
    requestId: text(row.request_id || row.requestId),
    authorRole: text(row.author_role || row.authorRole || "club").toLowerCase(),
    authorName: text(row.author_name || row.authorName || (row.author_role === "coach" ? "Coach" : "Club")),
    body: text(row.body),
    createdAt: row.created_at || row.createdAt || null,
    readAt: row.read_at || row.readAt || null,
  });
}

export function normaliseContactVerification(row = {}) {
  const status = text(row.verification_status || row.verificationStatus || "unverified").toLowerCase();
  return Object.freeze({
    status: ["verified", "due", "overdue", "replacement_required"].includes(status) ? status : "unverified",
    lastVerifiedAt: row.last_verified_at || row.lastVerifiedAt || null,
    verificationDueAt: row.verification_due_at || row.verificationDueAt || null,
    replacementRequestedAt: row.replacement_requested_at || row.replacementRequestedAt || null,
  });
}

export function normaliseReminder(row = {}) {
  return Object.freeze({
    id: text(row.id),
    bookingId: text(row.booking_id || row.bookingId),
    teamKey: text(row.team_key || row.teamKey),
    reminderType: text(row.reminder_type || row.reminderType || "upcoming"),
    dueAt: row.due_at || row.dueAt || null,
    status: text(row.status || "pending"),
    sentAt: row.sent_at || row.sentAt || null,
    acknowledgedAt: row.acknowledged_at || row.acknowledgedAt || null,
  });
}

export function buildRequestConversation(entries = [], currentRole = "coach") {
  const rows = (Array.isArray(entries) ? entries : [])
    .map(normaliseRequestThreadEntry)
    .filter((row) => row.id && row.body)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return {
    rows,
    unread: rows.filter((row) => row.authorRole !== currentRole && !row.readAt).length,
    lastMessage: rows.at(-1) || null,
    participantCount: new Set(rows.map((row) => `${row.authorRole}:${row.authorName}`)).size,
  };
}

export function buildCoachCommunicationAudience({
  people = [],
  assignments = [],
  teamKeys = [],
  affectedBookings = [],
  affectedPitchIds = [],
  startAt = null,
  endAt = null,
  reason = "Annual Planner update",
} = {}) {
  const explicitTeams = new Set((Array.isArray(teamKeys) ? teamKeys : []).map(text).filter(Boolean));
  const pitchIds = new Set((Array.isArray(affectedPitchIds) ? affectedPitchIds : []).map(text).filter(Boolean));
  const windowStart = startAt ? new Date(startAt).getTime() : Number.NEGATIVE_INFINITY;
  const windowEnd = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY;

  (Array.isArray(affectedBookings) ? affectedBookings : []).forEach((booking) => {
    const bookingStart = new Date(booking.startAt || booking.start_at || 0).getTime();
    const bookingEnd = new Date(booking.endAt || booking.end_at || bookingStart).getTime();
    const pitchMatch = !pitchIds.size || pitchIds.has(text(booking.pitchId || booking.pitch_id));
    const timeMatch = bookingStart < windowEnd && bookingEnd > windowStart;
    if (pitchMatch && timeMatch && text(booking.teamKey || booking.team_key)) {
      explicitTeams.add(text(booking.teamKey || booking.team_key));
    }
  });

  const personById = new Map((Array.isArray(people) ? people : []).map((person) => [text(person.id), person]));
  const recipients = [];
  (Array.isArray(assignments) ? assignments : []).forEach((assignment) => {
    const teamKey = text(assignment.teamKey || assignment.team_key);
    if (!explicitTeams.has(teamKey) || text(assignment.status || "active") !== "active") return;
    const person = personById.get(text(assignment.personId || assignment.person_id));
    if (!person || text(person.status || "active") !== "active") return;
    const email = text(person.email).toLowerCase();
    const mobile = text(person.mobile);
    const preferredChannel = text(person.preferredChannel || person.preferred_channel || "email").toLowerCase();
    const destination = preferredChannel === "email" ? email : mobile;
    recipients.push({
      personId: text(person.id),
      teamKey,
      teamName: text(assignment.teamName || assignment.team_name),
      staffRole: text(assignment.staffRole || assignment.staff_role || "coach"),
      name: text(person.displayName || person.display_name || "Coach"),
      email,
      mobile,
      preferredChannel,
      destination,
      ready: Boolean(destination),
    });
  });

  const unique = [...new Map(recipients.map((row) => [`${row.personId}:${row.teamKey}`, row])).values()]
    .sort((a, b) => `${a.teamName}:${a.name}`.localeCompare(`${b.teamName}:${b.name}`));

  return {
    reason: text(reason) || "Annual Planner update",
    teamKeys: [...explicitTeams].sort(),
    recipients: unique,
    readyCount: unique.filter((row) => row.ready).length,
    missingCount: unique.filter((row) => !row.ready).length,
    generatedAt: new Date().toISOString(),
  };
}

export function buildCoachEngagementMetrics({ people = [], assignments = [], invitations = [], requests = [], messages = [], reminders = [] } = {}) {
  const peopleRows = Array.isArray(people) ? people : [];
  const assignmentRows = Array.isArray(assignments) ? assignments : [];
  const requestRows = Array.isArray(requests) ? requests : [];
  const messageRows = Array.isArray(messages) ? messages : [];
  const reminderRows = Array.isArray(reminders) ? reminders : [];
  const invited = peopleRows.filter((row) => text(row.user_id || row.userId)).length;
  const verified = peopleRows.filter((row) => text(row.verification_status || row.verificationStatus) === "verified" || Boolean(row.last_verified_at || row.lastVerifiedAt)).length;
  const activeAssignments = assignmentRows.filter((row) => text(row.status || "active") === "active").length;
  const requestsResolved = requestRows.filter((row) => ["approved", "accepted", "rejected", "declined", "cancelled"].includes(text(row.status))).length;
  const actionableMessages = messageRows.filter((row) => bool(row.requires_acknowledgement ?? row.requiresAcknowledgement)).length;
  const acknowledgedMessages = messageRows.filter((row) => Boolean(row.acknowledged_at || row.acknowledgedAt)).length;
  const remindersAcknowledged = reminderRows.filter((row) => Boolean(row.acknowledged_at || row.acknowledgedAt)).length;
  return {
    people: peopleRows.length,
    invited,
    inviteCoveragePct: peopleRows.length ? Math.round((invited / peopleRows.length) * 100) : 0,
    verified,
    verificationPct: peopleRows.length ? Math.round((verified / peopleRows.length) * 100) : 0,
    activeAssignments,
    requestCount: requestRows.length,
    requestsResolved,
    requestResolutionPct: requestRows.length ? Math.round((requestsResolved / requestRows.length) * 100) : 0,
    acknowledgementPct: actionableMessages ? Math.round((acknowledgedMessages / actionableMessages) * 100) : 100,
    reminderAcknowledgementPct: reminderRows.length ? Math.round((remindersAcknowledged / reminderRows.length) * 100) : 100,
    pendingInvitations: (Array.isArray(invitations) ? invitations : []).filter((row) => text(row.status) === "pending").length,
  };
}

export function buildAnnualPlannerUtilisation({ bookings = [], pitches = [], rangeStart, rangeEnd, openingHour = 8, closingHour = 22 } = {}) {
  const start = new Date(rangeStart || `${new Date().getFullYear()}-01-01T00:00:00`);
  const end = new Date(rangeEnd || `${new Date().getFullYear() + 1}-01-01T00:00:00`);
  const active = (Array.isArray(bookings) ? bookings : []).filter((booking) => {
    const status = text(booking.status || "confirmed");
    const bookingStart = new Date(booking.startAt || booking.start_at || 0);
    return !["cancelled", "rejected"].includes(status) && bookingStart >= start && bookingStart < end;
  });
  const pitchRows = Array.isArray(pitches) ? pitches : [];
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const potentialMinutes = Math.max(0, pitchRows.length * days * Math.max(1, closingHour - openingHour) * 60);
  const usedMinutes = active.reduce((sum, booking) => {
    const bookingStart = new Date(booking.startAt || booking.start_at || 0).getTime();
    const bookingEnd = new Date(booking.endAt || booking.end_at || bookingStart).getTime();
    return sum + Math.max(0, Math.round((bookingEnd - bookingStart) / 60000));
  }, 0);
  const byPitch = pitchRows.map((pitch) => {
    const id = text(pitch.id);
    const pitchBookings = active.filter((booking) => text(booking.pitchId || booking.pitch_id) === id);
    const minutes = pitchBookings.reduce((sum, booking) => {
      const a = new Date(booking.startAt || booking.start_at || 0).getTime();
      const b = new Date(booking.endAt || booking.end_at || a).getTime();
      return sum + Math.max(0, Math.round((b - a) / 60000));
    }, 0);
    return {
      pitchId: id,
      pitchName: text(pitch.label || pitch.name || id),
      bookings: pitchBookings.length,
      hours: Math.round((minutes / 60) * 10) / 10,
      utilisationPct: potentialMinutes && pitchRows.length ? Math.round((minutes / (potentialMinutes / pitchRows.length)) * 100) : 0,
    };
  }).sort((a, b) => b.hours - a.hours);
  return {
    bookingCount: active.length,
    usedHours: Math.round((usedMinutes / 60) * 10) / 10,
    utilisationPct: potentialMinutes ? Math.min(100, Math.round((usedMinutes / potentialMinutes) * 100)) : 0,
    unusedHours: Math.max(0, Math.round(((potentialMinutes - usedMinutes) / 60) * 10) / 10),
    busiestPitch: byPitch[0] || null,
    byPitch,
  };
}

export function buildBookingCostReconciliation(bookings = []) {
  const rows = (Array.isArray(bookings) ? bookings : []).filter((booking) => !["cancelled", "rejected"].includes(text(booking.status)));
  const plannedPence = rows.reduce((sum, row) => sum + Math.max(0, finite(row.costPence ?? row.cost_pence)), 0);
  const reconciledPence = rows.filter((row) => text(row.financeStatus || row.finance_status) === "reconciled").reduce((sum, row) => sum + Math.max(0, finite(row.costPence ?? row.cost_pence)), 0);
  const unreconciled = rows.filter((row) => finite(row.costPence ?? row.cost_pence) > 0 && text(row.financeStatus || row.finance_status) !== "reconciled");
  return {
    plannedPence,
    reconciledPence,
    outstandingPence: Math.max(0, plannedPence - reconciledPence),
    reconciledPct: plannedPence ? Math.round((reconciledPence / plannedPence) * 100) : 100,
    unreconciledCount: unreconciled.length,
    unreconciled,
  };
}

export function buildPilotRefinementSnapshot({ workspace = {}, pitches = [], rangeStart, rangeEnd } = {}) {
  return {
    engagement: buildCoachEngagementMetrics(workspace),
    utilisation: buildAnnualPlannerUtilisation({ bookings: workspace.bookings, pitches, rangeStart, rangeEnd }),
    finance: buildBookingCostReconciliation(workspace.bookings),
  };
}
