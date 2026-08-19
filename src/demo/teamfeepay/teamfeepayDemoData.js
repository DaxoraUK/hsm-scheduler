export const TEAMFEEPAY_DEMO_CLUB = Object.freeze({
  id: "tfp-demo-club-001",
  name: "Northwest Community Football Club",
  shortName: "NCFC",
  sport: "Football",
  contact_email: "operations@northwestcommunity.example",
  website: "https://northwestcommunity.example",
  address_line_1: "Community Sports Campus",
  town: "Greater Manchester",
  postcode: "M99 1GC",
  country: "GB",
  active: true,
});

const teamNames = [
  ["U7 Comets", "U7", "mixed", "5v5", "Saturday"],
  ["U8 Rockets", "U8", "mixed", "5v5", "Saturday"],
  ["U9 Falcons", "U9", "mixed", "7v7", "Saturday"],
  ["U9 Lionesses", "U9", "female", "7v7", "Sunday"],
  ["U10 Hawks", "U10", "mixed", "7v7", "Saturday"],
  ["U10 Panthers", "U10", "mixed", "7v7", "Sunday"],
  ["U11 Athletic", "U11", "mixed", "9v9", "Saturday"],
  ["U11 United", "U11", "mixed", "9v9", "Sunday"],
  ["U12 City", "U12", "mixed", "9v9", "Saturday"],
  ["U12 Lionesses", "U12", "female", "9v9", "Sunday"],
  ["U13 Rangers", "U13", "mixed", "11v11-youth", "Saturday"],
  ["U13 Wanderers", "U13", "mixed", "11v11-youth", "Sunday"],
  ["U14 Athletic", "U14", "mixed", "11v11-youth", "Saturday"],
  ["U14 Lionesses", "U14", "female", "11v11-youth", "Sunday"],
  ["U15 United", "U15", "mixed", "11v11-youth", "Saturday"],
  ["U16 Academy", "U16", "mixed", "11v11-youth", "Sunday"],
  ["U17 Development", "U17", "mixed", "11v11-youth", "Sunday"],
  ["Women First", "Open", "female", "11v11", "Sunday"],
  ["Men First", "Open", "male", "11v11", "Saturday"],
  ["Men Reserves", "Open", "male", "11v11", "Saturday"],
  ["Veterans", "Veterans", "male", "11v11", "Sunday"],
  ["Inclusive Football", "Open", "mixed", "7v7", "Sunday"],
];

export const TEAMFEEPAY_DEMO_TEAMS = Object.freeze(
  teamNames.map(([name, age_group, gender, format, playing_day], index) => ({
    id: `tfp-team-${String(index + 1).padStart(3, "0")}`,
    club_id: TEAMFEEPAY_DEMO_CLUB.id,
    name,
    age_group,
    gender,
    format,
    playing_day,
    active: true,
    member_count: index < 6 ? 18 : index < 17 ? 27 : 34,
  })),
);

const coachNames = [
  "Alex Morgan", "Jordan Ellis", "Taylor Brooks", "Morgan Reed", "Casey Bennett",
  "Jamie Foster", "Robin Clarke", "Sam Patel", "Cameron Hughes", "Riley Turner",
  "Charlie Evans", "Drew Harrison", "Avery Collins", "Hayden Walker", "Quinn Foster",
  "Reese Murphy", "Parker Green", "Finley Cooper", "Rowan Bailey", "Blake Ward",
  "Skyler Hall", "Emerson Price",
];

export const TEAMFEEPAY_DEMO_PEOPLE = Object.freeze(
  coachNames.map((display_name, index) => ({
    id: `tfp-person-${String(index + 1).padStart(3, "0")}`,
    display_name,
    email: `${display_name.toLowerCase().replaceAll(" ", ".")}@northwestcommunity.example`,
    mobile: `07000 ${String(100000 + index).slice(-6)}`,
    role: index < 18 ? "coach" : "club_admin",
    safeguarding_status: index % 7 === 0 ? "renewal_due" : "verified",
    active: true,
    team_id: TEAMFEEPAY_DEMO_TEAMS[index % TEAMFEEPAY_DEMO_TEAMS.length].id,
  })),
);

export const TEAMFEEPAY_DEMO_SITES = Object.freeze([
  {
    id: "site-community-campus",
    name: "Community Sports Campus",
    pitches: [
      { id: "pitch-1", name: "Stadium Pitch", format: "11v11", capacity: 1, status: "open" },
      { id: "pitch-2", name: "North Grass", format: "11v11", capacity: 1, status: "open" },
      { id: "pitch-3a", name: "Development Pitch A", format: "9v9", capacity: 1, status: "open" },
      { id: "pitch-3b", name: "Development Pitch B", format: "9v9", capacity: 1, status: "open" },
      { id: "pitch-mini", name: "Mini Soccer Zone", format: "7v7", capacity: 2, status: "open" },
    ],
    parkingSpaces: 92,
  },
  {
    id: "site-winter-3g",
    name: "Riverside 3G Centre",
    pitches: [
      { id: "winter-full", name: "3G Full Pitch", format: "11v11", capacity: 1, status: "open" },
      { id: "winter-half-a", name: "3G Half A", format: "9v9", capacity: 2, status: "open" },
      { id: "winter-half-b", name: "3G Half B", format: "9v9", capacity: 2, status: "open" },
    ],
    parkingSpaces: 54,
  },
]);

export const TEAMFEEPAY_DEMO_EVENTS = Object.freeze([
  { id: "evt-001", team_id: "tfp-team-019", title: "Men First v Brookfield", event_type: "fixture", starts_at: "2026-07-25T14:00:00+01:00", ends_at: "2026-07-25T16:00:00+01:00", venue: "Stadium Pitch", status: "scheduled", pitchId: "pitch-1", attendees: 84 },
  { id: "evt-002", team_id: "tfp-team-020", title: "Men Reserves v Moss Lane", event_type: "fixture", starts_at: "2026-07-25T14:00:00+01:00", ends_at: "2026-07-25T16:00:00+01:00", venue: "North Grass", status: "scheduled", pitchId: "pitch-2", attendees: 61 },
  { id: "evt-003", team_id: "tfp-team-013", title: "U14 Athletic v Westside", event_type: "fixture", starts_at: "2026-07-25T10:30:00+01:00", ends_at: "2026-07-25T12:00:00+01:00", venue: "North Grass", status: "scheduled", pitchId: "pitch-2", attendees: 47 },
  { id: "evt-004", team_id: "tfp-team-009", title: "U12 City v Ashton", event_type: "fixture", starts_at: "2026-07-25T10:00:00+01:00", ends_at: "2026-07-25T11:15:00+01:00", venue: "Development Pitch A", status: "scheduled", pitchId: "pitch-3a", attendees: 39 },
  { id: "evt-005", team_id: "tfp-team-007", title: "U11 Athletic v County Juniors", event_type: "fixture", starts_at: "2026-07-25T09:00:00+01:00", ends_at: "2026-07-25T10:15:00+01:00", venue: "Development Pitch B", status: "scheduled", pitchId: "pitch-3b", attendees: 38 },
  { id: "evt-006", team_id: "tfp-team-005", title: "U10 Hawks v Central Reds", event_type: "fixture", starts_at: "2026-07-25T09:00:00+01:00", ends_at: "2026-07-25T10:00:00+01:00", venue: "Mini Soccer Zone", status: "scheduled", pitchId: "pitch-mini", attendees: 34 },
  { id: "evt-007", team_id: "tfp-team-001", title: "U7 Comets Festival", event_type: "festival", starts_at: "2026-07-25T10:30:00+01:00", ends_at: "2026-07-25T12:00:00+01:00", venue: "Mini Soccer Zone", status: "scheduled", pitchId: "pitch-mini", attendees: 52 },
  { id: "evt-008", team_id: "tfp-team-018", title: "Women First Training", event_type: "training", starts_at: "2026-07-23T19:00:00+01:00", ends_at: "2026-07-23T20:30:00+01:00", venue: "3G Full Pitch", status: "confirmed", pitchId: "winter-full", attendees: 24 },
  { id: "evt-009", team_id: "tfp-team-015", title: "U15 United Training", event_type: "training", starts_at: "2026-07-23T18:00:00+01:00", ends_at: "2026-07-23T19:00:00+01:00", venue: "3G Half A", status: "confirmed", pitchId: "winter-half-a", attendees: 22 },
  { id: "evt-010", team_id: "tfp-team-016", title: "U16 Academy Friendly", event_type: "friendly", starts_at: "2026-07-26T11:00:00+01:00", ends_at: "2026-07-26T13:00:00+01:00", venue: "Stadium Pitch", status: "pending_approval", pitchId: "pitch-1", attendees: 49 },
]);

export const TEAMFEEPAY_DEMO_ANALYTICS = Object.freeze({
  reportingPeriod: "2026-07-01 to 2026-07-31",
  totalConfiguredHours: 486,
  matches: 142,
  training: 188,
  friendliesAndEvents: 42,
  winterExternal: 36,
  closuresDowntime: 18,
  unusedCapacity: 60,
  utilisationPct: 83.9,
  adminHoursSavedMonthly: 41,
  projectedAnnualValue: 18400,
});

export const TEAMFEEPAY_DEMO_DATASET = Object.freeze({
  club: TEAMFEEPAY_DEMO_CLUB,
  teams: TEAMFEEPAY_DEMO_TEAMS,
  people: TEAMFEEPAY_DEMO_PEOPLE,
  sites: TEAMFEEPAY_DEMO_SITES,
  events: TEAMFEEPAY_DEMO_EVENTS,
  analytics: TEAMFEEPAY_DEMO_ANALYTICS,
});

export const TEAMFEEPAY_DEMO_SCENARIO = Object.freeze([
  {
    id: "sync",
    title: "Reuse TeamFeePay club data",
    summary: "Import the club, 22 teams and authorised coach records without duplicate setup.",
    impact: "One source of truth",
  },
  {
    id: "schedule",
    title: "Build the operating weekend",
    summary: "Apply pitch suitability, timings, parking and operational rules to TeamFeePay events.",
    impact: "10 events allocated",
  },
  {
    id: "closure",
    title: "Close North Grass",
    summary: "A waterlogged pitch affects the U14 fixture and the reserves match in one action.",
    impact: "2 conflicts surfaced",
  },
  {
    id: "resolve",
    title: "Approve recovery plan",
    summary: "Move U14 Athletic to the stadium morning slot and the reserves to Riverside 3G.",
    impact: "No cancellations",
  },
  {
    id: "evidence",
    title: "Return operational evidence",
    summary: "Publish schedule changes, alerts and whole-facility utilisation back to the shared platform.",
    impact: "83.9% utilisation",
  },
]);
