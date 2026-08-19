const dateAt = (dayOffset, time = "09:00") => {
  const base = new Date("2026-07-25T12:00:00+01:00");
  base.setDate(base.getDate() + dayOffset);
  const [hours, minutes] = time.split(":").map(Number);
  base.setHours(hours, minutes, 0, 0);
  return base.toISOString();
};

export const ACQUISITION_DEMO_CLUB = Object.freeze({
  id: "teamfeepay-demo-club",
  name: "Northwest Community Football Club",
  shortName: "Northwest Community",
  venue: "Northwest Community Sports Campus",
  postcode: "M99 1GC",
  weatherPostcode: "M99 1GC",
  primarySiteId: "community-campus",
  sport: "Football",
  primary: "#0f766e",
  secondary: "#f59e0b",
  carParkSpaces: 92,
  maxConcurrent: 5,
  logo: "",
  features: { midweekEnabled: true, parkingEnabled: true },
  sites: [
    { id: "community-campus", name: "Community Sports Campus", venue: "Community Way, Greater Manchester", postcode: "M99 1GC", isPrimary: true, weatherEnabled: true, carParkSpaces: 92, notes: "Primary matchday and clubhouse site" },
    { id: "riverside-3g", name: "Riverside 3G Centre", venue: "Riverside Road, Greater Manchester", postcode: "M99 2GC", isPrimary: false, weatherEnabled: false, carParkSpaces: 54, notes: "Winter training and disruption recovery venue" },
  ],
  avgCars: { "3v3": 8, "5v5": 12, "7v7": 16, "9v9": 20, "11v11-youth": 28, "11v11-small": 28, "11v11": 36 },
});

export const ACQUISITION_DEMO_PITCHES = Object.freeze([
  { id: "P1", label: "Stadium Pitch", desc: "Full 11v11 show pitch", format: "11v11", siteId: "community-campus", innerOf: null, independent: false, surface: "grass" },
  { id: "P1a", label: "Stadium 9v9 Area", desc: "9v9 inside Stadium Pitch", format: "9v9", siteId: "community-campus", innerOf: "P1", independent: false, surface: "grass" },
  { id: "P2", label: "North Grass", desc: "Small 11v11", format: "11v11-small", siteId: "community-campus", innerOf: null, independent: false, surface: "grass" },
  { id: "P2a", label: "North Grass 7v7", desc: "7v7 inside North Grass", format: "7v7", siteId: "community-campus", innerOf: "P2", independent: false, surface: "grass" },
  { id: "P3", label: "Development Pitch", desc: "9v9", format: "9v9", siteId: "community-campus", innerOf: null, independent: false, surface: "grass" },
  { id: "P3a", label: "Development 7v7", desc: "7v7 inside Development Pitch", format: "7v7", siteId: "community-campus", innerOf: "P3", independent: false, surface: "grass" },
  { id: "P4", label: "Academy Pitch", desc: "Youth 11v11", format: "11v11-youth", siteId: "community-campus", innerOf: null, independent: false, surface: "grass" },
  { id: "P5", label: "Mini Soccer Zone", desc: "Dedicated 7v7", format: "7v7", siteId: "community-campus", innerOf: null, independent: true, surface: "grass" },
  { id: "3v3", label: "Foundation Zone", desc: "3v3 and 5v5 grid", format: "3v3", siteId: "community-campus", innerOf: null, independent: true, surface: "grass" },
  { id: "AST", label: "Riverside 3G Full", desc: "Full 3G pitch", format: "11v11", siteId: "riverside-3g", innerOf: null, independent: true, astroOnly: true, affectsParking: false, surface: "3g" },
  { id: "AST-A", label: "Riverside 3G Half A", desc: "Half-pitch training area", format: "9v9", siteId: "riverside-3g", innerOf: "AST", independent: true, astroOnly: true, affectsParking: false, surface: "3g" },
  { id: "AST-B", label: "Riverside 3G Half B", desc: "Half-pitch training area", format: "9v9", siteId: "riverside-3g", innerOf: "AST", independent: true, astroOnly: true, affectsParking: false, surface: "3g" },
]);

const TEAM_ROWS = [
  ["U7 Comets", "youth", "3v3", "3v3", "P5", 1, "Saturday", 40],
  ["U8 Rockets", "youth", "5v5", "P5", "3v3", 2, "Saturday", 40],
  ["U9 Falcons", "youth", "7v7", "P5", "P3a", 3, "Saturday", 50],
  ["U9 Lionesses", "girls", "7v7", "P5", "P2a", 3, "Sunday", 50],
  ["U10 Hawks", "youth", "7v7", "P3a", "P2a", 4, "Saturday", 50],
  ["U10 Panthers", "youth", "7v7", "P2a", "P5", 4, "Sunday", 50],
  ["U11 Athletic", "youth", "9v9", "P3", "P1a", 5, "Saturday", 60],
  ["U11 United", "youth", "9v9", "P1a", "P3", 5, "Sunday", 60],
  ["U12 City", "youth", "9v9", "P3", "P1a", 6, "Saturday", 60],
  ["U12 Lionesses", "girls", "9v9", "P1a", "P3", 6, "Sunday", 60],
  ["U13 Rangers", "youth", "11v11-youth", "P4", "P2", 7, "Saturday", 70],
  ["U13 Wanderers", "youth", "11v11-youth", "P4", "P2", 7, "Sunday", 70],
  ["U14 Athletic", "youth", "11v11-youth", "P2", "P4", 8, "Saturday", 70],
  ["U14 Lionesses", "girls", "11v11-youth", "P4", "P2", 8, "Sunday", 70],
  ["U15 United", "youth", "11v11-youth", "P4", "P2", 9, "Saturday", 80],
  ["U16 Academy", "youth", "11v11-youth", "P2", "P4", 10, "Sunday", 80],
  ["U17 Development", "youth", "11v11-youth", "P4", "P2", 11, "Sunday", 80],
  ["Women First", "women", "11v11", "P1", "P2", 12, "Sunday", 90],
  ["Men First", "adult", "11v11", "P1", "P2", 12, "Saturday", 90],
  ["Men Reserves", "adult", "11v11", "P2", "P1", 12, "Saturday", 90],
  ["Veterans", "veterans", "11v11-small", "P2", "P4", 13, "Sunday", 90],
  ["Inclusive Football", "inclusive", "7v7", "P5", "P3a", 13, "Sunday", 60],
];

export const ACQUISITION_DEMO_TEAMS = Object.freeze(TEAM_ROWS.map((row, index) => ({
  id: `nw-team-${String(index + 1).padStart(2, "0")}`,
  name: row[0], teamType: row[1], format: row[2], defaultPitch: row[3], altPitch: row[4], ageOrder: row[5], day: row[6], gameMins: row[7],
})));

const coaches = ["Alex Morgan", "Jordan Ellis", "Taylor Brooks", "Morgan Reed", "Casey Bennett", "Jamie Foster", "Robin Clarke", "Sam Patel", "Cameron Hughes", "Riley Turner", "Charlie Evans", "Drew Harrison", "Avery Collins", "Hayden Walker", "Quinn Foster", "Reese Murphy", "Parker Green", "Finley Cooper", "Rowan Bailey", "Blake Ward", "Skyler Hall", "Emerson Price"];

export const ACQUISITION_DEMO_CONTACTS = Object.freeze(ACQUISITION_DEMO_TEAMS.map((team, index) => ({
  teamKey: team.id,
  teamName: team.name,
  coachName: coaches[index],
  coachEmail: `${coaches[index].toLowerCase().replaceAll(" ", ".")}@northwestcommunity.example`,
  coachPhone: `07000 ${String(301000 + index).slice(-6)}`,
  preferredChannel: index % 3 === 0 ? "whatsapp" : "email",
  receiveMatchdayMessages: true,
  privacyNoticeProvidedAt: "2026-06-10T10:00:00.000Z",
  lastVerifiedAt: "2026-07-18T09:00:00.000Z",
  assistantEnabled: index % 4 === 0,
  assistantName: index % 4 === 0 ? `Assistant ${index + 1}` : "",
  assistantEmail: index % 4 === 0 ? `assistant.${index + 1}@northwestcommunity.example` : "",
  assistantPhone: index % 4 === 0 ? `07000 ${String(401000 + index).slice(-6)}` : "",
})));

export const ACQUISITION_DEMO_OFFICIALS = Object.freeze([
  { id: "ref-1", name: "Chris Nolan", phone: "07000 510001", email: "chris.nolan@officials.example", level: "Level 5", status: "available" },
  { id: "ref-2", name: "Pat Dawson", phone: "07000 510002", email: "pat.dawson@officials.example", level: "Level 6", status: "available" },
  { id: "ref-3", name: "Lee Warren", phone: "07000 510003", email: "lee.warren@officials.example", level: "Level 5", status: "available" },
  { id: "ref-4", name: "Morgan Bell", phone: "07000 510004", email: "morgan.bell@officials.example", level: "Level 7", status: "limited" },
  { id: "ref-5", name: "Jamie Reid", phone: "07000 510005", email: "jamie.reid@officials.example", level: "Level 6", status: "available" },
]);

function fixture(id, day, home, away, pitchId, koTime, format, referee, status = "active", extra = {}) {
  const [hour, minute] = koTime.split(":").map(Number);
  const mins = hour * 60 + minute;
  return {
    id, fixtureId: id, fixtureDayKey: day, __day: day,
    homeTeam: `${ACQUISITION_DEMO_CLUB.name} ${home}`,
    awayTeam: away,
    league: extra.league || (home.includes("Men") ? "County Premier League" : home.includes("Women") ? "County Women's League" : "Greater Manchester Youth League"),
    status, pitchId, koTime, koMins: mins, endMins: mins + (extra.gameMins || 90),
    referee, refStatus: referee ? "Confirmed" : "TBC", format,
    cfg: { name: home, format, defaultPitch: pitchId, altPitch: extra.altPitch || null, teamType: extra.teamType || "youth", gameMins: extra.gameMins || 70 },
    usingAlt: false, usingAstro: pitchId.startsWith("AST"), usingFallback: false,
    attendanceEstimate: extra.attendanceEstimate || 42,
    notes: extra.notes || "",
  };
}

export const ACQUISITION_DEMO_SATURDAY = Object.freeze([
  fixture("sat-01", "saturday", "U7 Comets", "Bolton Juniors U7", "3v3", "09:00", "3v3", "", "active", { gameMins: 40, attendanceEstimate: 46 }),
  fixture("sat-02", "saturday", "U9 Falcons", "Westside U9", "P5", "09:00", "7v7", "Pat Dawson", "active", { gameMins: 50 }),
  fixture("sat-03", "saturday", "U10 Hawks", "Riverside Reds U10", "P3a", "09:15", "7v7", "", "active", { gameMins: 50 }),
  fixture("sat-04", "saturday", "U11 Athletic", "County Juniors U11", "P3", "09:00", "9v9", "Lee Warren", "active", { gameMins: 60 }),
  fixture("sat-05", "saturday", "U12 City", "Ashton Athletic U12", "P1a", "10:30", "9v9", "Morgan Bell", "active", { gameMins: 60 }),
  fixture("sat-06", "saturday", "U13 Rangers", "Prestwich U13", "P4", "09:30", "11v11-youth", "Jamie Reid", "active", { gameMins: 70 }),
  fixture("sat-07", "saturday", "U14 Athletic", "Westhoughton U14", "P2", "10:45", "11v11-youth", "Chris Nolan", "active", { gameMins: 70, notes: "North Grass inspection required" }),
  fixture("sat-08", "saturday", "U15 United", "Wigan Community U15", "P4", "12:00", "11v11-youth", "", "active", { gameMins: 80 }),
  fixture("sat-09", "saturday", "Men First", "Brookfield FC", "P1", "14:00", "11v11", "Chris Nolan", "active", { gameMins: 90, teamType: "adult", attendanceEstimate: 118 }),
  fixture("sat-10", "saturday", "Men Reserves", "Moss Lane FC", "P2", "14:00", "11v11", "", "active", { gameMins: 90, teamType: "adult", attendanceEstimate: 74, notes: "Affected if North Grass closes" }),
]);

export const ACQUISITION_DEMO_SUNDAY = Object.freeze([
  fixture("sun-01", "sunday", "U9 Lionesses", "Rochdale Girls U9", "P5", "09:00", "7v7", "Pat Dawson", "active", { gameMins: 50 }),
  fixture("sun-02", "sunday", "U11 United", "Leigh Rangers U11", "P3", "09:15", "9v9", "Lee Warren", "active", { gameMins: 60 }),
  fixture("sun-03", "sunday", "U12 Lionesses", "Bury Girls U12", "P1a", "10:45", "9v9", "Morgan Bell", "active", { gameMins: 60 }),
  fixture("sun-04", "sunday", "U14 Lionesses", "Salford Girls U14", "P4", "10:30", "11v11-youth", "Jamie Reid", "active", { gameMins: 70 }),
  fixture("sun-05", "sunday", "Women First", "Chorley Women", "P1", "14:00", "11v11", "Chris Nolan", "active", { gameMins: 90, teamType: "women", attendanceEstimate: 91 }),
  fixture("sun-06", "sunday", "Veterans", "Eagley Veterans", "P2", "14:00", "11v11-small", "", "active", { gameMins: 90, teamType: "veterans" }),
]);

export const ACQUISITION_DEMO_MIDWEEK = Object.freeze([
  fixture("mid-01", "midweek", "U16 Academy", "Radcliffe Academy U16", "AST", "19:00", "11v11-youth", "Lee Warren", "active", { gameMins: 80 }),
  fixture("mid-02", "midweek", "Men First", "County Cup Opponent", "P1", "19:30", "11v11", "Chris Nolan", "active", { gameMins: 90, teamType: "adult", league: "County Cup", attendanceEstimate: 146 }),
  fixture("mid-03", "midweek", "U10 Panthers", "Farnworth U10", "P5", "18:00", "7v7", "", "active", { gameMins: 50 }),
]);

export const ACQUISITION_DEMO_UNRESOLVED = Object.freeze([
  { id: "unresolved-1", fixtureDayKey: "saturday", homeTeam: `${ACQUISITION_DEMO_CLUB.name} U8 Rockets`, awayTeam: "Darwen Juniors U8", league: "Greater Manchester Youth League", reason: "Referee confirmation required", status: "unresolved", format: "5v5", cfg: { name: "U8 Rockets", format: "5v5", gameMins: 40 } },
]);

export const ACQUISITION_DEMO_CLOSURE = Object.freeze({
  id: "closure-north-grass", pitchId: "P2", pitchName: "North Grass", date: "2026-07-25", startsOn: "2026-07-25", endsOn: "2026-07-25", reason: "Waterlogged after overnight rain", status: "active", source: "demo", linkedPitchIds: ["P2", "P2a"],
});

export const ACQUISITION_DEMO_HISTORY = Object.freeze([
  { id: "hist-1", savedAt: "2026-07-18T16:30:00.000Z", weekLabel: "18–20 July 2026", date: "2026-07-18", satDate: "2026-07-18", sunDate: "2026-07-19", satFinal: ACQUISITION_DEMO_SATURDAY.slice(0, 8), sunFinal: ACQUISITION_DEMO_SUNDAY.slice(0, 5), midweekFinal: [], teamCfg: ACQUISITION_DEMO_TEAMS, pitchCfg: ACQUISITION_DEMO_PITCHES },
  { id: "hist-2", savedAt: "2026-07-11T16:10:00.000Z", weekLabel: "11–13 July 2026", date: "2026-07-11", satDate: "2026-07-11", sunDate: "2026-07-12", satFinal: ACQUISITION_DEMO_SATURDAY.slice(0, 9), sunFinal: ACQUISITION_DEMO_SUNDAY.slice(0, 6), midweekFinal: ACQUISITION_DEMO_MIDWEEK.slice(0, 2), teamCfg: ACQUISITION_DEMO_TEAMS, pitchCfg: ACQUISITION_DEMO_PITCHES },
]);

export const ACQUISITION_DEMO_PLANNER = Object.freeze({
  settings: { requireApproval: true, defaultStatus: "provisional", defaultTrainingDurationMinutes: 90, showCostsToSchedulers: true },
  bookings: [
    { id: "book-1", title: "Women First training", bookingType: "training", status: "confirmed", teamKey: "nw-team-18", teamName: "Women First", venueId: "riverside-3g", venueName: "Riverside 3G Centre", pitchId: "AST", pitchName: "Riverside 3G Full", pitchAreaId: "full-pitch", pitchAreaName: "Full pitch", startAt: dateAt(-2, "19:00"), endAt: dateAt(-2, "20:30"), startDate: "2026-07-23", startTime: "19:00", endTime: "20:30", costPence: 7200, financeStatus: "approved" },
    { id: "book-2", title: "U15 United recurring training", bookingType: "training", status: "confirmed", teamKey: "nw-team-15", teamName: "U15 United", venueId: "riverside-3g", venueName: "Riverside 3G Centre", pitchId: "AST-A", pitchName: "Riverside 3G Half A", pitchAreaId: "half-a", pitchAreaName: "Half A", startAt: dateAt(2, "18:00"), endAt: dateAt(2, "19:30"), startDate: "2026-07-27", startTime: "18:00", endTime: "19:30", recurrence: "weekly", recurrenceUntil: "2026-12-14", costPence: 3600, financeStatus: "approved" },
    { id: "book-3", title: "U16 Academy friendly", bookingType: "friendly", status: "requested", teamKey: "nw-team-16", teamName: "U16 Academy", opponentName: "Oldham Academy", venueId: "community-campus", venueName: "Community Sports Campus", pitchId: "P1", pitchName: "Stadium Pitch", pitchAreaId: "full-pitch", pitchAreaName: "Full pitch", startAt: dateAt(1, "11:00"), endAt: dateAt(1, "13:00"), startDate: "2026-07-26", startTime: "11:00", endTime: "13:00", costPence: 0, financeStatus: "unreconciled" },
    { id: "book-4", title: "U11 Athletic training", bookingType: "training", status: "confirmed", teamKey: "nw-team-07", teamName: "U11 Athletic", venueId: "community-campus", venueName: "Community Sports Campus", pitchId: "P3", pitchName: "Development Pitch", pitchAreaId: "full-pitch", pitchAreaName: "Full pitch", startAt: dateAt(3, "18:00"), endAt: dateAt(3, "19:15"), startDate: "2026-07-28", startTime: "18:00", endTime: "19:15", costPence: 0, financeStatus: "not_required" },
  ],
  blackouts: [{ id: "blackout-1", startsOn: "2026-08-29", endsOn: "2026-08-31", reason: "Community festival weekend", scopeType: "site", scopeId: "community-campus", status: "active" }],
  pitchClosures: [ACQUISITION_DEMO_CLOSURE],
  closureImpacts: [{ id: "impact-1", closureId: ACQUISITION_DEMO_CLOSURE.id, bookingId: "book-4", status: "alternative_offered", proposedPitchId: "AST-A", proposedPitchName: "Riverside 3G Half A", proposedStartAt: dateAt(3, "19:30") }],
  winterSites: [{ id: "winter-1", name: "Riverside 3G Centre", postcode: "M99 2GC", active: true, contractStart: "2026-09-01", contractEnd: "2027-03-31", weeklyCostPence: 22000 }],
  winterSlots: [{ id: "winter-slot-1", winterSiteId: "winter-1", dayOfWeek: 1, startTime: "18:00", endTime: "21:00", pitchAreaId: "half-a", capacity: 2 }],
  allocationPreferences: [{ id: "pref-1", teamKey: "nw-team-15", teamName: "U15 United", preferredDays: [1, 3], preferredStartTimes: ["18:00", "19:00"], status: "approved" }],
  allocationRuns: [{ id: "run-1", status: "completed", createdAt: "2026-07-20T09:00:00.000Z", teamsConsidered: 18, allocatedCount: 16, waitlistCount: 2 }],
  allocationItems: [{ id: "alloc-1", runId: "run-1", teamKey: "nw-team-15", status: "allocated", pitchId: "AST-A", dayOfWeek: 1, startTime: "18:00", endTime: "19:30", score: 94 }],
  schedulingPolicies: [{ id: "policy-1", name: "Regular-season training", appliesTo: "all", excludeWeekend: true, status: "active" }],
  preferenceProposals: [], resources: [], waitlist: [{ id: "wait-1", teamKey: "nw-team-03", teamName: "U9 Falcons", status: "waiting", priority: "normal" }], seasonRollovers: [], waitlistOffers: [], bulkCommands: [], calendarFeeds: [],
});

export const ACQUISITION_DEMO_COACH_WORKSPACE = Object.freeze({
  club: { id: ACQUISITION_DEMO_CLUB.id, name: ACQUISITION_DEMO_CLUB.name },
  person: { id: "demo-coach", display_name: "Alex Morgan", email: "alex.morgan@northwestcommunity.example", mobile: "07000 301000" },
  assignments: [{ id: "assign-1", team_id: "nw-team-01", team_key: "nw-team-01", team_name: "U7 Comets", staff_role: "head_coach", is_primary: true }],
  bookings: ACQUISITION_DEMO_PLANNER.bookings,
  requests: [{ id: "request-1", title: "Pre-season friendly", request_type: "friendly", status: "alternative_offered", team_key: "nw-team-01", team_name: "U7 Comets", preferred_start_at: dateAt(8, "10:00"), preferred_end_at: dateAt(8, "11:30"), preferred_pitch_id: "P5", preferred_pitch_name: "Mini Soccer Zone", proposed_start_at: dateAt(8, "12:00"), proposed_pitch_id: "P3a", proposed_pitch_name: "Development 7v7", notes: "Opposition confirmed" }],
  messages: [{ id: "message-1", subject: "North Grass closure", body: "North Grass is unavailable. Your updated allocation is now visible in the shared calendar.", created_at: "2026-07-21T09:20:00.000Z", read_at: null, acknowledgement_required: true, acknowledged_at: null }],
  reminders: [{ id: "reminder-1", title: "Confirm Saturday squad", due_at: dateAt(-1, "18:00"), status: "open" }],
  closures: [ACQUISITION_DEMO_CLOSURE], alternatives: [], unavailable: false,
});

const leagueTeams = ["Alder Athletic", "Brookfield", "County Rovers", "Eastside United", "Moss Lane", "Northwest Community", "Riverside FC", "Westfield Town"];
const leagueClubs = leagueTeams.map((name, index) => ({ id: `club-${index + 1}`, name, short_name: name.split(" ")[0], status: "active" }));
const leagueVenues = leagueTeams.map((name, index) => ({ id: `venue-${index + 1}`, name: `${name} Ground`, address: `${index + 1} Football Road`, postcode: `M${90 + index} 1AA`, status: "active", simultaneous_fixture_limit: index === 5 ? 4 : 1, latitude: 53.56 + index * 0.01, longitude: -2.45 + index * 0.012 }));
const divisionTeams = leagueTeams.map((name, index) => ({ id: `league-team-${index + 1}`, name: `${name} First`, short_name: name, parent_club_id: `club-${index + 1}`, division_id: "division-prem", season_id: "season-2627", home_venue_id: `venue-${index + 1}`, status: "active", sort_order: index + 1 }));
const leagueFixtures = Array.from({ length: 16 }, (_, index) => {
  const home = divisionTeams[index % divisionTeams.length];
  const away = divisionTeams[(index + 3) % divisionTeams.length];
  return { id: `league-fixture-${index + 1}`, season_id: "season-2627", division_id: "division-prem", home_team_id: home.id, away_team_id: away.id, venue_id: home.home_venue_id, scheduled_date: `2026-${index < 8 ? "08" : "09"}-${String(8 + (index % 8) * 7).padStart(2, "0")}`, kick_off: "14:00", status: index === 4 ? "postponed" : "scheduled", competition_type: "league", meeting_number: 1 };
});

export const ACQUISITION_DEMO_LEAGUE_WORKSPACE = Object.freeze({
  league: { id: "league-demo", name: "Northwest Community League", slug: "northwest-community-league", product_status: "design_partner", status: "active", country_code: "GB-ENG", governing_body: "Manchester FA", timezone: "Europe/London" },
  access: { role: "owner", can_manage: true, can_operate: true, read_only: false },
  seasons: [{ id: "season-2627", name: "2026/27", starts_on: "2026-08-01", ends_on: "2027-06-30", default_kick_off: "14:00", primary_weekday: 6, is_current: true, status: "active" }],
  divisions: [{ id: "division-prem", season_id: "season-2627", name: "Premier Division", short_name: "PREM", meetings_per_pairing: 2, max_consecutive_home_away: 2, sort_order: 1 }],
  clubs: leagueClubs,
  venues: leagueVenues,
  teams: divisionTeams,
  blackouts: [{ id: "league-blackout-1", starts_on: "2026-12-26", ends_on: "2027-01-02", reason: "Christmas shutdown", scope_type: "league", status: "active" }],
  playing_dates: Array.from({ length: 18 }, (_, i) => ({ id: `date-${i + 1}`, season_id: "season-2627", playing_date: `2026-${i < 8 ? "08" : i < 12 ? "09" : "10"}-${String(1 + (i % 8) * 7).padStart(2, "0")}`, status: "available", playing_weekday: 6 })),
  fixtures: leagueFixtures,
  cups: [{ id: "cup-1", season_id: "season-2627", name: "League Challenge Cup", status: "active", final_date: "2027-05-08", final_venue_id: "venue-6", draw_mode: "seeded" }],
  cup_divisions: [{ id: "cup-division-1", cup_id: "cup-1", division_id: "division-prem", included: true }],
  cup_team_overrides: [], cup_rounds: [{ id: "cup-round-1", cup_id: "cup-1", name: "Quarter-final", round_number: 3, scheduled_date: "2027-02-13" }], cup_ties: [],
  members: [{ id: "member-1", user_id: "demo-owner", display_name: "Jordan Blake", email: "founder@daxora.example", role: "owner" }, { id: "member-2", user_id: "demo-fixtures", display_name: "Morgan Secretary", email: "fixtures@league.example", role: "fixtures" }],
  invitations: [], audit: [{ id: "audit-1", action: "league.fixture_programme_generated", actor_label: "Morgan Secretary", actor_role: "fixtures", created_at: "2026-07-20T14:10:00.000Z" }],
});

export const ACQUISITION_DEMO_LEAGUE_OPERATIONS = Object.freeze({
  access: { can_manage_officials: true, can_operate: true, can_manage: true },
  officials: ACQUISITION_DEMO_OFFICIALS.map((row, index) => ({ id: row.id, name: row.name, email: row.email, mobile: row.phone, grade: row.level, status: row.status, can_referee: true, can_assistant: index < 3, max_appointments_per_day: 2, home_postcode: "M99 1AA" })),
  availability: [], conflicts: [],
  requirements: [{ id: "req-league", scope_type: "league", referee_count: 1, assistant_count: 0 }, { id: "req-prem", scope_type: "division", scope_id: "division-prem", referee_count: 1, assistant_count: 2, minimum_grade: "Level 6" }],
  assignments: leagueFixtures.slice(0, 8).map((row, index) => ({ id: `assignment-${index + 1}`, target_type: "fixture", target_id: row.id, official_id: ACQUISITION_DEMO_OFFICIALS[index % ACQUISITION_DEMO_OFFICIALS.length].id, role: "referee", status: index === 3 ? "awaiting" : "confirmed" })),
  postponements: [{ id: "postponement-1", fixture_id: "league-fixture-5", status: "awaiting_club_response", reason: "Waterlogged pitch", original_date: leagueFixtures[4].scheduled_date, deadline_on: "2026-08-30" }],
  venue_positions: leagueVenues,
});

export const ACQUISITION_DEMO_LEAGUE_COMMAND = Object.freeze({
  clubOperations: { change_requests: [{ id: "change-1", status: "submitted", request_type: "venue_change", requested_by_club_id: "club-2" }], acknowledgements: [], publications: [] },
  results: { submissions: [{ id: "result-1", fixture_id: "league-fixture-1", status: "pending_verification", home_score: 2, away_score: 1 }], tables: [], sanctions: [] },
  discipline: { cases: [{ id: "case-1", case_number: "DISC-001", status: "open", response_due_on: "2026-08-12", fine_amount_pence: 2500, fine_status: "unpaid" }], charges: [], responses: [], hearings: [], decisions: [], fines: [] },
  registrations: { players: [], registrations: [{ id: "reg-1", status: "pending", team_id: "league-team-3", player_name: "Fictional Player" }], transfers: [{ id: "transfer-1", status: "pending" }], eligibility_exceptions: [], team_sheets: [] },
  finance: { invoices: [{ id: "invoice-1", status: "overdue", total_pence: 14900, due_on: "2026-07-10" }], fines: [{ id: "fine-1", status: "unbilled", amount_pence: 2500 }], expenses: [] },
  scheduleVersions: [{ id: "version-1", status: "published", name: "2026/27 Published Programme", season_id: "season-2627", created_at: "2026-07-20T12:00:00.000Z" }],
  scheduleVersion: { version: { id: "version-1", status: "published", season_id: "season-2627" }, entries: leagueFixtures.map((row, index) => ({ id: `entry-${index + 1}`, version_id: "version-1", season_id: row.season_id, division_id: row.division_id, home_team_id: row.home_team_id, away_team_id: row.away_team_id, venue_id: row.venue_id, scheduled_date: row.scheduled_date, kick_off: row.kick_off, placement_status: "placed", status: row.status, round_number: Math.floor(index / 4) + 1, meeting_number: 1 })) },
});

export const ACQUISITION_DEMO_COMMUNICATION_EVENTS = Object.freeze([
  { id: "comm-1", message_key: "sat-09", team_name: "Men First", action: "delivered", channel: "email", recipient_label: "Blake Ward", recipient_hint: "b***@northwestcommunity.example", created_at: "2026-07-20T17:12:00.000Z" },
  { id: "comm-2", message_key: "sat-07", team_name: "U14 Athletic", action: "queued", channel: "whatsapp", recipient_label: "Avery Collins", recipient_hint: "•••• 301012", created_at: "2026-07-21T09:22:00.000Z" },
]);

export const ACQUISITION_DEMO_MEMBERSHIPS = Object.freeze([{ clubId: ACQUISITION_DEMO_CLUB.id, role: "owner", club: { id: ACQUISITION_DEMO_CLUB.id, name: ACQUISITION_DEMO_CLUB.name, sport: "Football" }, displayRole: "Owner", isSupport: false }]);

export const ACQUISITION_DEMO_SUBSCRIPTION = Object.freeze({
  clubId: ACQUISITION_DEMO_CLUB.id, planCode: "elite", planName: "Elite", status: "internal", statusLabel: "Internal demonstration", accessState: "full", canWrite: true, isReadOnly: false, isInternal: true, billingExempt: true,
  features: new Set(["dashboard", "club_profile", "fixture_import", "resource_registry", "communications", "matchday_scheduling", "midweek_scheduling", "operations_advanced", "pitch_intelligence", "parking_intelligence", "weather_intelligence", "officials_management", "reports_operations", "reports_advanced", "analytics_core", "analytics_advanced", "data_export", "multi_venue", "annual_planner", "coach_hub", "organisation_command", "executive_reporting", "governance_controls", "approval_workflows", "site_responsibility", "communication_governance", "funding_portfolio", "enhanced_audit", "advanced_integrations"]),
  limits: { teams: 60, venues: 8, users: 25, pitches: 80, history_entries: 260, history_retention_days: 1095 },
});

export const ACQUISITION_DEMO_WORKSPACE_ACCESS = Object.freeze({ role: "owner", roleLabel: "Club owner", canOperate: true, canPublish: true, canManageSettings: false, canManageMembers: true, canManageSubscription: false, canViewAudit: true, isReadOnly: false, isCoach: false, isSupport: false });

export const ACQUISITION_DEMO_AUTH = Object.freeze({ access_token: "acquisition-demo-local-only", user: { id: "demo-founder", email: "founder@daxora.example", user_metadata: { display_name: "Jordan Blake" } } });

export function acquisitionDemoSeed() {
  return {
    club: ACQUISITION_DEMO_CLUB,
    pitches: ACQUISITION_DEMO_PITCHES,
    teams: ACQUISITION_DEMO_TEAMS,
    contacts: ACQUISITION_DEMO_CONTACTS,
    officials: ACQUISITION_DEMO_OFFICIALS,
    saturday: ACQUISITION_DEMO_SATURDAY,
    sunday: ACQUISITION_DEMO_SUNDAY,
    midweek: ACQUISITION_DEMO_MIDWEEK,
    unresolved: ACQUISITION_DEMO_UNRESOLVED,
    planner: ACQUISITION_DEMO_PLANNER,
    coach: ACQUISITION_DEMO_COACH_WORKSPACE,
    leagueWorkspace: ACQUISITION_DEMO_LEAGUE_WORKSPACE,
    leagueOperations: ACQUISITION_DEMO_LEAGUE_OPERATIONS,
  };
}
