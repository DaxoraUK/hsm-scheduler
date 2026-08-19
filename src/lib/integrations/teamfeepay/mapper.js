const text = (value, fallback = "") => String(value ?? fallback).trim();
const bool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (["true", "1", "yes"].includes(text(value).toLowerCase())) return true;
  if (["false", "0", "no"].includes(text(value).toLowerCase())) return false;
  return fallback;
};

function first(source, keys, fallback = "") {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && text(value) !== "") return value;
  }
  return fallback;
}

export function mapPartnerClubToDaxora(source = {}) {
  const sourceId = text(first(source, ["id", "club_id", "clubId", "external_id"]));
  const name = text(first(source, ["name", "club_name", "clubName"]), "Imported club");
  return {
    externalSource: "teamfeepay",
    externalId: sourceId,
    name,
    sport: text(first(source, ["sport", "primary_sport"]), "Football"),
    contactEmail: text(first(source, ["email", "contact_email", "contactEmail"])),
    website: text(first(source, ["website", "url"])),
    address: {
      line1: text(first(source, ["address_line_1", "address1", "street"])),
      line2: text(first(source, ["address_line_2", "address2"])),
      town: text(first(source, ["town", "city"])),
      postcode: text(first(source, ["postcode", "postal_code", "zip"])),
      country: text(first(source, ["country", "country_code"]), "GB"),
    },
    active: bool(first(source, ["active", "is_active"], true), true),
  };
}

export function mapPartnerTeamToDaxora(source = {}) {
  return {
    externalSource: "teamfeepay",
    externalId: text(first(source, ["id", "team_id", "teamId", "external_id"])),
    clubExternalId: text(first(source, ["club_id", "clubId", "organisation_id"])),
    name: text(first(source, ["name", "team_name", "teamName"]), "Imported team"),
    ageGroup: text(first(source, ["age_group", "ageGroup", "age"])),
    gender: text(first(source, ["gender", "category"]), "mixed").toLowerCase(),
    format: text(first(source, ["format", "game_format", "team_format"])),
    defaultPlayingDay: text(first(source, ["playing_day", "default_day", "day"])),
    active: bool(first(source, ["active", "is_active"], true), true),
  };
}

export function mapPartnerPersonToDaxora(source = {}) {
  const firstName = text(first(source, ["first_name", "firstName"]));
  const lastName = text(first(source, ["last_name", "lastName"]));
  const explicitDisplayName = text(first(source, ["display_name", "displayName", "name"]));
  return {
    externalSource: "teamfeepay",
    externalId: text(first(source, ["id", "person_id", "member_id", "user_id"])),
    displayName: explicitDisplayName || `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    email: text(first(source, ["email", "contact_email"])).toLowerCase(),
    mobile: text(first(source, ["mobile", "phone", "telephone"])),
    roles: Array.isArray(source.roles)
      ? source.roles.map((role) => text(role).toLowerCase()).filter(Boolean)
      : [text(first(source, ["role", "member_type"])).toLowerCase()].filter(Boolean),
    safeguardingStatus: text(first(source, ["safeguarding_status", "safeguardingStatus"]), "not_supplied"),
    active: bool(first(source, ["active", "is_active"], true), true),
  };
}

export function mapPartnerEventToDaxora(source = {}) {
  const startsAt = first(source, ["starts_at", "start", "start_time", "startsAt"]);
  const endsAt = first(source, ["ends_at", "end", "end_time", "endsAt"]);
  return {
    externalSource: "teamfeepay",
    externalId: text(first(source, ["id", "event_id", "fixture_id", "booking_id"])),
    clubExternalId: text(first(source, ["club_id", "clubId"])),
    teamExternalId: text(first(source, ["team_id", "teamId"])),
    title: text(first(source, ["title", "name", "event_name"]), "Imported event"),
    eventType: text(first(source, ["event_type", "type", "category"]), "event").toLowerCase(),
    startsAt: startsAt ? new Date(startsAt).toISOString() : "",
    endsAt: endsAt ? new Date(endsAt).toISOString() : "",
    venueName: text(first(source, ["venue", "venue_name", "location"])),
    status: text(first(source, ["status", "state"]), "scheduled").toLowerCase(),
  };
}

export function mapPartnerEntity(entityType, source = {}) {
  const type = text(entityType).toLowerCase();
  if (type === "club") return mapPartnerClubToDaxora(source);
  if (type === "team") return mapPartnerTeamToDaxora(source);
  if (["person", "member", "coach", "administrator"].includes(type)) return mapPartnerPersonToDaxora(source);
  if (["event", "fixture", "booking", "training"].includes(type)) return mapPartnerEventToDaxora(source);
  throw new Error(`Unsupported partner entity type: ${entityType}`);
}
