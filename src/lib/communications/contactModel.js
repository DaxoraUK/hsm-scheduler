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
  };
}

export function alignTeamContacts(teamCfg = [], contacts = []) {
  const rows = Array.isArray(teamCfg) ? teamCfg : [];
  const contactRows = Array.isArray(contacts) ? contacts : [];
  const byKey = new Map(contactRows.map((contact, index) => {
    const normalised = normaliseTeamContact(contact, {}, index);
    return [normalised.teamKey, normalised];
  }));
  const byName = new Map(contactRows.map((contact, index) => {
    const normalised = normaliseTeamContact(contact, {}, index);
    return [normaliseTeamKey(normalised.teamName), normalised];
  }));

  return rows.map((team, index) => {
    const teamKey = getTeamContactKey(team, index);
    const existing = byKey.get(teamKey) || byName.get(normaliseTeamKey(team.name || team.teamName));
    return normaliseTeamContact(existing || {}, team, index);
  });
}

export function alignTeamContactsForEditing(teamCfg = [], contacts = []) {
  const rows = Array.isArray(teamCfg) ? teamCfg : [];
  const contactRows = Array.isArray(contacts) ? contacts : [];
  const byKey = new Map(contactRows.map((contact, index) => {
    const normalised = normaliseEditableTeamContact(contact, {}, index);
    return [normalised.teamKey, normalised];
  }));
  const byName = new Map(contactRows.map((contact, index) => {
    const normalised = normaliseEditableTeamContact(contact, {}, index);
    return [normaliseTeamKey(normalised.teamName), normalised];
  }));

  return rows.map((team, index) => {
    const teamKey = getTeamContactKey(team, index);
    const existing = byKey.get(teamKey) || byName.get(normaliseTeamKey(team.name || team.teamName));
    return normaliseEditableTeamContact(existing || {}, team, index);
  });
}

export function contactForTeam(teamCfg = [], contacts = [], teamName = "", index = 0) {
  const needle = normaliseTeamKey(teamName);
  const rows = alignTeamContacts(teamCfg, contacts);
  return rows.find((contact) => {
    const contactName = normaliseTeamKey(contact.teamName);
    return contactName === needle || contactName.includes(needle) || needle.includes(contactName);
  }) || normaliseTeamContact({}, { name: teamName }, index);
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
