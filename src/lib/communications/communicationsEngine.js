import { cleanName } from "../scheduler.js";

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

function getTeamContact(teamCfg = [], teamName = "", clubName = "") {
  const cleaned = cleanName(teamName, clubName);
  const key = normalise(cleaned || teamName);
  const team = asArray(teamCfg).find((item) => {
    const itemKey = normalise(cleanName(item.name || item.teamName || "", clubName));
    return itemKey === key || itemKey.includes(key) || key.includes(itemKey);
  });

  return {
    team,
    name: String(team?.managerName || team?.coachName || "").trim(),
    phone: String(team?.managerPhone || team?.coachPhone || "").trim(),
    email: String(team?.managerEmail || team?.coachEmail || "").trim(),
    channel: String(team?.communicationChannel || "whatsapp").trim().toLowerCase(),
  };
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

function makeRow({ fixture, forcedStatus = "", day, dateLabel, index, club, teamCfg }) {
  const status = fixtureStatus(fixture, forcedStatus);
  const teamName = cleanName(fixture.homeTeam || fixture.team || fixture.home || "Home team", club?.name) || "Home team";
  const opposition = String(fixture.awayTeam || fixture.opponent || fixture.away || "Opposition TBC").trim();
  const ko = String(fixture.koTime || fixture.kickOff || fixture.kickoff || "TBC").trim() || "TBC";
  const pitch = String(fixture.pitchLabel || fixture.pitch || fixture.pitchId || "TBC").trim() || "TBC";
  const format = String(fixture.cfg?.format || fixture.manualFormat || fixture.format || "TBC").trim() || "TBC";
  const referee = String(fixture.referee || fixture.official || fixture.ref || "TBC").trim() || "TBC";
  const refereeStatus = normalise(fixture.refStatus || fixture.officialStatus || fixture.assignmentStatus);
  const contact = getTeamContact(teamCfg, teamName, club?.name);
  const issues = [];

  if (status === "scheduled" && ko === "TBC") issues.push("Kick-off time missing");
  if (status === "scheduled" && pitch === "TBC") issues.push("Pitch missing");
  if (status === "scheduled" && (referee === "TBC" || !["confirmed", "accepted", "assigned"].includes(refereeStatus))) {
    issues.push(referee === "TBC" ? "Official not assigned" : "Official not confirmed");
  }
  if (!contact.phone && !contact.email) issues.push("Manager contact missing");

  const blocked = status === "unresolved" || (status === "scheduled" && (ko === "TBC" || pitch === "TBC"));
  const readyState = blocked ? "blocked" : issues.length ? "review" : "ready";
  const message = buildMessage({ status, teamName, opposition, dateLabel, ko, pitch, format, referee, contactName: contact.name });
  const id = stableId(fixture, day, index);
  const messageHash = [id, status, dateLabel, ko, pitch, format, referee, message].join("|");

  return {
    id,
    messageHash,
    day,
    dateLabel,
    status,
    readyState,
    issues,
    teamName,
    opposition,
    ko,
    pitch,
    format,
    referee,
    refereeStatus,
    contact,
    message,
    raw: fixture,
  };
}

function dayRows({ day, dateLabel, hasRun, final, unresolved, club, teamCfg }) {
  if (!hasRun && !asArray(final).length && !asArray(unresolved).length) return [];
  const scheduledRows = asArray(final).map((fixture, index) => makeRow({ fixture, day, dateLabel, index, club, teamCfg }));
  const unresolvedRows = asArray(unresolved).map((fixture, index) => makeRow({ fixture, forcedStatus: "unresolved", day, dateLabel, index: scheduledRows.length + index, club, teamCfg }));
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
} = {}) {
  const rows = [
    ...(midweekEnabled ? dayRows({ day: "midweek", dateLabel: midweekDateLabel, hasRun: midweekHasRun, final: midweekFinal, unresolved: midweekUnresolved, club, teamCfg }) : []),
    ...dayRows({ day: "saturday", dateLabel: satDateLabel, hasRun: satHasRun, final: satFinal, unresolved: satUnresolved, club, teamCfg }),
    ...dayRows({ day: "sunday", dateLabel: sunDateLabel, hasRun: sunHasRun, final: sunFinal, unresolved: sunUnresolved, club, teamCfg }),
  ];

  const counts = rows.reduce((result, row) => {
    result.total += 1;
    result[row.readyState] += 1;
    if (!row.contact.phone && !row.contact.email) result.missingContacts += 1;
    if (row.status === "postponed" || row.status === "cancelled") result.exceptionUpdates += 1;
    return result;
  }, { total: 0, ready: 0, review: 0, blocked: 0, missingContacts: 0, exceptionUpdates: 0 });

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
