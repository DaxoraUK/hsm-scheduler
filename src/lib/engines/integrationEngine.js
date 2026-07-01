const PROVIDERS = [
  {
    id: "fulltime-fa",
    name: "Full-Time FA",
    category: "Fixture source",
    status: "foundation",
    readiness: 72,
    description: "Import fixtures from Full-Time and normalise them into Ground Control matchday data.",
    capabilities: ["Fixture import", "Competition source", "Team mapping"],
    nextActions: ["Make source URLs customer-configurable", "Store import history", "Add import validation report"],
  },
  {
    id: "teamfeepay",
    name: "TeamFeePay",
    category: "Club management",
    status: "planned",
    readiness: 34,
    description: "Prepare member, team and communication workflows for future TeamFeePay connectivity.",
    capabilities: ["Team sync", "Member sync", "Outbound communications"],
    nextActions: ["Create provider credentials model", "Define team matching rules", "Prepare outbound message payloads"],
  },
  {
    id: "pitchero",
    name: "Pitchero",
    category: "Website and teams",
    status: "planned",
    readiness: 31,
    description: "Prepare fixture publishing, team pages and matchday communication payloads.",
    capabilities: ["Fixture publish", "Team sync", "Website updates"],
    nextActions: ["Create publishing queue", "Define fixture payload format", "Add provider status checks"],
  },
  {
    id: "spond",
    name: "Spond",
    category: "Team communications",
    status: "planned",
    readiness: 29,
    description: "Prepare manager and parent messaging workflows for future Spond integration.",
    capabilities: ["Team messaging", "Availability prompts", "Event publishing"],
    nextActions: ["Create message template mapper", "Define group/team matching", "Prepare event publish payloads"],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "Calendar sync",
    status: "planned",
    readiness: 26,
    description: "Prepare fixture and pitch booking events for calendar export and sync.",
    capabilities: ["Fixture calendar events", "Pitch bookings", "Club diary"],
    nextActions: ["Create calendar event model", "Add export queue", "Decide sync ownership rules"],
  },
];

const STATUS_META = {
  live: { label: "Live", tone: "success", rank: 4 },
  foundation: { label: "Foundation", tone: "warning", rank: 3 },
  planned: { label: "Planned", tone: "neutral", rank: 2 },
  blocked: { label: "Blocked", tone: "danger", rank: 1 },
};

export function getIntegrationProviders() {
  return PROVIDERS.map((provider) => ({
    ...provider,
    statusMeta: STATUS_META[provider.status] || STATUS_META.planned,
  }));
}

export function calculateIntegrationReadiness(providers = getIntegrationProviders()) {
  if (!providers.length) {
    return {
      score: 0,
      status: "neutral",
      label: "No providers",
      summary: "No integration providers have been configured yet.",
      live: 0,
      foundation: 0,
      planned: 0,
      blocked: 0,
    };
  }

  const totals = providers.reduce(
    (acc, provider) => {
      acc.score += Number(provider.readiness) || 0;
      acc[provider.status] = (acc[provider.status] || 0) + 1;
      return acc;
    },
    { score: 0, live: 0, foundation: 0, planned: 0, blocked: 0 }
  );

  const score = Math.round(totals.score / providers.length);
  const status = totals.blocked ? "danger" : score >= 70 ? "success" : score >= 40 ? "warning" : "neutral";
  const label = totals.blocked ? "Blocked" : score >= 70 ? "Good foundation" : score >= 40 ? "In progress" : "Planning";

  return {
    ...totals,
    score,
    status,
    label,
    summary:
      score >= 70
        ? "Integration foundations are strong enough to begin provider-specific wiring."
        : score >= 40
          ? "Core integration architecture is forming, but provider workflows still need defining."
          : "Integration work is still mostly architectural planning.",
  };
}

export function getIntegrationRoadmap(providers = getIntegrationProviders()) {
  return providers
    .flatMap((provider) =>
      (provider.nextActions || []).map((action, index) => ({
        providerId: provider.id,
        providerName: provider.name,
        action,
        priority: (provider.statusMeta?.rank || 0) * 10 - index,
      }))
    )
    .sort((a, b) => b.priority - a.priority);
}
