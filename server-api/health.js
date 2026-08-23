function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-daxora-health": payload?.status || "unknown",
    },
  });
}

function configured(...names) {
  return names.some((name) => String(process.env[name] || "").trim().length > 0);
}

function check(code, label, state, detail, { critical = false, category = "platform" } = {}) {
  return { code, label, state, detail, critical, category };
}

function weatherCheck(environment, branch) {
  const commercial = configured("OPEN_METEO_API_KEY");
  const publicAllowed = String(process.env.WEATHER_ALLOW_PUBLIC_API || "").toLowerCase() === "true"
    || environment !== "production"
    || branch === "staging";

  if (commercial) {
    return check("weather", "Live weather", "ready", "Commercial Open-Meteo credentials are configured.", { category: "providers" });
  }
  if (publicAllowed) {
    return check("weather", "Live weather", "ready", "Evaluation weather access is enabled for this non-production environment.", { category: "providers" });
  }
  return check("weather", "Live weather", "blocked", "Production weather credentials are missing.", { critical: true, category: "providers" });
}

export async function GET() {
  const environment = String(
    process.env.APP_ENVIRONMENT
      || process.env.VITE_APP_ENVIRONMENT
      || process.env.VERCEL_ENV
      || "development",
  ).toLowerCase();
  const branch = String(process.env.VERCEL_GIT_COMMIT_REF || "").toLowerCase();
  const release = String(
    process.env.VITE_APP_RELEASE
      || process.env.VERCEL_GIT_COMMIT_SHA
      || process.env.VERCEL_DEPLOYMENT_ID
      || "development",
  ).slice(0, 80);

  const supabaseClient = configured("VITE_SUPABASE_URL") && configured("VITE_SUPABASE_ANON_KEY");
  const supabaseService = configured("SUPABASE_URL", "VITE_SUPABASE_URL")
    && configured("SUPABASE_SERVICE_ROLE_KEY");
  const email = configured("RESEND_API_KEY") && configured(
    "COMMUNICATIONS_EMAIL_FROM",
    "COMMUNICATIONS_FROM_EMAIL",
    "RESEND_FROM_EMAIL",
  );
  const automation = configured("CRON_SECRET", "DAXORA_AUTOMATION_SECRET");
  const push = configured("DAXORA_VAPID_PUBLIC_KEY")
    && configured("DAXORA_VAPID_PRIVATE_KEY")
    && configured("DAXORA_VAPID_SUBJECT");

  const checks = [
    check("application", "Application runtime", "ready", "The Daxora health function is responding.", { critical: true }),
    check(
      "supabase_client",
      "Supabase client",
      supabaseClient ? "ready" : "blocked",
      supabaseClient ? "Browser authentication and data access are configured." : "Client Supabase configuration is incomplete.",
      { critical: true, category: "data" },
    ),
    check(
      "supabase_service",
      "Supabase service operations",
      supabaseService ? "ready" : "blocked",
      supabaseService ? "Server-side automation can use the service role." : "Service-role configuration is incomplete.",
      { critical: true, category: "data" },
    ),
    check(
      "email",
      "Email delivery",
      email ? "ready" : "conditional",
      email ? "Resend delivery is configured." : "Email delivery credentials or sender identity are missing.",
      { category: "providers" },
    ),
    weatherCheck(environment, branch),
    check(
      "automation",
      "Daily automation",
      automation ? "ready" : "conditional",
      automation ? "Cron authentication is configured." : "CRON_SECRET or DAXORA_AUTOMATION_SECRET is missing.",
      { category: "automation" },
    ),
    check(
      "report_delivery",
      "Scheduled report delivery",
      supabaseService && email && automation ? "ready" : "conditional",
      supabaseService && email && automation
        ? "Report generation and delivery dependencies are configured."
        : "One or more report delivery dependencies are incomplete.",
      { category: "automation" },
    ),
    check(
      "finance_delivery",
      "Finance document delivery",
      supabaseService && email ? "ready" : "conditional",
      supabaseService && email
        ? "Invoice, statement and reminder delivery dependencies are configured."
        : "Finance email delivery is not fully configured.",
      { category: "automation" },
    ),
    check(
      "push",
      "Installed-app push",
      push ? "ready" : "optional",
      push ? "VAPID push credentials are configured." : "Push is optional and not fully configured.",
      { category: "providers" },
    ),
  ];

  const criticalBlocked = checks.some((item) => item.critical && item.state === "blocked");
  const conditional = checks.some((item) => ["conditional", "blocked"].includes(item.state));
  const status = criticalBlocked ? "not_ready" : conditional ? "degraded" : "ready";

  return json({
    product: "Daxora Ground Control",
    status,
    generatedAt: new Date().toISOString(),
    environment,
    branch: branch || null,
    release,
    region: process.env.VERCEL_REGION || null,
    runtime: "vercel-node",
    checks,
    summary: {
      ready: checks.filter((item) => item.state === "ready").length,
      conditional: checks.filter((item) => item.state === "conditional").length,
      optional: checks.filter((item) => item.state === "optional").length,
      blocked: checks.filter((item) => item.state === "blocked").length,
      total: checks.length,
    },
  }, criticalBlocked ? 503 : 200);
}

export function POST() {
  return json({ error: "Method not allowed." }, 405);
}
