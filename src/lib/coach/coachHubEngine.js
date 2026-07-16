const REQUEST_TYPES = Object.freeze([
  { value: "training", label: "Training", description: "Regular, pre-season or winter training" },
  { value: "friendly", label: "Friendly", description: "Internal or external friendly fixture" },
  { value: "change", label: "Booking change", description: "Request a different pitch, date or time" },
  { value: "cancellation", label: "Cancellation", description: "Ask the club to cancel a confirmed booking" },
  { value: "camp", label: "Camp or clinic", description: "One-off development event" },
  { value: "tournament", label: "Tournament", description: "Tournament or festival booking" },
]);

const REQUEST_STATUS_LABELS = Object.freeze({
  draft: "Draft",
  submitted: "Submitted",
  needs_information: "More information needed",
  alternative_offered: "Alternative offered",
  accepted: "Alternative accepted",
  approved: "Approved",
  rejected: "Declined",
  declined: "Alternative declined",
  cancelled: "Cancelled",
});

function text(value) {
  return String(value ?? "").trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
}

export function dateKey(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return text(value).slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function timeKey(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return text(value).slice(11, 16);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function localIso(date, time) {
  if (!date || !time) return "";
  const result = new Date(`${date}T${time}:00`);
  return Number.isNaN(result.getTime()) ? "" : result.toISOString();
}

export function normaliseCoachPerson(row = {}) {
  return {
    id: text(row.id),
    clubId: text(row.club_id || row.clubId),
    displayName: text(row.display_name || row.displayName),
    email: text(row.email).toLowerCase(),
    mobile: text(row.mobile),
    preferredChannel: text(row.preferred_channel || row.preferredChannel || "email").toLowerCase(),
    userId: text(row.user_id || row.userId),
    status: text(row.status || "active"),
    verificationStatus: text(row.verification_status || row.verificationStatus || (row.last_verified_at || row.lastVerifiedAt ? "verified" : "unverified")),
    lastVerifiedAt: row.last_verified_at || row.lastVerifiedAt || null,
    verificationDueAt: row.verification_due_at || row.verificationDueAt || null,
    replacementRequestedAt: row.replacement_requested_at || row.replacementRequestedAt || null,
  };
}

export function normaliseCoachAssignment(row = {}) {
  return {
    id: text(row.id),
    clubId: text(row.club_id || row.clubId),
    personId: text(row.person_id || row.personId),
    teamKey: text(row.team_key || row.teamKey),
    teamName: text(row.team_name || row.teamName),
    staffRole: text(row.staff_role || row.staffRole || "coach"),
    sourceSlot: text(row.source_slot || row.sourceSlot || "manual"),
    isPrimary: bool(row.is_primary ?? row.isPrimary),
    canRequestTraining: bool(row.can_request_training ?? row.canRequestTraining, true),
    canRequestFriendlies: bool(row.can_request_friendlies ?? row.canRequestFriendlies, true),
    canRequestChanges: bool(row.can_request_changes ?? row.canRequestChanges, true),
    canViewTeamContacts: bool(row.can_view_team_contacts ?? row.canViewTeamContacts, true),
    canViewCosts: bool(row.can_view_costs ?? row.canViewCosts),
    status: text(row.status || "active"),
  };
}

export function normaliseCoachBooking(row = {}) {
  const startAt = row.start_at || row.startAt || row.preferred_start_at || row.preferredStartAt || null;
  const endAt = row.end_at || row.endAt || row.preferred_end_at || row.preferredEndAt || null;
  return {
    id: text(row.id),
    title: text(row.title || "Team booking"),
    bookingType: text(row.booking_type || row.bookingType || "training"),
    status: text(row.status || "provisional"),
    teamKey: text(row.team_key || row.teamKey),
    teamName: text(row.team_name || row.teamName),
    opponentName: text(row.opponent_name || row.opponentName),
    venueId: text(row.venue_id || row.venueId),
    venueName: text(row.venue_name || row.venueName),
    pitchId: text(row.pitch_id || row.pitchId),
    pitchName: text(row.pitch_name || row.pitchName),
    startAt,
    endAt,
    startDate: dateKey(startAt),
    startTime: timeKey(startAt),
    endTime: timeKey(endAt),
    bookingReference: text(row.booking_reference || row.bookingReference),
    notes: text(row.notes),
  };
}

export function normaliseCoachRequest(row = {}) {
  const preferredStartAt = row.preferred_start_at || row.preferredStartAt || null;
  const preferredEndAt = row.preferred_end_at || row.preferredEndAt || null;
  const proposedStartAt = row.proposed_start_at || row.proposedStartAt || null;
  const proposedEndAt = row.proposed_end_at || row.proposedEndAt || null;
  return {
    id: text(row.id),
    personId: text(row.person_id || row.personId),
    assignmentId: text(row.assignment_id || row.assignmentId),
    targetBookingId: text(row.target_booking_id || row.targetBookingId),
    requestType: text(row.request_type || row.requestType || "training"),
    status: text(row.status || "submitted"),
    title: text(row.title || "Booking request"),
    teamKey: text(row.team_key || row.teamKey),
    teamName: text(row.team_name || row.teamName),
    opponentName: text(row.opponent_name || row.opponentName),
    format: text(row.format),
    preferredVenueId: text(row.preferred_venue_id || row.preferredVenueId),
    preferredVenueName: text(row.preferred_venue_name || row.preferredVenueName),
    preferredPitchId: text(row.preferred_pitch_id || row.preferredPitchId),
    preferredPitchName: text(row.preferred_pitch_name || row.preferredPitchName),
    preferredStartAt,
    preferredEndAt,
    preferredDate: dateKey(preferredStartAt),
    preferredStartTime: timeKey(preferredStartAt),
    preferredEndTime: timeKey(preferredEndAt),
    recurrence: text(row.recurrence || "none"),
    recurrenceUntil: row.recurrence_until || row.recurrenceUntil || null,
    exceptionDates: Array.isArray(row.exception_dates || row.exceptionDates) ? (row.exception_dates || row.exceptionDates).map(dateKey).filter(Boolean) : [],
    holidayPolicy: text(row.holiday_policy || row.holidayPolicy || "include"),
    lastMessageAt: row.last_message_at || row.lastMessageAt || null,
    estimatedAttendance: number(row.estimated_attendance ?? row.estimatedAttendance),
    refereeRequired: bool(row.referee_required ?? row.refereeRequired),
    changingRoomsRequired: bool(row.changing_rooms_required ?? row.changingRoomsRequired),
    coachNotes: text(row.coach_notes || row.coachNotes),
    adminNotes: text(row.admin_notes || row.adminNotes),
    conflicts: Array.isArray(row.conflict_summary || row.conflictSummary) ? (row.conflict_summary || row.conflictSummary) : [],
    proposedVenueId: text(row.proposed_venue_id || row.proposedVenueId),
    proposedVenueName: text(row.proposed_venue_name || row.proposedVenueName),
    proposedPitchId: text(row.proposed_pitch_id || row.proposedPitchId),
    proposedPitchName: text(row.proposed_pitch_name || row.proposedPitchName),
    proposedStartAt,
    proposedEndAt,
    proposedDate: dateKey(proposedStartAt),
    proposedStartTime: timeKey(proposedStartAt),
    proposedEndTime: timeKey(proposedEndAt),
    proposedMessage: text(row.proposed_message || row.proposedMessage),
    resultingBookingId: text(row.resulting_booking_id || row.resultingBookingId),
    reviewedAt: row.reviewed_at || row.reviewedAt || null,
    createdAt: row.created_at || row.createdAt || null,
  };
}

export function normaliseCoachMessage(row = {}) {
  return {
    id: text(row.id),
    personId: text(row.person_id || row.personId),
    teamKey: text(row.team_key || row.teamKey),
    messageType: text(row.message_type || row.messageType || "information"),
    title: text(row.title || "Club update"),
    body: text(row.body),
    relatedType: text(row.related_type || row.relatedType),
    relatedId: text(row.related_id || row.relatedId),
    actionUrl: text(row.action_url || row.actionUrl),
    requiresAcknowledgement: bool(row.requires_acknowledgement ?? row.requiresAcknowledgement),
    readAt: row.read_at || row.readAt || null,
    acknowledgedAt: row.acknowledged_at || row.acknowledgedAt || null,
    createdAt: row.created_at || row.createdAt || null,
  };
}

export function normaliseCoachHubWorkspace(payload = {}) {
  const assignments = (Array.isArray(payload.assignments) ? payload.assignments : []).map(normaliseCoachAssignment);
  const assignmentKeys = new Set(assignments.map((row) => row.teamKey));
  return {
    club: payload.club && typeof payload.club === "object" ? payload.club : {},
    person: normaliseCoachPerson(payload.person || {}),
    assignments,
    bookings: (Array.isArray(payload.bookings) ? payload.bookings : []).map(normaliseCoachBooking).filter((row) => !row.teamKey || assignmentKeys.has(row.teamKey)),
    requests: (Array.isArray(payload.requests) ? payload.requests : []).map(normaliseCoachRequest),
    messages: (Array.isArray(payload.messages) ? payload.messages : []).map(normaliseCoachMessage),
    teamContacts: Array.isArray(payload.team_contacts || payload.teamContacts) ? (payload.team_contacts || payload.teamContacts) : [],
  };
}

export function buildCoachHubMetrics(workspace = {}, now = new Date()) {
  const bookings = Array.isArray(workspace.bookings) ? workspace.bookings : [];
  const requests = Array.isArray(workspace.requests) ? workspace.requests : [];
  const messages = Array.isArray(workspace.messages) ? workspace.messages : [];
  const nowMs = now.getTime();
  const futureBookings = bookings.filter((row) => new Date(row.endAt || row.startAt).getTime() >= nowMs).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  return {
    nextBooking: futureBookings[0] || null,
    upcomingCount: futureBookings.length,
    pendingRequests: requests.filter((row) => ["submitted", "needs_information", "alternative_offered"].includes(row.status)).length,
    alternatives: requests.filter((row) => row.status === "alternative_offered").length,
    unreadMessages: messages.filter((row) => !row.readAt).length,
    acknowledgements: messages.filter((row) => row.requiresAcknowledgement && !row.acknowledgedAt).length,
  };
}

export function buildRequestPayload(draft = {}) {
  const startAt = localIso(draft.date, draft.startTime);
  const endAt = localIso(draft.date, draft.endTime);
  return {
    assignment_id: text(draft.assignmentId),
    target_booking_id: text(draft.targetBookingId) || null,
    request_type: text(draft.requestType || "training"),
    title: text(draft.title || "Booking request"),
    opponent_name: text(draft.opponentName) || null,
    format: text(draft.format) || null,
    preferred_venue_id: text(draft.venueId) || null,
    preferred_venue_name: text(draft.venueName) || null,
    preferred_pitch_id: text(draft.pitchId) || null,
    preferred_pitch_name: text(draft.pitchName) || null,
    preferred_start_at: startAt,
    preferred_end_at: endAt,
    recurrence: text(draft.recurrence || "none"),
    recurrence_until: draft.recurrence !== "none" ? draft.recurrenceUntil || draft.date : null,
    exception_dates: [...new Set((Array.isArray(draft.exceptionDates) ? draft.exceptionDates : text(draft.exceptionDatesText).split(/[\s,;]+/g)).map(dateKey).filter(Boolean))].sort(),
    holiday_policy: text(draft.holidayPolicy || "include"),
    estimated_attendance: number(draft.estimatedAttendance) || null,
    referee_required: bool(draft.refereeRequired),
    changing_rooms_required: bool(draft.changingRoomsRequired),
    coach_notes: text(draft.notes) || null,
    allow_advisory_submission: bool(draft.allowAdvisorySubmission),
  };
}

export function buildBlankCoachRequest(assignment = {}, date = new Date()) {
  const dateValue = dateKey(date);
  return {
    assignmentId: assignment.id || "",
    targetBookingId: "",
    requestType: assignment.canRequestTraining ? "training" : "friendly",
    title: assignment.teamName ? `${assignment.teamName} training` : "Training session",
    opponentName: "",
    format: "",
    venueId: "",
    venueName: "",
    pitchId: "",
    pitchName: "",
    date: dateValue,
    startTime: "18:00",
    endTime: "19:30",
    recurrence: "none",
    recurrenceUntil: dateValue,
    exceptionDates: [],
    exceptionDatesText: "",
    holidayPolicy: "include",
    estimatedAttendance: "",
    refereeRequired: false,
    changingRoomsRequired: false,
    notes: "",
    allowAdvisorySubmission: false,
  };
}

export function requestTypeOptions(assignment = {}) {
  return REQUEST_TYPES.filter((option) => {
    if (["training", "camp", "tournament"].includes(option.value)) return assignment.canRequestTraining !== false;
    if (option.value === "friendly") return assignment.canRequestFriendlies !== false;
    if (["change", "cancellation"].includes(option.value)) return assignment.canRequestChanges !== false;
    return true;
  });
}

export function requestStatusLabel(status) {
  return REQUEST_STATUS_LABELS[text(status)] || text(status || "Submitted").replaceAll("_", " ");
}

export function invitationStatusForPerson(personId, invitations = []) {
  const rows = (Array.isArray(invitations) ? invitations : []).filter((row) => text(row.person_id || row.personId) === text(personId));
  const accepted = rows.find((row) => text(row.status) === "accepted");
  if (accepted) return "accepted";
  const pending = rows.find((row) => text(row.status) === "pending");
  if (pending) return "pending";
  const failed = rows.find((row) => text(row.status) === "delivery_failed");
  if (failed) return "delivery_failed";
  return "not_invited";
}

export function coachInvitationUrl(token, baseUrl = typeof window !== "undefined" ? window.location.origin : "") {
  const base = String(baseUrl || "").replace(/\/$/, "");
  return `${base}/?coach_invite=${encodeURIComponent(text(token))}`;
}

export function buildCoachHubIcsUrl(token, baseUrl = typeof window !== "undefined" ? window.location.origin : "") {
  const base = String(baseUrl || "").replace(/\/$/, "");
  return `${base}/api/coach/calendar?token=${encodeURIComponent(text(token))}`;
}

export { REQUEST_TYPES, REQUEST_STATUS_LABELS };
