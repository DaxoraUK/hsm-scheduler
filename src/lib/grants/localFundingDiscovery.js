const ALL_PROJECT_TYPES = [
  "all",
  "grass-pitch",
  "artificial-pitch",
  "clubhouse",
  "floodlights",
  "equipment",
  "participation",
  "women-girls",
  "disability-inclusion",
  "workforce",
  "parking-access",
  "sustainability",
  "community",
  "asset-transfer",
];

function source(entry) {
  return {
    sourceType: "official-directory",
    projectTypes: ALL_PROJECT_TYPES,
    access: "Free",
    requiresManualVerification: true,
    ...entry,
  };
}

export const LOCAL_FUNDING_DISCOVERY_SOURCES = [
  source({
    id: "gov-find-a-grant",
    nations: ["england", "scotland", "wales", "northern-ireland"],
    title: "Find a Grant",
    organisation: "UK Government",
    scope: "Government grant programmes",
    description: "Search and filter government grants, review eligibility and follow the official application route.",
    officialUrl: "https://www.find-government-grants.service.gov.uk/",
    priority: 95,
  }),
  source({
    id: "local-council-finder",
    nations: ["england", "scotland", "wales", "northern-ireland"],
    title: "Local council funding route",
    organisation: "GOV.UK",
    scope: "Council and place-based funding",
    description: "Use the club postcode to reach the correct council website, then search community grants, sports funding, capital funds and climate schemes.",
    officialUrl: "https://www.gov.uk/find-local-council",
    priority: 100,
  }),
  source({
    id: "uk-community-foundations",
    nations: ["england", "scotland", "wales", "northern-ireland"],
    title: "Find the local community foundation",
    organisation: "UK Community Foundations",
    scope: "Local charitable and community funds",
    description: "Find the foundation serving the club area and review locally managed trusts, donor funds and community programmes.",
    officialUrl: "https://www.ukcommunityfoundations.org/find-a-foundation/",
    priority: 90,
  }),
  source({
    id: "england-county-fa",
    nations: ["england"],
    title: "County FA funding and facilities support",
    organisation: "The Football Association",
    scope: "Football-specific local support",
    description: "Confirm the club's County FA and check local funding notices, facility support, PitchPower guidance and partner schemes.",
    officialUrl: "https://www.thefa.com/about-football-association/who-we-are/county-fas",
    priority: 100,
    projectTypes: ALL_PROJECT_TYPES.filter((type) => type !== "asset-transfer"),
  }),
  source({
    id: "funding-scotland",
    nations: ["scotland"],
    title: "Funding Scotland",
    organisation: "Scottish Council for Voluntary Organisations",
    scope: "Scottish local, national and trust funding",
    description: "Search funding for charities, community groups and social enterprises, including capital and local-area opportunities.",
    officialUrl: "https://funding.scot/",
    priority: 100,
  }),
  source({
    id: "sportscotland-funding",
    nations: ["scotland"],
    title: "sportscotland funding",
    organisation: "sportscotland",
    scope: "Sports participation and facilities",
    description: "Review current sport-specific investment routes, facility guidance and programme criteria.",
    officialUrl: "https://sportscotland.org.uk/funding",
    priority: 95,
  }),
  source({
    id: "funding-wales",
    nations: ["wales"],
    title: "Funding Wales",
    organisation: "Third Sector Support Wales",
    scope: "Welsh local, national and trust funding",
    description: "Search hundreds of funding opportunities by location, purpose and amount. Registration is required.",
    officialUrl: "https://funding.cymru/en/",
    access: "Registration required",
    priority: 100,
  }),
  source({
    id: "sport-wales-funding",
    nations: ["wales"],
    title: "Sport Wales funding",
    organisation: "Sport Wales",
    scope: "Sports facilities, equipment and participation",
    description: "Review current national sports funding routes and application guidance.",
    officialUrl: "https://sport.wales/funding/",
    priority: 95,
  }),
  source({
    id: "ni-government-funding-database",
    nations: ["northern-ireland"],
    title: "Northern Ireland Government Funding Database",
    organisation: "Northern Ireland Executive",
    scope: "Government support for voluntary and community organisations",
    description: "Use the official grant finder for support offered by Northern Ireland government departments.",
    officialUrl: "https://govfundingpublic.nics.gov.uk/Home.aspx",
    priority: 100,
  }),
  source({
    id: "ni-granttracker",
    nations: ["northern-ireland"],
    title: "GrantTracker",
    organisation: "NICVA",
    scope: "Northern Ireland funding database",
    description: "Search NI-relevant schemes, deadlines and application records. Full access is subscription-based.",
    officialUrl: "https://www.grant-tracker.org/",
    access: "Subscription service",
    priority: 95,
  }),
  source({
    id: "ni-community-foundation",
    nations: ["northern-ireland"],
    title: "Community Foundation Northern Ireland",
    organisation: "Community Foundation Northern Ireland",
    scope: "Current local and thematic grant rounds",
    description: "Review the foundation's current open grants and fund-specific eligibility rules.",
    officialUrl: "https://communityfoundationni.org/achieving-impact/available-grants/",
    priority: 90,
  }),
  source({
    id: "sport-ni-funding",
    nations: ["northern-ireland"],
    title: "Sport NI funding",
    organisation: "Sport Northern Ireland",
    scope: "Sports participation and facilities",
    description: "Review current Sport NI investment programmes, facility support and guidance.",
    officialUrl: "https://www.sportni.net/funding/",
    priority: 95,
  }),
];

function valuePresent(value) {
  if (typeof value === "boolean") return true;
  return String(value || "").trim().length > 0;
}

export function buildFundingLocationProfile(defaults = {}) {
  return {
    clubId: defaults.clubId || "",
    postcode: defaults.postcode || defaults.weatherPostcode || "",
    facilityPostcode: defaults.facilityPostcode || defaults.postcode || defaults.weatherPostcode || "",
    homeNation: defaults.homeNation || "",
    country: defaults.country || "",
    region: defaults.region || "",
    localAuthority: defaults.localAuthority || "",
    adminCounty: defaults.adminCounty || "",
    parliamentaryConstituency: defaults.parliamentaryConstituency || "",
    countyFa: defaults.countyFa || "",
    legalStructure: defaults.legalStructure || "",
    affiliation: defaults.affiliation || "",
    charityNumber: defaults.charityNumber || "",
    cascNumber: defaults.cascNumber || "",
    companyNumber: defaults.companyNumber || "",
    tenure: defaults.tenure || "",
    annualIncomeBand: defaults.annualIncomeBand || "",
    latitude: defaults.latitude ?? null,
    longitude: defaults.longitude ?? null,
    postcodeResolvedAt: defaults.postcodeResolvedAt || defaults.resolvedAt || "",
    postcodeSource: defaults.postcodeSource || defaults.source || "",
    updatedAt: defaults.updatedAt || "",
  };
}

export function fundingProfileGaps(profile = {}) {
  const nation = profile.homeNation || "";
  const fields = [
    ["postcode", "Club postcode", "Resolve the club postcode so place-based funds can be checked."],
    ["homeNation", "Home nation", "Confirm the correct home nation because national funding routes differ."],
    ["localAuthority", "Local authority", "Resolve the postcode or enter the council area manually."],
    ["region", "Region", "Resolve the postcode to improve regional matching."],
    ["legalStructure", "Legal structure", "Record whether the club is constituted, a charity, CASC, CIC or another not-for-profit form."],
    ["affiliation", "Football affiliation", "Record the governing body or County FA affiliation used in applications."],
    ["tenure", "Facility tenure", "Summarise ownership, lease or licence arrangements and expiry dates."],
  ];
  if (nation === "england") fields.push(["countyFa", "County FA", "Confirm the County FA so local football funding and facility support can be checked."]);
  return fields
    .filter(([key]) => !valuePresent(profile[key]))
    .map(([key, label, action]) => ({ key, label, action }));
}

export function buildLocalFundingDiscovery({ profile = {}, projectType = "all" } = {}) {
  const nation = profile.homeNation || "england";
  const sources = LOCAL_FUNDING_DISCOVERY_SOURCES
    .filter((entry) => entry.nations.includes(nation))
    .filter((entry) => projectType === "all" || entry.projectTypes.includes(projectType))
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))
    .map((entry) => ({
      ...entry,
      locationLabel: profile.localAuthority
        ? `${profile.localAuthority}${profile.region ? ` · ${profile.region}` : ""}`
        : profile.region || "Location details incomplete",
      reason: entry.id === "local-council-finder"
        ? `Check community, capital, sports and climate funds offered in ${profile.localAuthority || "the club's council area"}.`
        : entry.id === "england-county-fa"
          ? `Use ${profile.countyFa || "the County FA directory"} to confirm football-specific local support.`
          : `Search this source for ${projectType === "all" ? "club development" : projectType.replaceAll("-", " ")} opportunities relevant to the club area.`,
    }));
  const gaps = fundingProfileGaps(profile);
  return {
    nation,
    sources,
    gaps,
    profileScore: Math.max(0, Math.round(((7 + (nation === "england" ? 1 : 0) - gaps.length) / (7 + (nation === "england" ? 1 : 0))) * 100)),
    readyForLocalSearch: Boolean(profile.postcode && profile.homeNation && profile.localAuthority),
    disclaimer: "These are verified official discovery routes, not a guarantee that every local fund is indexed. Each opportunity still needs its own deadline, geography and eligibility check before a club relies on it.",
  };
}

export default buildLocalFundingDiscovery;
