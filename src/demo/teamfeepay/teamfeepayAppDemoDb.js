import { Auth, DB } from "../../lib/supabase.js";
import {
  ACQUISITION_DEMO_AUTH,
  ACQUISITION_DEMO_CLUB,
  ACQUISITION_DEMO_COMMUNICATION_EVENTS,
  ACQUISITION_DEMO_CONTACTS,
  ACQUISITION_DEMO_HISTORY,
  ACQUISITION_DEMO_LEAGUE_COMMAND,
  ACQUISITION_DEMO_LEAGUE_OPERATIONS,
  ACQUISITION_DEMO_LEAGUE_WORKSPACE,
  ACQUISITION_DEMO_MEMBERSHIPS,
  ACQUISITION_DEMO_OFFICIALS,
  ACQUISITION_DEMO_PITCHES,
  ACQUISITION_DEMO_PLANNER,
  ACQUISITION_DEMO_SUBSCRIPTION,
  ACQUISITION_DEMO_TEAMS,
} from "./teamfeepayRealDemoData.js";

const originalMethods = new Map();
const originalAuthMethods = new Map();
let active = false;
let communicationEvents = structuredClone(ACQUISITION_DEMO_COMMUNICATION_EVENTS);
let planner = structuredClone(ACQUISITION_DEMO_PLANNER);

function clone(value) {
  return value == null ? value : structuredClone(value);
}

const communicationPrivacy = Object.freeze({
  lawful_basis: "legitimate_interests",
  purpose: "Operational fixture, training and facility communication with adult team coaches and managers.",
  privacy_notice_url: "https://northwestcommunity.example/privacy",
  privacy_contact_email: "privacy@northwestcommunity.example",
  controller_name: ACQUISITION_DEMO_CLUB.name,
  retention_days: 365,
  dpia_status: "screened_no_high_risk",
  configured: true,
});

function subscriptionPayload() {
  return {
    club_id: ACQUISITION_DEMO_CLUB.id,
    plan_code: "elite",
    plan_name: "Elite",
    status: "internal",
    access_state: "full",
    billing_exempt: true,
    entitlement_overrides: Object.fromEntries(
      [...ACQUISITION_DEMO_SUBSCRIPTION.features].map((key) => [key, true]),
    ),
    limit_overrides: ACQUISITION_DEMO_SUBSCRIPTION.limits,
    package_version: "teamfeepay-acquisition-demo",
  };
}

function leagueAccessRows() {
  const league = ACQUISITION_DEMO_LEAGUE_WORKSPACE.league;
  return [{
    league_id: league.id,
    league_name: league.name,
    league_slug: league.slug,
    product_status: league.product_status,
    league_status: league.status,
    country_code: league.country_code,
    governing_body: league.governing_body,
    timezone: league.timezone,
    access_role: "owner",
    read_only: false,
  }];
}

function demoRead(name) {
  const reads = {
    getPlatformOperatorContext: () => ({
      is_platform_staff: false,
      user_id: ACQUISITION_DEMO_AUTH.user.id,
      email: ACQUISITION_DEMO_AUTH.user.email,
      display_name: ACQUISITION_DEMO_AUTH.user.user_metadata.display_name,
      status: "none",
    }),
    listMemberships: () => clone(ACQUISITION_DEMO_MEMBERSHIPS),
    listAccessibleLeagues: () => leagueAccessRows(),
    getClubSubscription: () => subscriptionPayload(),
    getClubOnboarding: () => ({
      status: "complete",
      current_step: 5,
      completed_steps: ["club", "venue", "schedule", "resources", "fixtures", "review"],
      required: false,
      completed_at: "2026-07-01T09:00:00.000Z",
    }),
    getBillingLegalStatus: () => ({
      club_id: ACQUISITION_DEMO_CLUB.id,
      provider: "manual",
      billing_enabled: false,
      legal_acceptance_complete: true,
      checkout_ready: false,
      documents: [],
      business_identity: {
        legal_name: "Daxora acquisition demonstration",
        trading_name: "Daxora",
        support_email: "support@daxora.example",
        privacy_email: "privacy@daxora.example",
      },
    }),
    ping: () => ({ id: ACQUISITION_DEMO_CLUB.id, name: ACQUISITION_DEMO_CLUB.name, status: "active" }),
    loadClub: () => clone(ACQUISITION_DEMO_CLUB),
    loadPitches: () => clone(ACQUISITION_DEMO_PITCHES),
    loadPitchClosures: () => clone(planner.pitchClosures || []),
    loadRefs: () => clone(ACQUISITION_DEMO_OFFICIALS),
    loadTeamCfg: () => clone(ACQUISITION_DEMO_TEAMS),
    loadTeamContacts: () => clone(ACQUISITION_DEMO_CONTACTS),
    loadHistory: () => clone(ACQUISITION_DEMO_HISTORY),
    loadTestFixtures: () => [],
    getCommunicationPrivacy: () => clone(communicationPrivacy),
    listCommunicationEvents: () => clone(communicationEvents),
    listCommunicationDeliveryBatches: () => [],
    exportCommunicationDeliveryData: () => ({ batches: [], deliveries: [] }),
    listAnnualPlannerWorkspace: () => clone(planner),
    getAnnualPlannerAnalyticsData: () => ({
      bookings: clone(planner.bookings || []),
      blackouts: clone(planner.blackouts || []),
      winter_sites: clone(planner.winterSites || planner.winter_sites || []),
      winter_slots: clone(planner.winterSlots || planner.winter_slots || []),
      requests: [],
      allocation_runs: clone(planner.allocationRuns || []),
      allocation_items: clone(planner.allocationItems || []),
      closure_impacts: clone(planner.closureImpacts || []),
      resources: clone(planner.resources || []),
      waitlist: clone(planner.waitlist || []),
      season_rollovers: clone(planner.seasonRollovers || []),
      waitlist_offers: clone(planner.waitlistOffers || []),
      bulk_commands: clone(planner.bulkCommands || []),
      scheduling_policies: clone(planner.schedulingPolicies || []),
    }),
    listAnnualPlannerClosureImpacts: () => clone(planner.closureImpacts || []),
    listCoachHubRequestQueue: () => ({ requests: [] }),
    listCoachHubPilotMetrics: () => ({ people: [], assignments: [], invitations: [], requests: [], messages: [], reminders: [], bookings: [] }),
    getCoachHubWorkspace: () => ({
      club: clone(ACQUISITION_DEMO_CLUB),
      person: { id: "demo-founder", display_name: "Jordan Blake", email: "founder@daxora.example" },
      assignments: [],
      bookings: clone(planner.bookings || []),
      requests: [],
      messages: [],
      team_contacts: clone(ACQUISITION_DEMO_CONTACTS),
      closures: clone(planner.pitchClosures || []),
    }),
    getLeagueWorkspace: () => clone(ACQUISITION_DEMO_LEAGUE_WORKSPACE),
    getLeagueOperationsData: () => clone(ACQUISITION_DEMO_LEAGUE_OPERATIONS),
    getLeagueClubOperationsData: () => clone(ACQUISITION_DEMO_LEAGUE_COMMAND.clubOperations),
    getLeagueResultsData: () => clone(ACQUISITION_DEMO_LEAGUE_COMMAND.results),
    getLeagueDisciplineData: () => clone(ACQUISITION_DEMO_LEAGUE_COMMAND.discipline),
    getLeagueRegistrationData: () => clone(ACQUISITION_DEMO_LEAGUE_COMMAND.registrations),
    getLeagueFinanceData: () => clone(ACQUISITION_DEMO_LEAGUE_COMMAND.finance),
    listLeagueScheduleVersions: () => clone(ACQUISITION_DEMO_LEAGUE_COMMAND.scheduleVersions),
    getLeagueScheduleVersion: () => clone(ACQUISITION_DEMO_LEAGUE_COMMAND.scheduleVersion),
    listEliteCommunicationTemplates: () => [],
    getFundingWorkspace: () => ({ projects: [], applications: [], application_tasks: [], monitoring_obligations: [] }),
    listFundingImpactEvidence: () => [],
    listEliteSiteResponsibilities: () => [],
  };
  return reads[name] ? reads[name]() : undefined;
}

function demoResponse(name, args) {
  const read = demoRead(name);
  if (read !== undefined) return read;

  if (name === "recordCommunicationEvent") {
    const event = args[1] || {};
    const row = { id: `demo-communication-${Date.now()}`, ...event, created_at: new Date().toISOString() };
    communicationEvents = [row, ...communicationEvents];
    return row;
  }

  if (["saveAnnualPlannerBooking", "upsertAnnualPlannerBooking"].includes(name)) {
    const input = args.at(-1) || {};
    const id = input.id || `demo-booking-${Date.now()}`;
    const row = { ...input, id };
    planner.bookings = [...(planner.bookings || []).filter((item) => item.id !== id), row];
    return clone(row);
  }

  if (name === "deleteAnnualPlannerBooking") {
    const id = args[1] || args.at(-1);
    planner.bookings = (planner.bookings || []).filter((item) => item.id !== id);
    return true;
  }

  if (/^(list|load)/i.test(name)) return [];
  if (/^get/i.test(name)) return {};
  return { ok: true, id: `demo-${Date.now()}`, status: "accepted", demo: true };
}

export function activateTeamFeePayAppDemo() {
  if (active) return;
  active = true;
  window.__DAXORA_TEAMFEEPAY_DEMO__ = true;

  const authOverrides = {
    consumeRedirectSession: async () => null,
    getUser: async () => clone(ACQUISITION_DEMO_AUTH.user),
    getValidSession: async () => clone(ACQUISITION_DEMO_AUTH),
    refreshSession: async () => clone(ACQUISITION_DEMO_AUTH),
    signOut: async () => ({ ok: true, demo: true }),
  };

  Object.entries(authOverrides).forEach(([name, method]) => {
    if (typeof Auth[name] === "function") originalAuthMethods.set(name, Auth[name]);
    Auth[name] = method;
  });
  Auth.saveSession(ACQUISITION_DEMO_AUTH);

  Object.entries(DB).forEach(([name, method]) => {
    if (typeof method !== "function") return;
    originalMethods.set(name, method);
    DB[name] = async (...args) => clone(demoResponse(name, args));
  });
}

export function resetTeamFeePayAppDemo() {
  communicationEvents = structuredClone(ACQUISITION_DEMO_COMMUNICATION_EVENTS);
  planner = structuredClone(ACQUISITION_DEMO_PLANNER);
  Auth.saveSession(ACQUISITION_DEMO_AUTH);
}

export function deactivateTeamFeePayAppDemo() {
  originalMethods.forEach((method, name) => {
    DB[name] = method;
  });
  originalMethods.clear();
  originalAuthMethods.forEach((method, name) => {
    Auth[name] = method;
  });
  originalAuthMethods.clear();
  active = false;
  delete window.__DAXORA_TEAMFEEPAY_DEMO__;
}
