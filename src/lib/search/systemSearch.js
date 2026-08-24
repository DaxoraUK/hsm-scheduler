import { NAV_TARGETS } from "../navigation/navigationTargets.js";

const SEARCH_CATALOGUE = Object.freeze([
  { id: "mission-control", label: "Mission Control", description: "Matchweek status, readiness and next actions", keywords: "home dashboard overview readiness pilot", page: "dashboard", target: NAV_TARGETS.MISSION_CONTROL },
  { id: "club-command", label: "Club Command", description: "Organisation oversight and executive actions", keywords: "executive organisation board governance", page: "executive", target: NAV_TARGETS.EXECUTIVE },
  { id: "operations", label: "Operations", description: "Matchweek control centre", keywords: "control room matchday schedule", page: "operations", target: NAV_TARGETS.OPERATIONS },
  { id: "fixtures", label: "Fixtures", description: "Build, resolve and review fixtures", keywords: "matches schedule teams opposition", page: "operations", target: NAV_TARGETS.FIXTURES },
  { id: "resources", label: "Resources and pitch closures", description: "Pitches, closures and venue resources", keywords: "ground resources closed pitch", page: "operations", target: NAV_TARGETS.RESOURCES },
  { id: "officials", label: "Officials", description: "Referee assignments and conflicts", keywords: "ref referee assignments tbc", page: "operations", target: NAV_TARGETS.OFFICIALS },
  { id: "parking", label: "Parking intelligence", description: "Vehicle demand and venue capacity", keywords: "cars car park capacity", page: "operations", target: NAV_TARGETS.PARKING },
  { id: "weather", label: "Weather intelligence", description: "Forecast and pitch-risk guidance", keywords: "rain wind forecast postponement", page: "operations", target: NAV_TARGETS.WEATHER },
  { id: "recommendations", label: "Recommendations", description: "Operational intelligence and review actions", keywords: "warnings advice issues", page: "operations", target: NAV_TARGETS.RECOMMENDATIONS },
  { id: "annual-planner", label: "Annual Planner", description: "Training, friendlies and shared calendar", keywords: "booking pitch training requests", page: "planner", target: NAV_TARGETS.PLANNER },
  { id: "coach-hub", label: "Coach Hub", description: "Coach requests, messages and team workspace", keywords: "manager calendar training preferences", page: "coach", action: "coach" },
  { id: "league-manager", label: "League Manager", description: "League competitions, fixtures, clubs and officials", keywords: "league divisions competitions cups registrations discipline", page: "league", action: "page" },
  { id: "daxora-admin", label: "Daxora Admin", description: "Platform subscriptions, support and governance", keywords: "platform admin health support cases pilots launch", page: "platform", action: "page" },
  { id: "communications", label: "Communications", description: "Prepare and send club updates", keywords: "messages email whatsapp coaches publish", page: "communications", target: NAV_TARGETS.COMMUNICATIONS },
  { id: "analytics", label: "Analytics", description: "Operational trends and intelligence", keywords: "statistics stats insights performance", page: "analytics", target: NAV_TARGETS.ANALYTICS },
  { id: "reports", label: "Reports and exports", description: "Print, PDF and operational evidence", keywords: "download csv print pdf", page: "reports", target: NAV_TARGETS.REPORTS },
  { id: "settings-overview", label: "Settings overview", description: "Club configuration and setup progress", keywords: "configuration setup", page: "settings", target: NAV_TARGETS.SETTINGS, options: { settingsTab: "overview" } },
  { id: "settings-teams", label: "Team settings", description: "Team names, formats and external fixture aliases", keywords: "teams format alias external fixture names", page: "settings", target: NAV_TARGETS.TEAMS },
  { id: "settings-pitches", label: "Pitch settings", description: "Pitch formats, capacity and availability", keywords: "pitches surface facilities", page: "settings", target: NAV_TARGETS.PITCHES },
  { id: "settings-venues", label: "Venue and site settings", description: "Grounds, parking and weather locations", keywords: "club ground address postcode sites", page: "settings", target: NAV_TARGETS.VENUES },
  { id: "settings-fixture-sources", label: "Fixture sources", description: "Full-Time feeds and integration status", keywords: "integration full time fa snippet feed import", page: "settings", target: NAV_TARGETS.INTEGRATIONS },
  { id: "settings-access", label: "Members, roles and invitations", description: "User access, permissions and audit", keywords: "access security users permissions invite resend", page: "settings", target: NAV_TARGETS.SETTINGS, options: { settingsTab: "access" } },
  { id: "settings-officials", label: "Officials pool settings", description: "Available referees and volunteers", keywords: "refs referee official pool", page: "settings", target: NAV_TARGETS.SETTINGS, options: { settingsTab: "refs" } },
  { id: "settings-history", label: "Matchweek history", description: "Saved schedules and restore points", keywords: "backup previous saved restore rollback", page: "settings", target: NAV_TARGETS.SETTINGS, options: { settingsTab: "history" } },
  { id: "settings-plan", label: "Plan and subscription", description: "Package, limits and billing access", keywords: "subscription core pro elite upgrade billing", page: "settings", target: NAV_TARGETS.SETTINGS, options: { settingsTab: "subscription" } },
]);

function text(value) { return String(value || "").trim().toLowerCase(); }

function score(haystack, query) {
  if (!query) return 1;
  if (haystack.startsWith(query)) return 100;
  const words = query.split(/\s+/).filter(Boolean);
  if (!words.every((word) => haystack.includes(word))) return 0;
  return 50 + words.reduce((total, word) => total + (haystack.includes(` ${word}`) ? 4 : 1), 0);
}

function fixtureResult(fixture, day, index) {
  const home = fixture.homeTeam || fixture.team || "Home team";
  const away = fixture.awayTeam || fixture.opposition || "Opposition";
  const pitch = fixture.pitch || fixture.pitchId || fixture.assignedPitch || "";
  const official = fixture.referee || fixture.ref || fixture.official || "";
  const date = fixture.date || fixture.fixtureDate || "";
  const kickOff = fixture.time || fixture.kickOff || fixture.ko || "";
  return { id: `fixture-${day}-${fixture.id || index}`, label: `${home} vs ${away}`, description: [day[0].toUpperCase() + day.slice(1), date, kickOff, pitch, official].filter(Boolean).join(" · "), keywords: [home, away, pitch, official, date, kickOff, fixture.format, fixture.status].filter(Boolean).join(" "), category: "Fixture", page: "operations", target: NAV_TARGETS.FIXTURES, options: { day, card: "schedule", workspace: "fixtures" } };
}

export function buildSystemSearchIndex({ availablePages = [], fixturesByDay = {}, canOpenSettings = false, canOpenCoachHub = false } = {}) {
  const allowed = new Set(availablePages);
  const catalogue = SEARCH_CATALOGUE.filter((item) => item.page === "settings" ? canOpenSettings && allowed.has("settings") : item.page === "coach" ? canOpenCoachHub : allowed.has(item.page)).map((item) => ({ ...item, category: item.page === "settings" ? "Settings" : "Workspace" }));
  const fixtures = allowed.has("operations") ? Object.entries(fixturesByDay).flatMap(([day, rows]) => (Array.isArray(rows) ? rows : []).filter((row) => row?.status !== "postponed").map((row, index) => fixtureResult(row, day, index))) : [];
  return [...catalogue, ...fixtures];
}

export function searchSystem(index = [], query = "", limit = 10) {
  const q = text(query);
  if (!q) return index.filter((item) => item.category === "Workspace").slice(0, Math.max(1, limit));
  return index.map((item) => ({ item, rank: score(text(`${item.label} ${item.description} ${item.keywords}`), q) })).filter((row) => row.rank > 0).sort((a, b) => b.rank - a.rank || a.item.label.localeCompare(b.item.label)).slice(0, Math.max(1, limit)).map((row) => row.item);
}
