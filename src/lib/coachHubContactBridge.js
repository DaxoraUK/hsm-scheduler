function text(value) {
  return String(value || "").trim();
}

function normaliseIdentity(value) {
  return text(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assignmentPersonId(assignment = {}) {
  return text(assignment.person_id || assignment.personId);
}

function assignmentTeamKey(assignment = {}) {
  return text(assignment.team_key || assignment.teamKey || assignment.team_id || assignment.teamId);
}

function assignmentTeamName(assignment = {}) {
  return text(assignment.team_name || assignment.teamName);
}

function assignmentRole(assignment = {}) {
  return text(assignment.staff_role || assignment.staffRole || assignment.role || "coach").toLowerCase();
}

function assignmentIsPrimary(assignment = {}) {
  return Boolean(assignment.is_primary ?? assignment.isPrimary);
}

function personRecord(person = {}) {
  const channel = text(person.preferred_channel || person.preferredChannel || "email").toLowerCase();
  return {
    id: text(person.id),
    name: text(person.display_name || person.displayName || person.full_name || person.fullName || person.name),
    email: text(person.email).toLowerCase(),
    mobile: text(person.mobile || person.phone),
    preferredChannel: ["whatsapp", "sms", "email"].includes(channel) ? channel : "email",
    status: text(person.status || "active").toLowerCase(),
  };
}

function assignmentContact(assignment = {}, person = {}) {
  const resolvedPerson = personRecord(person);
  return {
    person_id: resolvedPerson.id || assignmentPersonId(assignment),
    assignment_id: text(assignment.id || assignment.assignment_id || assignment.assignmentId),
    name: resolvedPerson.name || text(assignment.name || assignment.coach_name || assignment.coachName),
    email: resolvedPerson.email || text(assignment.email || assignment.coach_email || assignment.coachEmail).toLowerCase(),
    mobile: resolvedPerson.mobile || text(assignment.mobile || assignment.phone || assignment.coach_phone || assignment.coachPhone),
    preferred_channel: resolvedPerson.preferredChannel || text(assignment.preferred_channel || assignment.preferredChannel || "email"),
    staff_role: assignmentRole(assignment),
    is_primary: assignmentIsPrimary(assignment),
    source_slot: text(assignment.source_slot || assignment.sourceSlot),
  };
}

function contactIdentity(contact = {}) {
  return text(contact.assignment_id)
    || [text(contact.person_id), text(contact.staff_role), text(contact.name), text(contact.email)].join("|");
}

function mergeAdditionalContacts(existing = [], incoming = []) {
  const merged = new Map();
  [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
    .forEach((contact) => {
      const key = contactIdentity(contact);
      if (key) merged.set(key, { ...contact });
    });
  return [...merged.values()].sort((left, right) => {
    const primaryDelta = Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary));
    if (primaryDelta) return primaryDelta;
    return String(left.staff_role || "").localeCompare(String(right.staff_role || ""));
  });
}

function rowKey(row = {}) {
  return text(row.team_key || row.teamKey);
}

function rowName(row = {}) {
  return text(row.team_name || row.teamName);
}

/**
 * Merge the authoritative Coach Hub directory into team-contact rows.
 *
 * The database contacts RPC historically filtered out assignments created from
 * the original coach/assistant slots. Reading the Coach Hub workspace directly
 * ensures every active assignment is available to Settings -> Teams, regardless
 * of its source_slot or whether a legacy team_contacts row already exists.
 */
export function mergeCoachHubWorkspaceIntoContacts(contacts = [], workspace = {}) {
  const baseRows = Array.isArray(contacts) ? contacts.map((row) => ({ ...row })) : [];
  const people = Array.isArray(workspace?.people) ? workspace.people : [];
  const assignments = Array.isArray(workspace?.assignments) ? workspace.assignments : [];
  const peopleById = new Map(
    people
      .map(personRecord)
      .filter((person) => person.id && person.status !== "inactive")
      .map((person) => [person.id, person]),
  );

  const grouped = new Map();
  assignments
    .filter((assignment) => text(assignment?.status || "active").toLowerCase() === "active")
    .forEach((assignment) => {
      const person = peopleById.get(assignmentPersonId(assignment));
      if (!person) return;
      const teamKey = assignmentTeamKey(assignment);
      const teamName = assignmentTeamName(assignment);
      const identity = teamKey || normaliseIdentity(teamName);
      if (!identity) return;
      const current = grouped.get(identity) || { teamKey, teamName, contacts: [] };
      current.teamKey ||= teamKey;
      current.teamName ||= teamName;
      current.contacts.push(assignmentContact(assignment, person));
      grouped.set(identity, current);
    });

  const indexByKey = new Map();
  const indexByName = new Map();
  baseRows.forEach((row, index) => {
    const key = rowKey(row);
    const name = normaliseIdentity(rowName(row));
    if (key) indexByKey.set(key, index);
    if (name) indexByName.set(name, index);
  });

  grouped.forEach((group) => {
    const byKey = group.teamKey ? indexByKey.get(group.teamKey) : undefined;
    const byName = group.teamName ? indexByName.get(normaliseIdentity(group.teamName)) : undefined;
    const index = byKey ?? byName;
    if (index === undefined) {
      const created = {
        team_key: group.teamKey,
        team_name: group.teamName,
        coach_name: "",
        coach_phone: "",
        coach_email: "",
        preferred_channel: "email",
        assistant_name: "",
        assistant_phone: "",
        assistant_email: "",
        assistant_enabled: false,
        receive_matchday_messages: true,
        additional_contacts: mergeAdditionalContacts([], group.contacts),
      };
      baseRows.push(created);
      if (group.teamKey) indexByKey.set(group.teamKey, baseRows.length - 1);
      if (group.teamName) indexByName.set(normaliseIdentity(group.teamName), baseRows.length - 1);
      return;
    }

    const row = baseRows[index];
    row.additional_contacts = mergeAdditionalContacts(
      row.additional_contacts || row.additionalContacts,
      group.contacts,
    );
  });

  return baseRows;
}

export function resolveCoachHubContactForTeam(team = {}, sources = []) {
  const flattened = (Array.isArray(sources) ? sources : []).flat(Infinity).filter(Boolean);
  const peopleById = new Map(
    flattened
      .filter((row) => row.id && (row.display_name || row.displayName || row.full_name || row.fullName || row.name))
      .map((row) => [text(row.id), personRecord(row)]),
  );
  const targetKey = text(team.id || team.teamId || team.key);
  const targetName = normaliseIdentity(team.name || team.teamName);
  const candidates = flattened
    .filter((row) => row.team_key || row.teamKey || row.team_id || row.teamId || row.team_name || row.teamName)
    .filter((row) => {
      const key = assignmentTeamKey(row);
      const name = normaliseIdentity(assignmentTeamName(row));
      return (targetKey && key === targetKey)
        || (targetName && name && (name.includes(targetName) || targetName.includes(name)));
    })
    .map((assignment) => {
      const person = peopleById.get(assignmentPersonId(assignment)) || {};
      const contact = assignmentContact(assignment, person);
      return {
        ...contact,
        name: contact.name || text(assignment.coach_name || assignment.coachName),
        email: contact.email || text(assignment.coach_email || assignment.coachEmail).toLowerCase(),
        mobile: contact.mobile || text(assignment.coach_phone || assignment.coachPhone),
      };
    })
    .filter((contact) => contact.name || contact.email || contact.mobile);

  const primary = candidates.find((contact) => contact.is_primary)
    || candidates.find((contact) => ["manager", "lead_coach", "coach", "primary_coach", "head_coach"].includes(text(contact.staff_role).toLowerCase()))
    || candidates[0];
  if (!primary) return null;
  return {
    coachName: primary.name || "",
    coachEmail: primary.email || "",
    coachPhone: primary.mobile || "",
    preferredChannel: primary.preferred_channel || "email",
    managedByCoachHub: true,
  };
}

export function mergeCoachHubContact(contact = {}, coachHubContact = null) {
  if (!coachHubContact) return { ...contact };
  return {
    ...contact,
    coachName: coachHubContact.coachName || "",
    coachEmail: coachHubContact.coachEmail || "",
    coachPhone: coachHubContact.coachPhone || "",
    preferredChannel: coachHubContact.preferredChannel || contact.preferredChannel || "email",
    managedByCoachHub: true,
  };
}
