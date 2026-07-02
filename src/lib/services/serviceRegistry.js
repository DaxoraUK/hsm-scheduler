const SERVICE_STATUS_META = Object.freeze({
  live: { label: "Live", tone: "success", rank: 4 },
  foundation: { label: "Foundation", tone: "warning", rank: 3 },
  planned: { label: "Planned", tone: "neutral", rank: 2 },
  blocked: { label: "Blocked", tone: "danger", rank: 1 },
});

const SERVICE_DEFINITIONS = Object.freeze([
  {
    key: "fa",
    id: "fulltime-fa",
    serviceId: "faService",
    name: "Full-Time FA",
    category: "Fixture source",
    status: "foundation",
    readiness: 72,
    description: "Import fixtures from Full-Time and normalise them into Ground Control matchday data.",
    capabilities: ["Fixture import", "Competition source", "Team mapping"],
    nextActions: ["Make source URLs customer-configurable", "Store import history", "Add import validation report"],
  },
  {
    key: "teamFeePay",
    id: "teamfeepay",
    serviceId: "teamFeePayService",
    name: "TeamFeePay",
    category: "Club management",
    status: "planned",
    readiness: 34,
    description: "Prepare member, team and communication workflows for future TeamFeePay connectivity.",
    capabilities: ["Team sync", "Member sync", "Outbound communications"],
    nextActions: ["Create provider credentials model", "Define team matching rules", "Prepare outbound message payloads"],
  },
  {
    key: "pitchero",
    id: "pitchero",
    serviceId: "pitcheroService",
    name: "Pitchero",
    category: "Website and teams",
    status: "planned",
    readiness: 31,
    description: "Prepare fixture publishing, team pages and matchday communication payloads.",
    capabilities: ["Fixture publish", "Team sync", "Website updates"],
    nextActions: ["Create publishing queue", "Define fixture payload format", "Add provider status checks"],
  },
  {
    key: "spond",
    id: "spond",
    serviceId: "spondService",
    name: "Spond",
    category: "Team communications",
    status: "planned",
    readiness: 29,
    description: "Prepare manager and parent messaging workflows for future Spond integration.",
    capabilities: ["Team messaging", "Availability prompts", "Event publishing"],
    nextActions: ["Create message template mapper", "Define group/team matching", "Prepare event publish payloads"],
  },
  {
    key: "calendar",
    id: "google-calendar",
    serviceId: "calendarService",
    name: "Google Calendar",
    category: "Calendar sync",
    status: "planned",
    readiness: 26,
    description: "Prepare fixture and pitch booking events for calendar export and sync.",
    capabilities: ["Fixture calendar events", "Pitch bookings", "Club diary"],
    nextActions: ["Create calendar event model", "Add export queue", "Decide sync ownership rules"],
  },
  {
    key: "weather",
    id: "weather",
    serviceId: "weatherService",
    name: "Weather",
    category: "Operational intelligence",
    status: "foundation",
    readiness: 48,
    description: "Prepare weather checks for matchday risk, pitch suitability and postponement guidance.",
    capabilities: ["Weather risk", "Pitch risk", "Matchday guidance"],
    nextActions: ["Select weather provider", "Define risk thresholds", "Connect weather intelligence engine"],
  },
  {
    key: "whatsApp",
    id: "whatsapp",
    serviceId: "whatsAppService",
    name: "WhatsApp",
    category: "Outbound communications",
    status: "foundation",
    readiness: 52,
    description: "Generate manager-ready message payloads for schedule changes and matchday updates.",
    capabilities: ["Message copy", "Manager updates", "Operational alerts"],
    nextActions: ["Create template registry", "Add message audit trail", "Prepare outbound channel adapters"],
  },
]);

function normaliseStatus(status) {
  return SERVICE_STATUS_META[status] ? status : "planned";
}

export function getServiceStatusMeta(status) {
  return SERVICE_STATUS_META[normaliseStatus(status)];
}

export function getPlatformServiceDefinitions() {
  return SERVICE_DEFINITIONS.map((definition) => ({
    ...definition,
    statusMeta: getServiceStatusMeta(definition.status),
  }));
}

export function getPlatformServiceDefinition(keyOrId) {
  return getPlatformServiceDefinitions().find(
    (definition) =>
      definition.key === keyOrId || definition.id === keyOrId || definition.serviceId === keyOrId
  );
}

export function createPlatformService(keyOrId, overrides = {}) {
  const definition = getPlatformServiceDefinition(keyOrId) || {
    key: keyOrId,
    id: keyOrId,
    serviceId: keyOrId,
    name: keyOrId,
    category: "Platform service",
    status: "planned",
    readiness: 0,
    description: "Platform service foundation only. Live API wiring is not enabled yet.",
    capabilities: [],
    nextActions: [],
    statusMeta: getServiceStatusMeta("planned"),
  };

  const service = {
    ...definition,
    ...overrides,
    id: overrides.serviceId || definition.serviceId,
    providerId: overrides.providerId || definition.id,
    isConfigured: overrides.isConfigured || (() => false),
    describe: overrides.describe || (() => `${definition.name} integration foundation only. Live API wiring is not enabled yet.`),
    getDefinition: () => definition,
  };

  return Object.freeze(service);
}

export function getPlatformServices() {
  return getPlatformServiceDefinitions().map((definition) => createPlatformService(definition.key));
}

export function getPlatformServiceById(keyOrId) {
  return getPlatformServices().find(
    (service) => service.key === keyOrId || service.providerId === keyOrId || service.id === keyOrId
  );
}

export function calculateServiceReadiness(services = getPlatformServiceDefinitions()) {
  if (!services.length) {
    return {
      score: 0,
      status: "neutral",
      label: "No services",
      summary: "No platform services have been registered yet.",
      live: 0,
      foundation: 0,
      planned: 0,
      blocked: 0,
    };
  }

  const totals = services.reduce(
    (acc, service) => {
      const status = normaliseStatus(service.status);
      acc.score += Number(service.readiness) || 0;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { score: 0, live: 0, foundation: 0, planned: 0, blocked: 0 }
  );

  const score = Math.round(totals.score / services.length);
  const status = totals.blocked ? "danger" : score >= 70 ? "success" : score >= 40 ? "warning" : "neutral";
  const label = totals.blocked ? "Blocked" : score >= 70 ? "Good foundation" : score >= 40 ? "In progress" : "Planning";

  return {
    ...totals,
    score,
    status,
    label,
    summary:
      score >= 70
        ? "Service foundations are strong enough to begin provider-specific wiring."
        : score >= 40
          ? "Core service architecture is in place, but provider workflows still need defining."
          : "Service work is still mostly architectural planning.",
  };
}

export function getServiceRoadmap(services = getPlatformServiceDefinitions()) {
  return services
    .flatMap((service) =>
      (service.nextActions || []).map((action, index) => ({
        providerId: service.id,
        providerName: service.name,
        action,
        priority: (service.statusMeta?.rank || getServiceStatusMeta(service.status).rank || 0) * 10 - index,
      }))
    )
    .sort((a, b) => b.priority - a.priority);
}
