import { FULL_PITCH_AREA_ID, FULL_PITCH_AREA_LABEL } from "../planning/annualPlannerEngine.js";

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
    pitchAreaId: text(row.pitch_area_id || row.pitchAreaId),
    pitchAreaName: text(row.pitch_area_name || row.pitchAreaName),
    seasonPhase: text(row.season_phase || row.seasonPhase || "regular"),
    siteInventoryId: text(row.site_inventory_id || row.siteInventoryId),
    siteSlotId: text(row.site_slot_id || row.siteSlotId),
    disruptionStatus: text(row.disruption_status || row.disruptionStatus || "none"),
    disruptionReason: text(row.disruption_reason || row.disruptionReason),
    rescheduledBookingId: text(row.rescheduled_booking_id || row.rescheduledBookingId),
    rescheduledFromBookingId: text(row.rescheduled_from_booking_id || row.rescheduledFromBookingId),
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
    proposedPitchAreaId: text(row.proposed_pitch_area_id || row.proposedPitchAreaId),
    proposedPitchAreaName: text(row.proposed_pitch_area_name || row.proposedPitchAreaName),
    seasonPhase: text(row.season_phase || row.seasonPhase || "regular"),
    preferredSiteInventoryId: text(row.preferred_site_inventory_id || row.preferredSiteInventoryId),
    preferredSiteSlotId: text(row.preferred_site_slot_id || row.preferredSiteSlotId),
    proposedSiteInventoryId: text(row.proposed_site_inventory_id || row.proposedSiteInventoryId),
    proposedSiteSlotId: text(row.proposed_site_slot_id || row.proposedSiteSlotId),
    proposedStartAt,
    proposedEndAt,
    proposedDate: dateKey(proposedStartAt),
    proposedStartTime: timeKey(proposedStartAt),
    proposedEndTime: timeKey(proposedEndAt),
    proposedMessage: text(row.proposed_message || row.proposedMessage),
    preferredPitchAreaId: text(row.preferred_pitch_area_id || row.preferredPitchAreaId),
    preferredPitchAreaName: text(row.preferred_pitch_area_name || row.preferredPitchAreaName),
    acceptablePitchIds: Array.isArray(row.acceptable_pitch_ids || row.acceptablePitchIds) ? (row.acceptable_pitch_ids || row.acceptablePitchIds).map(text).filter(Boolean) : [],
    timeFlexible: bool(row.time_flexible ?? row.timeFlexible),
    flexibilityMinutes: Math.max(0, Math.min(240, number(row.flexibility_minutes ?? row.flexibilityMinutes, 0))),
    availabilitySnapshot: row.availability_snapshot && typeof row.availability_snapshot === "object" ? row.availability_snapshot : (row.availabilitySnapshot && typeof row.availabilitySnapshot === "object" ? row.availabilitySnapshot : {}),
    resultingBookingId: text(row.resulting_booking_id || row.resultingBookingId),
    reviewedAt: row.reviewed_at || row.reviewedAt || null,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

export function normaliseAnnualPlannerAlternative(row = {}) {
  const proposedStartAt = row.proposed_start_at || row.proposedStartAt || null;
  const proposedEndAt = row.proposed_end_at || row.proposedEndAt || null;
  const currentStartAt = row.current_start_at || row.currentStartAt || null;
  const currentEndAt = row.current_end_at || row.currentEndAt || null;
  return {
    id: text(row.id),
    clubId: text(row.club_id || row.clubId),
    impactId: text(row.impact_id || row.impactId),
    bookingId: text(row.booking_id || row.bookingId),
    teamKey: text(row.team_key || row.teamKey),
    teamName: text(row.team_name || row.teamName),
    bookingTitle: text(row.booking_title || row.bookingTitle || "Affected booking"),
    bookingType: text(row.booking_type || row.bookingType || "training"),
    status: text(row.status || "offered"),
    message: text(row.message),
    coachResponseMessage: text(row.coach_response_message || row.coachResponseMessage),
    closureTitle: text(row.closure_title || row.closureTitle),
    closureReason: text(row.closure_reason || row.closureReason),
    currentStartAt,
    currentEndAt,
    currentVenueName: text(row.current_venue_name || row.currentVenueName),
    currentPitchName: text(row.current_pitch_name || row.currentPitchName),
    currentPitchAreaName: text(row.current_pitch_area_name || row.currentPitchAreaName),
    proposedStartAt,
    proposedEndAt,
    proposedVenueId: text(row.proposed_venue_id || row.proposedVenueId),
    proposedVenueName: text(row.proposed_venue_name || row.proposedVenueName),
    proposedPitchId: text(row.proposed_pitch_id || row.proposedPitchId),
    proposedPitchName: text(row.proposed_pitch_name || row.proposedPitchName),
    proposedPitchAreaId: text(row.proposed_pitch_area_id || row.proposedPitchAreaId),
    proposedPitchAreaName: text(row.proposed_pitch_area_name || row.proposedPitchAreaName),
    proposedSiteInventoryId: text(row.proposed_site_inventory_id || row.proposedSiteInventoryId),
    proposedSiteSlotId: text(row.proposed_site_slot_id || row.proposedSiteSlotId),
    offeredAt: row.offered_at || row.offeredAt || null,
    respondedAt: row.responded_at || row.respondedAt || null,
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


export function normaliseCoachPitch(row = {}) {
  const data = row?.data && typeof row.data === "object" ? row.data : row;
  const capacity = Math.max(1, Math.min(20, number(data.training_capacity ?? data.trainingCapacity ?? data.max_simultaneous_training ?? data.maxSimultaneousTraining ?? 1) || 1));
  const rawAreas = Array.isArray(data.trainingAreas || data.training_areas) ? (data.trainingAreas || data.training_areas) : [];
  const trainingAreas = rawAreas.map((area, index) => ({
    id: text(area?.id || `area-${index + 1}`),
    label: text(area?.label || area?.name || `Area ${index + 1}`),
  })).filter((area) => area.id && area.label);
  return {
    id: text(data.id || row.id),
    label: text(data.label || data.name || data.id || row.id || "Pitch"),
    siteId: text(data.siteId || data.site_id || data.venueId || data.venue_id),
    siteName: text(data.siteName || data.site_name || data.siteLabel || data.venueName || data.venue_name),
    format: text(data.format),
    surface: text(data.surface || "grass"),
    trainingCapacity: capacity,
    trainingAreas,
    independent: bool(data.independent),
    innerOf: text(data.innerOf || data.inner_of),
  };
}

export function buildCoachRequestDraft(request = {}, assignments = []) {
  const normalised = normaliseCoachRequest(request);
  const assignment = assignments.find((row) => row.id === normalised.assignmentId)
    || assignments.find((row) => row.teamKey === normalised.teamKey)
    || assignments[0]
    || {};
  return {
    requestId: normalised.id,
    assignmentId: assignment.id || normalised.assignmentId || "",
    targetBookingId: normalised.targetBookingId || "",
    requestType: normalised.requestType || "training",
    title: normalised.title || "Booking request",
    opponentName: normalised.opponentName || "",
    format: normalised.format || "",
    venueId: normalised.preferredVenueId || "",
    venueName: normalised.preferredVenueName || "",
    pitchId: normalised.preferredPitchId || "",
    pitchName: normalised.preferredPitchName || "",
    pitchAreaId: normalised.preferredPitchAreaId || "",
    pitchAreaName: normalised.preferredPitchAreaName || "",
    seasonPhase: normalised.seasonPhase || "regular",
    siteInventoryId: normalised.preferredSiteInventoryId || "",
    siteSlotId: normalised.preferredSiteSlotId || "",
    acceptablePitchIds: normalised.acceptablePitchIds || [],
    timeFlexible: normalised.timeFlexible,
    flexibilityMinutes: normalised.flexibilityMinutes || 30,
    date: normalised.preferredDate || dateKey(new Date()),
    startTime: normalised.preferredStartTime || "18:00",
    endTime: normalised.preferredEndTime || "19:30",
    recurrence: normalised.recurrence || "none",
    recurrenceUntil: dateKey(normalised.recurrenceUntil || normalised.preferredDate || new Date()),
    exceptionDates: normalised.exceptionDates || [],
    exceptionDatesText: (normalised.exceptionDates || []).join(", "),
    holidayPolicy: normalised.holidayPolicy || "include",
    estimatedAttendance: normalised.estimatedAttendance || "",
    refereeRequired: normalised.refereeRequired,
    changingRoomsRequired: normalised.changingRoomsRequired,
    notes: normalised.coachNotes || "",
    allowAdvisorySubmission: false,
    originalStatus: normalised.status,
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
    pitches: (Array.isArray(payload.pitches) ? payload.pitches : []).map(normaliseCoachPitch).filter((row) => row.id),
    winterSites: Array.isArray(payload.winter_sites || payload.winterSites) ? (payload.winter_sites || payload.winterSites) : [],
    winterSlots: Array.isArray(payload.winter_slots || payload.winterSlots) ? (payload.winter_slots || payload.winterSlots) : [],
    blackouts: Array.isArray(payload.blackouts) ? payload.blackouts : [],
    pitchClosures: Array.isArray(payload.pitch_closures || payload.pitchClosures) ? (payload.pitch_closures || payload.pitchClosures) : [],
    closureImpacts: Array.isArray(payload.closure_impacts || payload.closureImpacts) ? (payload.closure_impacts || payload.closureImpacts) : [],
    closureAlternatives: (Array.isArray(payload.closure_alternatives || payload.closureAlternatives) ? (payload.closure_alternatives || payload.closureAlternatives) : []).map(normaliseAnnualPlannerAlternative),
  };
}

export function buildCoachHubMetrics(workspace = {}, now = new Date()) {
  const bookings = Array.isArray(workspace.bookings) ? workspace.bookings : [];
  const requests = Array.isArray(workspace.requests) ? workspace.requests : [];
  const messages = Array.isArray(workspace.messages) ? workspace.messages : [];
  const closureAlternatives = Array.isArray(workspace.closureAlternatives) ? workspace.closureAlternatives : [];
  const nowMs = now.getTime();
  const futureBookings = bookings.filter((row) => new Date(row.endAt || row.startAt).getTime() >= nowMs).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  return {
    nextBooking: futureBookings[0] || null,
    upcomingCount: futureBookings.length,
    pendingRequests: requests.filter((row) => ["submitted", "needs_information", "alternative_offered"].includes(row.status)).length + closureAlternatives.filter((row) => row.status === "offered").length,
    alternatives: requests.filter((row) => row.status === "alternative_offered").length + closureAlternatives.filter((row) => row.status === "offered").length,
    unreadMessages: messages.filter((row) => !row.readAt).length,
    acknowledgements: messages.filter((row) => row.requiresAcknowledgement && !row.acknowledgedAt).length,
  };
}

export function buildRequestPayload(draft = {}) {
  const startAt = localIso(draft.date, draft.startTime);
  const endAt = localIso(draft.date, draft.endTime);
  return {
    request_id: text(draft.requestId) || null,
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
    preferred_pitch_area_id: text(draft.pitchAreaId) || null,
    preferred_pitch_area_name: text(draft.pitchAreaName) || null,
    season_phase: text(draft.seasonPhase || "regular"),
    preferred_site_inventory_id: text(draft.siteInventoryId) || null,
    preferred_site_slot_id: text(draft.siteSlotId) || null,
    acceptable_pitch_ids: [...new Set((Array.isArray(draft.acceptablePitchIds) ? draft.acceptablePitchIds : []).map(text).filter(Boolean))],
    time_flexible: bool(draft.timeFlexible),
    flexibility_minutes: bool(draft.timeFlexible) ? Math.max(0, Math.min(240, number(draft.flexibilityMinutes, 30))) : 0,
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
    requestId: "",
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
    pitchAreaId: "",
    pitchAreaName: "",
    seasonPhase: "regular",
    siteInventoryId: "",
    siteSlotId: "",
    acceptablePitchIds: [],
    timeFlexible: false,
    flexibilityMinutes: 30,
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

export { REQUEST_TYPES, REQUEST_STATUS_LABELS, FULL_PITCH_AREA_ID, FULL_PITCH_AREA_LABEL };
