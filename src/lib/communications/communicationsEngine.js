import { cleanName } from "../scheduler.js";
import { contactForTeam } from "./contactModel.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fixtureStatus(fixture = {}, forcedStatus = "") {
  if (forcedStatus) return forcedStatus;
  const value = normalise(fixture.status || fixture.fixtureStatus || fixture.outcome);
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("postpone")) return "postponed";
  if (value.includes("unresolved") || value.includes("unassigned")) return "unresolved";
  return "scheduled";
}

function stableId(fixture = {}, day = "matchday", index = 0) {
  const explicit = fixture.id || fixture.fixtureId || fixture.key || fixture.fullTimeId || fixture.sourceId;
  if (explicit) return `${day}:${String(explicit)}`;
  return [
    day,
    normalise(fixture.homeTeam || fixture.team || fixture.home),
    normalise(fixture.awayTeam || fixture.opponent || fixture.away),
    String(fixture.date || fixture.fixtureDate || ""),
    String(fixture.koTime || fixture.kickOff || fixture.kickoff || fixture.koMins || index),
  ].join(":");
}

function templateKeyForStatus(status) {
  if (status === "postponed") return "fixture_postponed";
  if (status === "cancelled") return "fixture_cancelled";
  if (status === "scheduled") return "fixture_confirmed";
  return "";
}

function renderTemplate(value, tokens = {}) {
  return String(value || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => String(tokens[key] ?? ""));
}

function governedTemplateForStatus(templates, status) {
  const key = templateKeyForStatus(status);
  if (!key) return null;
  return asArray(templates).find((item) => item?.active !== false && item?.templateKey === key) || null;
}

function buildMessage({ status, teamName, opposition, dateLabel, ko, pitch, format, referee, contactName }) {
  const greeting = contactName ? `Hi ${contactName},` : "Hi,";

  if (status === "postponed") {
    return `${greeting}\n\n${teamName}'s fixture against ${opposition} on ${dateLabel} is currently postponed. Please do not travel or make final arrangements until the club confirms the rearranged details.\n\nPlease confirm receipt.`;
  }

  if (status === "cancelled") {
    return `${greeting}\n\n${teamName}'s fixture against ${opposition} on ${dateLabel} has been cancelled. Please make sure players and parents are informed.\n\nPlease confirm receipt.`;
  }

  if (status === "unresolved") {
    return `${greeting}\n\n${teamName}'s home fixture against ${opposition} on ${dateLabel} is still awaiting a confirmed kick-off time and pitch. Please do not circulate final details yet.\n\nThe club will send an update once the allocation is confirmed.`;
  }

  return `${greeting}\n\n${teamName} are at home on ${dateLabel}.\n\nOpposition: ${opposition}\nKick-off: ${ko}\nPitch: ${pitch}\nFormat: ${format}\nReferee: ${referee}\n\nPlease confirm receipt and let the club know promptly if there are any issues.`;
}

function makeRow({ fixture, forcedStatus = "", day, dateLabel, index, club, teamCfg, teamContacts, governedTemplates }) {
  const status = fixtureStatus(fixture, forcedStatus);
  const teamName = cleanName(fixture.homeTeam || fixture.team || fixture.home || "Home team", club?.name) || "Home team";
  const opposition = String(fixture.awayTeam || fixture.opponent || fixture.away || "Opposition TBC").trim();
  const ko = String(fixture.koTime || fixture.kickOff || fixture.kickoff || "TBC").trim() || "TBC";
  const pitch = String(fixture.pitchLabel || fixture.pitch || fixture.pitchId || "TBC").trim() || "TBC";
  const format = String(fixture.cfg?.format || fixture.manualFormat || fixture.format || "TBC").trim() || "TBC";
  const referee = String(fixture.referee || fixture.official || fixture.ref || "TBC").trim() || "TBC";
  const venue = String(
    fixture.venueName
      || fixture.venue
      || fixture.siteName
      || fixture.groundName
      || club?.venue
      || club?.groundName
      || "",
  ).trim();
  const refereeStatus = normalise(fixture.refStatus || fixture.officialStatus || fixture.assignmentStatus);
  const contact = contactForTeam(teamCfg, teamContacts, teamName, index);
  const primaryDestination = contact.preferredChannel === "email" ? contact.coachEmail : contact.coachPhone;
  const assistantDestination = contact.preferredChannel === "email" ? contact.assistantEmail : contact.assistantPhone;
  const additionalRecipients = (Array.isArray(contact.additionalContacts) ? contact.additionalContacts : []).map((person) => {
    const destination = person.preferredChannel === "email" ? person.email : person.mobile;
    return destination ? {
      type: person.staffRole || "coach",
      name: person.name || "Coach",
      destination,
      channel: person.preferredChannel || "email",
      personId: person.personId || "",
      assignmentId: person.assignmentId || "",
    } : null;
  }).filter(Boolean);
  const recipientRecords = [
    primaryDestination ? { type: "coach", name: contact.coachName || "Coach", destination: primaryDestination, channel: contact.preferredChannel } : null,
    contact.assistantEnabled && assistantDestination ? { type: "assistant", name: contact.assistantName || "Assistant coach", destination: assistantDestination, channel: contact.preferredChannel } : null,
    ...additionalRecipients,
  ].filter(Boolean).filter((recipient, index, rows) => rows.findIndex((candidate) => `${candidate.channel}:${candidate.destination}`.toLowerCase() === `${recipient.channel}:${recipient.destination}`.toLowerCase()) === index);
  const issues = [];

  if (status === "scheduled" && ko === "TBC") issues.push("Kick-off time missing");
  if (status === "scheduled" && pitch === "TBC") issues.push("Pitch missing");
  if (status === "scheduled" && (referee === "TBC" || !["confirmed", "accepted", "assigned"].includes(refereeStatus))) {
    issues.push(referee === "TBC" ? "Official not assigned" : "Official not confirmed");
  }
  if (!contact.receiveMatchdayMessages) issues.push("Matchday messages disabled");
  if (!recipientRecords.length) issues.push("Coach contact missing");
  if (contact.preferredChannel === "email" && contact.coachPhone && !contact.coachEmail) issues.push("Preferred email address missing");
  if (["whatsapp", "sms"].includes(contact.preferredChannel) && contact.coachEmail && !contact.coachPhone) issues.push("Preferred mobile number missing");

  const blocked = status === "unresolved" || (status === "scheduled" && (ko === "TBC" || pitch === "TBC"));
  const readyState = blocked ? "blocked" : issues.length ? "review" : "ready";
  const governedTemplate = governedTemplateForStatus(governedTemplates, status);
  const templateTokens = {
    team: teamName,
    opposition,
    date: dateLabel,
    kickoff: ko,
    pitch,
    venue: venue || "TBC",
    format,
    referee,
    club: String(club?.name || "Your club").trim() || "Your club",
  };
  const buildRecipientMessage = (contactName) => governedTemplate?.bodyTemplate
    ? renderTemplate(governedTemplate.bodyTemplate, { ...templateTokens, coach: contactName || "coach" }).trim()
    : buildMessage({ status, teamName, opposition, dateLabel, ko, pitch, format, referee, contactName });
  const message = buildRecipientMessage(contact.coachName);
  const recipients = recipientRecords.map((recipient) => ({
    ...recipient,
    message: buildRecipientMessage(recipient.name),
  }));
  const subject = governedTemplate?.subjectTemplate
    ? renderTemplate(governedTemplate.subjectTemplate, templateTokens).trim()
    : "";
  const id = stableId(fixture, day, index);
  const messageHash = [id, status, dateLabel, ko, pitch, format, referee, governedTemplate?.templateKey || "default", governedTemplate?.updatedAt || "", subject, ...recipients.map((recipient) => recipient.message)].join("|");

  return {
    id,
    messageHash,
    day,
    dateLabel,
    status,
    clubName: String(club?.name || "Your club").trim() || "Your club",
    readyState,
    issues,
    teamName,
    opposition,
    ko,
    pitch,
    venue,
    format,
    referee,
    refereeStatus,
    contact,
    recipients,
    message,
    subject,
    governedTemplateKey: governedTemplate?.templateKey || "",
    governedTemplateVersion: governedTemplate?.updatedAt || "default",
    governedTemplateApprovalRequired: Boolean(governedTemplate?.approvalRequired),
    raw: fixture,
  };
}

function dayRows({ day, dateLabel, hasRun, final, unresolved, club, teamCfg, teamContacts, governedTemplates }) {
  if (!hasRun && !asArray(final).length && !asArray(unresolved).length) return [];
  const scheduledRows = asArray(final).map((fixture, index) => makeRow({ fixture, day, dateLabel, index, club, teamCfg, teamContacts, governedTemplates }));
  const unresolvedRows = asArray(unresolved).map((fixture, index) => makeRow({ fixture, forcedStatus: "unresolved", day, dateLabel, index: scheduledRows.length + index, club, teamCfg, teamContacts, governedTemplates }));
  const byId = new Map();
  [...scheduledRows, ...unresolvedRows].forEach((row) => {
    const current = byId.get(row.id);
    const rank = { scheduled: 1, unresolved: 2, postponed: 3, cancelled: 4 };
    if (!current || rank[row.status] >= rank[current.status]) byId.set(row.id, row);
  });
  return [...byId.values()];
}

export function buildCommunicationsModel({
  club = {},
  teamCfg = [],
  teamContacts = [],
  satFinal = [],
  sunFinal = [],
  midweekFinal = [],
  satUnresolved = [],
  sunUnresolved = [],
  midweekUnresolved = [],
  satHasRun = false,
  sunHasRun = false,
  midweekHasRun = false,
  satDateLabel = "Saturday",
  sunDateLabel = "Sunday",
  midweekDateLabel = "Midweek",
  midweekEnabled = true,
  governedTemplates = [],
} = {}) {
  const rows = [
    ...(midweekEnabled ? dayRows({ day: "midweek", dateLabel: midweekDateLabel, hasRun: midweekHasRun, final: midweekFinal, unresolved: midweekUnresolved, club, teamCfg, teamContacts, governedTemplates }) : []),
    ...dayRows({ day: "saturday", dateLabel: satDateLabel, hasRun: satHasRun, final: satFinal, unresolved: satUnresolved, club, teamCfg, teamContacts, governedTemplates }),
    ...dayRows({ day: "sunday", dateLabel: sunDateLabel, hasRun: sunHasRun, final: sunFinal, unresolved: sunUnresolved, club, teamCfg, teamContacts, governedTemplates }),
  ];

  const counts = rows.reduce((result, row) => {
    result.total += 1;
    result[row.readyState] += 1;
    if (!row.recipients.length) result.missingContacts += 1;
    result.recipients += row.recipients.length;
    if (row.status === "postponed" || row.status === "cancelled") result.exceptionUpdates += 1;
    return result;
  }, { total: 0, ready: 0, review: 0, blocked: 0, missingContacts: 0, exceptionUpdates: 0, recipients: 0 });

  return {
    rows,
    counts,
    days: [
      { value: "all", label: "All days", count: rows.length },
      ...(midweekEnabled ? [{ value: "midweek", label: "Midweek", count: rows.filter((row) => row.day === "midweek").length }] : []),
      { value: "saturday", label: "Saturday", count: rows.filter((row) => row.day === "saturday").length },
      { value: "sunday", label: "Sunday", count: rows.filter((row) => row.day === "sunday").length },
    ],
    disclaimer: "Ground Control prepares messages for human review and copy-out. It does not confirm that WhatsApp, email or any other external service delivered the message.",
  };
}

export default buildCommunicationsModel;
