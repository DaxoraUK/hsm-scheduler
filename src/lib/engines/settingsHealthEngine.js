function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function getSites(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites.filter(Boolean) : [];

  if (sites.length) {
    return sites.map((site, index) => ({
      id: site.id || `site-${index + 1}`,
      name: site.name || site.venue || `Site ${index + 1}`,
      venue: site.venue || site.name || "",
      postcode: String(site.postcode || "").trim().toUpperCase(),
      isPrimary: !!site.isPrimary || site.id === club.primarySiteId || (!club.primarySiteId && index === 0),
      carParkSpaces: Number(site.carParkSpaces ?? 0),
      weatherEnabled: site.weatherEnabled !== false,
    }));
  }

  return [
    {
      id: club.primarySiteId || "main-ground",
      name: club.venue || "Main Ground",
      venue: club.venue || "",
      postcode: String(club.postcode || club.weatherPostcode || "").trim().toUpperCase(),
      isPrimary: true,
      carParkSpaces: Number(club.carParkSpaces || 0),
      weatherEnabled: true,
    },
  ];
}

function isAdultTeam(team = {}) {
  const explicitType = normalise(team.teamType || team.type || team.category);
  if (["adult", "open-age", "open age", "senior", "seniors", "veteran", "veterans"].includes(explicitType)) return true;
  if (["youth", "junior", "juniors", "mini", "minis"].includes(explicitType)) return false;

  const name = normalise(team.name || team.teamName || team.label);
  if (/\bu\s?\d{1,2}\b/.test(name)) return false;

  return ["1st team", "first team", "reserves", "reserve", "open age", "open-age", "adult", "senior", "veteran", "vets", "sunday 1sts"].some((term) =>
    name.includes(term)
  );
}

function makeIssue({ domain, title, detail, tab, severity = "warning" }) {
  return { domain, title, detail, tab, severity };
}

export function getSettingsHealth({ club = {}, teamCfg = [], pitchCfg = [], refs = [] } = {}) {
  const sites = getSites(club);
  const siteIds = new Set(sites.map((site) => site.id).filter(Boolean));
  const pitchIds = new Set(pitchCfg.map((pitch) => pitch.id).filter(Boolean));
  const issues = [];

  const primarySite = sites.find((site) => site.isPrimary) || sites[0];

  if (!club.name) {
    issues.push(
      makeIssue({
        domain: "Club",
        title: "Club name missing",
        detail: "Add the club name so exports, messages and reports are correctly branded.",
        tab: "club",
        severity: "critical",
      })
    );
  }

  if (!primarySite?.postcode && !club.postcode) {
    issues.push(
      makeIssue({
        domain: "Venues",
        title: "Primary site postcode missing",
        detail: "Add a postcode so weather intelligence and future map/location features can resolve the ground.",
        tab: "venues",
        severity: "critical",
      })
    );
  }

  if (!club.weatherPostcode && !sites.some((site) => site.weatherEnabled && site.postcode)) {
    issues.push(
      makeIssue({
        domain: "Weather",
        title: "Weather location missing",
        detail: "Enable weather on a site with a postcode, or set a club weather postcode.",
        tab: "venues",
        severity: "warning",
      })
    );
  }

  const sitesWithoutParking = sites.filter((site) => !Number(site.carParkSpaces));
  if (sitesWithoutParking.length) {
    issues.push(
      makeIssue({
        domain: "Venues",
        title: `${sitesWithoutParking.length} site${sitesWithoutParking.length === 1 ? "" : "s"} missing parking capacity`,
        detail: "Set site parking capacity so parking intelligence can calculate pressure correctly per venue.",
        tab: "venues",
        severity: "warning",
      })
    );
  }

  const teamsMissingType = teamCfg.filter((team) => !normalise(team.teamType || team.type || team.category));
  if (teamsMissingType.length) {
    issues.push(
      makeIssue({
        domain: "Teams",
        title: `${teamsMissingType.length} team${teamsMissingType.length === 1 ? "" : "s"} missing Youth/Adult type`,
        detail: "Team type controls competition rule checks, cut-off windows and match duration behaviour.",
        tab: "teams",
        severity: "critical",
      })
    );
  }

  const teamsMissingSite = teamCfg.filter((team) => !team.siteId && !team.homeSiteId);
  if (teamsMissingSite.length) {
    issues.push(
      makeIssue({
        domain: "Teams",
        title: `${teamsMissingSite.length} team${teamsMissingSite.length === 1 ? "" : "s"} missing home site`,
        detail: "Assign teams to a home site so multi-site scheduling and parking forecasts can become site-aware.",
        tab: "teams",
        severity: "warning",
      })
    );
  }

  const teamsWithInvalidPitch = teamCfg.filter((team) => team.defaultPitch && !pitchIds.has(team.defaultPitch));
  if (teamsWithInvalidPitch.length) {
    issues.push(
      makeIssue({
        domain: "Teams",
        title: `${teamsWithInvalidPitch.length} team${teamsWithInvalidPitch.length === 1 ? "" : "s"} using an unknown default pitch`,
        detail: "Review team preferred pitches so the scheduler does not start from a stale pitch reference.",
        tab: "teams",
        severity: "critical",
      })
    );
  }

  const pitchesMissingSite = pitchCfg.filter((pitch) => !pitch.siteId);
  if (pitchesMissingSite.length) {
    issues.push(
      makeIssue({
        domain: "Pitches",
        title: `${pitchesMissingSite.length} pitch${pitchesMissingSite.length === 1 ? "" : "es"} missing site assignment`,
        detail: "Assign every pitch to a venue so future multi-site clash, parking and weather logic works cleanly.",
        tab: "pitches",
        severity: "critical",
      })
    );
  }

  const pitchesWithInvalidSite = pitchCfg.filter((pitch) => pitch.siteId && !siteIds.has(pitch.siteId));
  if (pitchesWithInvalidSite.length) {
    issues.push(
      makeIssue({
        domain: "Pitches",
        title: `${pitchesWithInvalidSite.length} pitch${pitchesWithInvalidSite.length === 1 ? "" : "es"} assigned to an unknown site`,
        detail: "Select a valid site for each pitch so pitch allocation can be grouped by venue.",
        tab: "pitches",
        severity: "critical",
      })
    );
  }

  const refsMissingContact = refs.filter((ref) => ref?.name && !ref?.phone && !ref?.email);
  if (refsMissingContact.length) {
    issues.push(
      makeIssue({
        domain: "Officials",
        title: `${refsMissingContact.length} referee${refsMissingContact.length === 1 ? "" : "s"} missing contact details`,
        detail: "Add phone or email details so referee chasing and communications can be automated later.",
        tab: "refs",
        severity: "warning",
      })
    );
  }

  const critical = issues.filter((issue) => issue.severity === "critical").length;
  const warning = issues.filter((issue) => issue.severity === "warning").length;
  const score = Math.max(0, Math.min(100, 100 - critical * 16 - warning * 7));

  let status = "Ready";
  let tone = "green";
  if (critical) {
    status = "Action required";
    tone = "red";
  } else if (warning) {
    status = "Review";
    tone = "amber";
  }

  return {
    score,
    status,
    tone,
    issues,
    critical,
    warning,
    summary: critical ? `${critical} critical setting${critical === 1 ? "" : "s"} need attention.` : warning ? `${warning} setting${warning === 1 ? "" : "s"} should be reviewed.` : "Core settings look ready.",
    domains: {
      sites: sites.length,
      teams: teamCfg.length,
      adultTeams: teamCfg.filter(isAdultTeam).length,
      youthTeams: Math.max(0, teamCfg.length - teamCfg.filter(isAdultTeam).length),
      pitches: pitchCfg.length,
      refs: refs.length,
    },
  };
}
