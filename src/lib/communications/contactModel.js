const CONTACT_FIELDS = Object.freeze([
  "managerName",
  "managerPhone",
  "managerEmail",
  "coachName",
  "coachPhone",
  "coachEmail",
  "communicationChannel",
  "assistantName",
  "assistantPhone",
  "assistantEmail",
  "assistantEnabled",
  "receiveMatchdayMessages",
  "privacyNoticeProvidedAt",
  "contactLastVerifiedAt",
]);

function text(value) {
  return String(value || "").trim();
}

function editableText(value) {
  return value == null ? "" : String(value);
}

function normaliseAdditionalContact(contact = {}) {
  const channel = text(contact.preferredChannel || contact.preferred_channel || "email").toLowerCase();
  return {
    personId: text(contact.personId || contact.person_id),
    assignmentId: text(contact.assignmentId || contact.assignment_id),
    name: text(contact.name || contact.displayName || contact.display_name),
    email: text(contact.email).toLowerCase(),
    mobile: text(contact.mobile || contact.phone),
    preferredChannel: ["whatsapp", "sms", "email", "in_app"].includes(channel) ? channel : "email",
    staffRole: text(contact.staffRole || contact.staff_role || "coach"),
    isPrimary: Boolean(contact.isPrimary ?? contact.is_primary),
  };
}

function additionalContacts(contact = {}) {
  const rows = contact.additionalContacts || contact.additional_contacts || [];
  return (Array.isArray(rows) ? rows : []).map(normaliseAdditionalContact).filter((row) => row.name || row.email || row.mobile);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null) ?? "";
}

export function normaliseTeamKey(value, fallback = "") {
  const raw = text(value || fallback).toLowerCase();
  const key = raw
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return key || `team-${Math.random().toString(36).slice(2, 10)}`;
}

export function getTeamContactKey(team = {}, index = 0) {
  return text(team.id || team.teamId || team.key) || normaliseTeamKey(team.name || team.teamName, `team-${index + 1}`);
}

// Read-only directory display for Coach Hub and Settings summaries. Directory
// records are authoritative; legacy slots remain available for older clubs.
export function teamContactDirectoryRows(contact = {}) {
  const record = normaliseTeamContact(contact);
  const rows = [...record.additionalContacts,
    { name: record.coachName, email: record.coachEmail, mobile: record.coachPhone, staffRole: "Primary contact" },
    ...(record.assistantEnabled ? [{ name: record.assistantName, email: record.assistantEmail, mobile: record.assistantPhone, staffRole: "Assistant" }] : []),
  ].filter((row) => row.name || row.email || row.mobile);
  return rows.filter((row, index) => rows.findIndex((candidate) =>
    (row.personId && candidate.personId === row.personId)
    || (row.email && candidate.email === row.email)
    || (row.mobile && candidate.mobile === row.mobile)
    || (!row.personId && !candidate.personId && !row.assignmentId && !candidate.assignmentId
      && !row.email && !row.mobile && !candidate.email && !candidate.mobile && candidate.name === row.name)) === index);
}

// Explicit IDs are opaque. Only name-derived legacy keys may use exact-name
// compatibility, and only when the configured team is unambiguous.
export function resolveTeamContactKey(teams = [], key = "", name = "") {
  const raw = text(key);
  const rows = Array.isArray(teams) ? teams : [];
  const direct = raw && rows.filter((team, index) => getTeamContactKey(team, index) === raw);
  if (direct?.length === 1) return raw;
  const needle = name && normaliseTeamKey(name);
  if (!needle || (raw && normaliseTeamKey(raw) !== needle)) return "";
  const matches = rows.filter((team) => normaliseTeamKey(team.name || team.teamName) === needle);
  return matches.length === 1 ? getTeamContactKey(matches[0], rows.indexOf(matches[0])) : "";
}

export function sameTeamContactReference(key, name, otherKey, otherName, teams = []) {
  if (teams.length) {
    const left = resolveTeamContactKey(teams, key, name);
    const right = resolveTeamContactKey(teams, otherKey, otherName);
    return Boolean(left && right && left === right);
  }
  // Without configuration there is no evidence that a name-like key is not an
  // explicit ID. Fail closed; callers needing legacy aliases supply teamCfg.
  return Boolean(text(key) && text(key) === text(otherKey));
}

export function stripTeamContactFields(team = {}) {
  const next = { ...team };
  CONTACT_FIELDS.forEach((field) => delete next[field]);
  return next;
}

export function stripTeamContactsFromConfig(teamCfg = []) {
  return (Array.isArray(teamCfg) ? teamCfg : []).map(stripTeamContactFields);
}

export function normaliseTeamContact(contact = {}, team = {}, index = 0) {
  const channel = text(contact.preferredChannel || contact.preferred_channel || contact.communicationChannel || team.communicationChannel || "whatsapp").toLowerCase();
  return {
    teamKey: text(contact.teamKey || contact.team_key) || getTeamContactKey(team, index),
    teamName: text(contact.teamName || contact.team_name || team.name || team.teamName),
    coachName: text(contact.coachName || contact.coach_name || contact.managerName || team.managerName || team.coachName),
    coachPhone: text(contact.coachPhone || contact.coach_phone || contact.managerPhone || team.managerPhone || team.coachPhone),
    coachEmail: text(contact.coachEmail || contact.coach_email || contact.managerEmail || team.managerEmail || team.coachEmail).toLowerCase(),
    preferredChannel: ["whatsapp", "sms", "email"].includes(channel) ? channel : "whatsapp",
    assistantName: text(contact.assistantName || contact.assistant_name || team.assistantName),
    assistantPhone: text(contact.assistantPhone || contact.assistant_phone || team.assistantPhone),
    assistantEmail: text(contact.assistantEmail || contact.assistant_email || team.assistantEmail).toLowerCase(),
    assistantEnabled: Boolean(contact.assistantEnabled ?? contact.assistant_enabled ?? team.assistantEnabled),
    receiveMatchdayMessages: contact.receiveMatchdayMessages ?? contact.receive_matchday_messages ?? team.receiveMatchdayMessages ?? true,
    privacyNoticeProvidedAt: contact.privacyNoticeProvidedAt || contact.privacy_notice_provided_at || team.privacyNoticeProvidedAt || null,
    lastVerifiedAt: contact.lastVerifiedAt || contact.last_verified_at || team.contactLastVerifiedAt || null,
    updatedAt: contact.updatedAt || contact.updated_at || null,
    additionalContacts: additionalContacts(contact),
  };
}

export function extractLegacyTeamContacts(teamCfg = []) {
  return (Array.isArray(teamCfg) ? teamCfg : [])
    .map((team, index) => normaliseTeamContact({}, team, index))
    .filter((contact) => contact.coachName || contact.coachPhone || contact.coachEmail || contact.assistantName || contact.assistantPhone || contact.assistantEmail);
}

export function normaliseEditableTeamContact(contact = {}, team = {}, index = 0) {
  const channel = text(firstDefined(
    contact.preferredChannel,
    contact.preferred_channel,
    contact.communicationChannel,
    team.communicationChannel,
    "whatsapp",
  )).toLowerCase();

  return {
    teamKey: text(firstDefined(contact.teamKey, contact.team_key)) || getTeamContactKey(team, index),
    teamName: editableText(firstDefined(contact.teamName, contact.team_name, team.name, team.teamName)),
    coachName: editableText(firstDefined(contact.coachName, contact.coach_name, contact.managerName, team.managerName, team.coachName)),
    coachPhone: editableText(firstDefined(contact.coachPhone, contact.coach_phone, contact.managerPhone, team.managerPhone, team.coachPhone)),
    coachEmail: editableText(firstDefined(contact.coachEmail, contact.coach_email, contact.managerEmail, team.managerEmail, team.coachEmail)),
    preferredChannel: ["whatsapp", "sms", "email"].includes(channel) ? channel : "whatsapp",
    assistantName: editableText(firstDefined(contact.assistantName, contact.assistant_name, team.assistantName)),
    assistantPhone: editableText(firstDefined(contact.assistantPhone, contact.assistant_phone, team.assistantPhone)),
    assistantEmail: editableText(firstDefined(contact.assistantEmail, contact.assistant_email, team.assistantEmail)),
    assistantEnabled: Boolean(contact.assistantEnabled ?? contact.assistant_enabled ?? team.assistantEnabled),
    receiveMatchdayMessages: contact.receiveMatchdayMessages ?? contact.receive_matchday_messages ?? team.receiveMatchdayMessages ?? true,
    privacyNoticeProvidedAt: contact.privacyNoticeProvidedAt || contact.privacy_notice_provided_at || team.privacyNoticeProvidedAt || null,
    lastVerifiedAt: contact.lastVerifiedAt || contact.last_verified_at || team.contactLastVerifiedAt || null,
    updatedAt: contact.updatedAt || contact.updated_at || null,
    additionalContacts: additionalContacts(contact),
  };
}

function alignContacts(teamCfg = [], contacts = [], normalise = normaliseTeamContact) {
  const rows = Array.isArray(teamCfg) ? teamCfg : [];
  const contactRows = Array.isArray(contacts) ? contacts : [];
  return rows.map((team, index) => {
    const teamKey = getTeamContactKey(team, index);
    const matches = contactRows.filter((contact) => resolveTeamContactKey(rows,
      contact.teamKey || contact.team_key, contact.teamName || contact.team_name) === teamKey);
    const existing = matches.find((contact) => text(contact.teamKey || contact.team_key) === teamKey) || matches[0] || {};
    const assigned = new Map();
    matches.flatMap(additionalContacts).forEach((contact) => {
      const identity = contact.assignmentId || `${contact.personId}:${contact.staffRole}:${contact.email}:${contact.mobile}`;
      assigned.set(identity, contact);
    });
    return normalise({ ...existing, teamKey, additionalContacts: [...assigned.values()] }, team, index);
  });
}

export function alignTeamContacts(teamCfg = [], contacts = []) {
  return alignContacts(teamCfg, contacts, normaliseTeamContact);
}

export function alignTeamContactsForEditing(teamCfg = [], contacts = []) {
  return alignContacts(teamCfg, contacts, normaliseEditableTeamContact);
}

export function contactForTeam(teamCfg = [], contacts = [], teamName = "", index = 0, teamKey = "") {
  const needle = normaliseTeamKey(teamName);
  const rows = alignTeamContacts(teamCfg, contacts);
  const resolvedKey = resolveTeamContactKey(teamCfg, teamKey, teamName);
  const keyed = resolvedKey && rows.find((contact) => contact.teamKey === resolvedKey);
  if (teamKey && !resolvedKey) return normaliseTeamContact({}, { name: teamName }, index);
  const exact = needle && rows.filter((contact) => normaliseTeamKey(contact.teamName) === needle);
  if (keyed) return keyed;
  if (exact?.length === 1) return exact[0];
  return normaliseTeamContact({}, { name: teamName }, index);
}

export function maskContactDestination(value = "") {
  const raw = text(value);
  if (!raw) return "Not recorded";
  if (raw.includes("@")) {
    const [local = "", domain = ""] = raw.split("@");
    return `${local.slice(0, 1) || "*"}***@${domain}`;
  }
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "Contact recorded";
}

export const TEAM_CONTACT_FIELDS = CONTACT_FIELDS;
