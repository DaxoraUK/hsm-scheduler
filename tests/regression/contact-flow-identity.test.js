import { expect, test } from "vitest";
import { mergeCoachHubWorkspaceIntoContacts, resolveCoachHubContactForTeam } from "../../src/lib/coachHubContactBridge.js";
import { alignTeamContacts, alignTeamContactsForEditing, contactForTeam, teamContactDirectoryRows } from "../../src/lib/communications/contactModel.js";
import { buildCommunicationsModel } from "../../src/lib/communications/communicationsEngine.js";
import { buildDeliveryMessages } from "../../src/lib/communications/deliveryService.js";
import { sanitiseOutboundMessages } from "../../server/communications/normalise.js";
import { buildCoachCommunicationAudience } from "../../src/lib/coach/coachHubPilotEngine.js";

const person = { id: "person-1", display_name: "Coach One", email: "one@example.org", mobile: "07123456789", preferred_channel: "email", status: "active" };
const assignment = { id: "assignment-1", person_id: person.id, team_key: "U14 Spartans", team_name: "U14 Spartans", staff_role: "manager", source_slot: "manual", is_primary: true, status: "active" };
const teamCfg = [{ name: "U14 Spartans" }];
const legacy = { team_key: "u14-spartans", team_name: "U14 Spartans", coach_name: "", coach_email: "", receive_matchday_messages: false, privacy_notice_provided_at: "2026-10-01" };
const synthetic = { team_key: "U14 Spartans", team_name: "U14 Spartans", additional_contacts: [{ person_id: person.id, assignment_id: assignment.id, name: "Coach One", email: person.email, preferred_channel: "email", is_primary: true }] };
const workspace = { people: [person], assignments: [assignment] };

test.each([alignTeamContacts, alignTeamContactsForEditing])("%s retains assigned contacts hidden by an empty legacy key variant", (align) => {
  const rows = align(teamCfg, mergeCoachHubWorkspaceIntoContacts([synthetic, legacy], workspace));
  expect(rows).toHaveLength(1);
  expect(rows[0].teamKey).toBe("u14-spartans");
  expect(rows[0].additionalContacts.map((row) => row.email)).toEqual(["one@example.org"]);
  expect(rows[0].receiveMatchdayMessages).toBe(false);
  expect(rows[0].privacyNoticeProvidedAt).toBe("2026-10-01");
});

test("Communications consumes the same merged contact as Settings", () => {
  const contacts = mergeCoachHubWorkspaceIntoContacts([synthetic, { ...legacy, receive_matchday_messages: true }], workspace);
  const model = buildCommunicationsModel({ teamCfg, teamContacts: contacts, satHasRun: true, satFinal: [{ id: "game", homeTeam: "U14 Spartans", awayTeam: "Visitors", teamId: "U14 Spartans", koTime: "10:15", pitchId: "P4", referee: "Ref", refStatus: "Confirmed" }] });
  expect(model.rows[0].recipients.map((row) => row.destination)).toEqual(["one@example.org"]);
  expect(model.rows[0].readyState).toBe("ready");
});

test("explicit different team IDs never share a contact through their name", () => {
  const result = contactForTeam([{ id: "team-a", name: "Spartans" }, { id: "team-b", name: "Spartans" }], [{ teamKey: "team-a", teamName: "Spartans", coachEmail: "one@example.org", preferredChannel: "email" }], "Spartans", 0, "team-b");
  expect(result.coachEmail).toBe("");
});

test("directory merging does not attach a same-name opaque team ID to another team", () => {
  const rows = mergeCoachHubWorkspaceIntoContacts([{ team_key: "team-a", team_name: "Spartans" }], {
    people: [person], assignments: [{ ...assignment, team_key: "team-b", team_name: "Spartans" }],
  });
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.team_key === "team-a").additional_contacts || []).toEqual([]);
});

test("name-like explicit configured IDs stay separate in directory and planner joins", () => {
  const teams = [{ id: "spartans", name: "Spartans" }, { id: "SPARTANS", name: "Spartans" }];
  const other = { ...assignment, team_key: "SPARTANS", team_name: "Spartans" };
  const merged = mergeCoachHubWorkspaceIntoContacts([{ team_key: "spartans", team_name: "Spartans" }], { people: [person], assignments: [other] }, teams);
  expect(merged[0].additional_contacts || []).toEqual([]);
  expect(resolveCoachHubContactForTeam(teams[0], [[person], [other]], teams)).toBeNull();
  expect(buildCoachCommunicationAudience({ teamCfg: teams, teamKeys: ["spartans"], people: [person], assignments: [other] }).recipients).toEqual([]);
});

test("ambiguous configured name aliases never select an arbitrary explicit team", () => {
  const teams = [{ id: "spartans", name: "Spartans" }, { id: "team-b", name: "Spartans" }];
  const other = { ...assignment, team_key: "Spartans", team_name: "Spartans" };
  expect(resolveCoachHubContactForTeam(teams[0], [[person], [other]], teams)).toBeNull();
  const merged = mergeCoachHubWorkspaceIntoContacts([{ team_key: "spartans", team_name: "Spartans" }], { people: [person], assignments: [other] }, teams);
  expect(merged[0].additional_contacts || []).toEqual([]);
});

test.each([
  { ...assignment, status: "inactive" },
  { ...assignment, team_key: "different-id", team_name: "U14 Spartans Development" },
])("Settings excludes inactive and partial-name assignments: %j", (row) => {
  expect(resolveCoachHubContactForTeam({ name: "U14 Spartans", key: "u14-spartans" }, [[person], [row]])).toBeNull();
});

test("Settings excludes inactive people even with an active assignment", () => {
  expect(resolveCoachHubContactForTeam({ name: "U14 Spartans", key: "u14-spartans" }, [[{ ...person, status: "inactive" }], [assignment]])).toBeNull();
});

test("planner audiences understand exact legacy name keys without fuzzy matching", () => {
  const audience = buildCoachCommunicationAudience({ teamCfg, teamKeys: ["u14-spartans"], people: [person], assignments: [assignment, { ...assignment, id: "other", team_key: "u14-spartans-development", team_name: "U14 Spartans Development" }] });
  expect(audience.recipients.map((row) => row.personId)).toEqual(["person-1"]);
});

test("delivery preserves directory identity and distinguishes two coaches with the same role", () => {
  const recipients = [person, { ...person, id: "person-2", email: "two@example.org" }].map((row, index) => ({ type: "coach", name: row.display_name, destination: row.email, channel: "email", personId: row.id, assignmentId: `assignment-${index + 1}`, message: "Your match is confirmed for Saturday." }));
  const result = buildDeliveryMessages([{ id: "game", messageHash: "hash", teamName: "U14 Spartans", contact: { teamKey: "u14-spartans" }, recipients }], { channels: { email: { enabled: true } } });
  expect(new Set(result.messages.map((row) => row.clientKey)).size).toBe(2);
  const payload = sanitiseOutboundMessages("club", result.messages);
  expect(payload.map((row) => row.assignmentId)).toEqual(["assignment-1", "assignment-2"]);
  expect(payload.map((row) => row.personId)).toEqual(["person-1", "person-2"]);
});

test("Coach Hub cards and privacy counts include directory contacts without duplicating legacy slots", () => {
  expect(teamContactDirectoryRows({ ...synthetic, coach_name: "Coach One", coach_email: "one@example.org" })).toHaveLength(1);
  expect(teamContactDirectoryRows(synthetic)[0]).toMatchObject({ name: "Coach One", email: "one@example.org" });
  expect(teamContactDirectoryRows({ assistant_enabled: false, assistant_email: "disabled@example.org" })).toEqual([]);
  expect(teamContactDirectoryRows({ additional_contacts: [{ person_id: "a", name: "Alex Smith" }, { person_id: "b", name: "Alex Smith" }] })).toHaveLength(2);
});

test("Coach Hub-only preference is not converted into an external email recipient", () => {
  const contacts = mergeCoachHubWorkspaceIntoContacts([{ ...legacy, receive_matchday_messages: true }], {
    people: [{ ...person, preferred_channel: "in_app" }], assignments: [assignment],
  });
  const model = buildCommunicationsModel({ teamCfg, teamContacts: contacts, satHasRun: true, satFinal: [{ id: "game", homeTeam: "U14 Spartans", awayTeam: "Visitors" }] });
  expect(model.rows[0].recipients).toEqual([]);
});
