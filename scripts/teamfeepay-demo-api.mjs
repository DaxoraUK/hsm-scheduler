import http from "node:http";
import { URL } from "node:url";

const port = Number(process.env.DAXORA_DEMO_API_PORT || 8787);
const demoKey = String(process.env.DAXORA_DEMO_API_KEY || "daxora-teamfeepay-demo");
const processed = new Set();

const teams = Array.from({ length: 22 }, (_, index) => ({
  id: `tfp-team-${String(index + 1).padStart(3, "0")}`,
  club_id: "tfp-demo-club-001",
  name: index < 17 ? `Youth Team ${index + 1}` : `Open Age Team ${index - 16}`,
  active: true,
}));

const club = {
  id: "tfp-demo-club-001",
  name: "Northwest Community Football Club",
  sport: "Football",
  postcode: "M99 1GC",
  synthetic: true,
};

function json(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Daxora-Demo-Key, Idempotency-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body, null, 2));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return json(response, 204, null);
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    return json(response, 200, {
      ok: true,
      service: "Daxora Partner API - TeamFeePay acquisition sandbox",
      mode: "synthetic",
      productionConnection: false,
      timestamp: new Date().toISOString(),
    });
  }

  if (request.headers["x-daxora-demo-key"] !== demoKey) {
    return json(response, 401, { error: "Missing or invalid X-Daxora-Demo-Key." });
  }

  if (request.method === "GET" && url.pathname === "/v1/partner/capabilities") {
    return json(response, 200, {
      version: "2026-07-21",
      entities: ["club", "team", "person", "event"],
      operations: ["sync.preview", "sync.commit", "operations.read", "analytics.read"],
      disclaimer: "Synthetic sandbox. Production connection requires TeamFeePay authorisation.",
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/partner/clubs/tfp-demo-club-001") {
    return json(response, 200, { club, teams });
  }

  if (request.method === "POST" && url.pathname === "/v1/partner/sync/preview") {
    try {
      const payload = await readBody(request);
      const records = Array.isArray(payload.records) ? payload.records : [];
      return json(response, 200, {
        dryRun: true,
        entityType: payload.entityType || "unknown",
        received: records.length,
        accepted: records.length,
        rejected: 0,
        warnings: [],
      });
    } catch (error) {
      return json(response, 400, { error: error?.message || "Invalid JSON payload." });
    }
  }

  if (request.method === "POST" && url.pathname === "/v1/partner/sync/commit") {
    try {
      const payload = await readBody(request);
      const key = String(request.headers["idempotency-key"] || payload.idempotencyKey || "").trim();
      if (!key) return json(response, 400, { error: "Idempotency-Key is required." });
      if (processed.has(key)) {
        return json(response, 200, { duplicate: true, written: 0, idempotencyKey: key });
      }
      processed.add(key);
      const records = Array.isArray(payload.records) ? payload.records : [];
      return json(response, 202, {
        duplicate: false,
        written: records.length,
        idempotencyKey: key,
        auditId: `demo-audit-${Date.now()}`,
      });
    } catch (error) {
      return json(response, 400, { error: error?.message || "Invalid JSON payload." });
    }
  }

  if (request.method === "GET" && url.pathname === "/v1/partner/clubs/tfp-demo-club-001/operations") {
    return json(response, 200, {
      clubId: club.id,
      readinessPct: 96,
      fixtures: 8,
      trainingSessions: 2,
      closures: 1,
      recoveredEvents: 2,
      actionsRequired: 0,
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/partner/clubs/tfp-demo-club-001/analytics") {
    return json(response, 200, {
      clubId: club.id,
      period: "2026-07",
      utilisationPct: 83.9,
      matchesHours: 142,
      trainingHours: 188,
      friendliesAndEventsHours: 42,
      winterExternalHours: 36,
      closuresDowntimeHours: 18,
      unusedCapacityHours: 60,
    });
  }

  return json(response, 404, { error: "Not found." });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Daxora TeamFeePay acquisition sandbox API listening on http://127.0.0.1:${port}`);
  console.log(`Demo header: X-Daxora-Demo-Key: ${demoKey}`);
});
