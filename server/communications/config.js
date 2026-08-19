function env(name) {
  return String(process.env[name] || "").trim();
}

function enabled(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function boundedInteger(name, fallback, minimum, maximum) {
  const parsed = Number.parseInt(env(name), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function normaliseEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function emailList(value) {
  return [...new Set(String(value || "")
    .split(/[;,\s]+/)
    .map(normaliseEmail)
    .filter(Boolean))];
}

function maskEmail(value) {
  const email = normaliseEmail(value);
  if (!email) return "";
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function deploymentEnvironment() {
  return (env("VERCEL_ENV") || env("COMMUNICATIONS_DEPLOYMENT_ENVIRONMENT") || "unknown").toLowerCase();
}

export function communicationProviderConfig() {
  const globalEnabled = enabled("COMMUNICATIONS_WEB_SEND_ENABLED");
  const resendApiKey = env("RESEND_API_KEY");
  const emailFrom = env("COMMUNICATIONS_EMAIL_FROM");
  const twilioAccountSid = env("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = env("TWILIO_AUTH_TOKEN");
  const twilioMessagingServiceSid = env("TWILIO_MESSAGING_SERVICE_SID");
  const twilioSmsFrom = env("TWILIO_SMS_FROM");
  const twilioWhatsAppFrom = env("TWILIO_WHATSAPP_FROM");
  const twilioWhatsAppContentSid = env("TWILIO_WHATSAPP_CONTENT_SID");
  const environment = deploymentEnvironment();
  const previewGuardRequired = ["preview", "staging"].includes(environment);
  const emailPilotRequested = enabled("COMMUNICATIONS_EMAIL_PILOT_MODE");
  const emailPilotRecipient = normaliseEmail(env("COMMUNICATIONS_EMAIL_PILOT_RECIPIENT"));
  const emailPilotOperators = emailList(env("COMMUNICATIONS_EMAIL_PILOT_OPERATOR_EMAILS"));
  const emailPilotMaxBatch = boundedInteger("COMMUNICATIONS_EMAIL_PILOT_MAX_BATCH", 5, 1, 20);
  const emailPilotReady = Boolean(emailPilotRequested && emailPilotRecipient && emailPilotOperators.length);
  const emailCredentialsReady = Boolean(resendApiKey && emailFrom);
  const emailPreviewSafe = !previewGuardRequired || emailPilotReady;
  const email = globalEnabled
    && enabled("COMMUNICATIONS_EMAIL_ENABLED")
    && emailCredentialsReady
    && emailPreviewSafe;
  const sms = globalEnabled && enabled("COMMUNICATIONS_SMS_ENABLED") && Boolean(
    twilioAccountSid && twilioAuthToken && (twilioMessagingServiceSid || twilioSmsFrom),
  );
  const whatsapp = globalEnabled && enabled("COMMUNICATIONS_WHATSAPP_ENABLED") && Boolean(
    twilioAccountSid && twilioAuthToken && twilioWhatsAppFrom && twilioWhatsAppContentSid,
  );

  let emailBlockedReason = null;
  if (!globalEnabled) emailBlockedReason = "global-disabled";
  else if (!enabled("COMMUNICATIONS_EMAIL_ENABLED")) emailBlockedReason = "channel-disabled";
  else if (!emailCredentialsReady) emailBlockedReason = "credentials-incomplete";
  else if (previewGuardRequired && !emailPilotReady) emailBlockedReason = "staging-pilot-incomplete";

  return {
    globalEnabled,
    environment,
    publicBaseUrl: env("COMMUNICATIONS_PUBLIC_BASE_URL").replace(/\/$/, ""),
    email: {
      enabled: email,
      provider: "resend",
      apiKey: resendApiKey,
      from: emailFrom,
      webhookSecret: env("RESEND_WEBHOOK_SECRET"),
      pilotMode: Boolean(email && emailPilotRequested),
      pilotRequested: emailPilotRequested,
      pilotReady: emailPilotReady,
      pilotRecipient: emailPilotRecipient,
      pilotRecipientHint: maskEmail(emailPilotRecipient),
      pilotOperatorEmails: emailPilotOperators,
      pilotMaxBatch: emailPilotMaxBatch,
      blockedReason: emailBlockedReason,
    },
    sms: {
      enabled: sms,
      provider: "twilio",
      accountSid: twilioAccountSid,
      authToken: twilioAuthToken,
      messagingServiceSid: twilioMessagingServiceSid,
      from: twilioSmsFrom,
    },
    whatsapp: {
      enabled: whatsapp,
      provider: "twilio",
      accountSid: twilioAccountSid,
      authToken: twilioAuthToken,
      from: twilioWhatsAppFrom,
      contentSid: twilioWhatsAppContentSid,
    },
  };
}

export function publicCommunicationCapabilities() {
  const config = communicationProviderConfig();
  const channels = {
    email: {
      enabled: config.email.enabled,
      provider: config.email.enabled ? "Resend" : null,
      statusTracking: Boolean(config.email.enabled && config.email.webhookSecret),
      pilotMode: config.email.pilotMode,
      pilotRecipientHint: config.email.pilotMode ? config.email.pilotRecipientHint : null,
      operatorRestricted: Boolean(config.email.pilotMode && config.email.pilotOperatorEmails.length),
      maxBatch: config.email.pilotMode ? config.email.pilotMaxBatch : null,
      blockedReason: config.email.enabled ? null : config.email.blockedReason,
    },
    sms: {
      enabled: config.sms.enabled,
      provider: config.sms.enabled ? "Twilio" : null,
      statusTracking: Boolean(config.sms.enabled && config.publicBaseUrl),
    },
    whatsapp: {
      enabled: config.whatsapp.enabled,
      provider: config.whatsapp.enabled ? "Twilio" : null,
      statusTracking: Boolean(config.whatsapp.enabled && config.publicBaseUrl),
      templateRequired: true,
    },
  };

  const webSendingEnabled = Object.values(channels).some((channel) => channel.enabled);
  return {
    webSendingEnabled,
    channels,
    environment: config.environment,
    mode: config.email.pilotMode
      ? "staging-email-pilot"
      : config.globalEnabled
        ? webSendingEnabled ? "provider-configured" : "provider-incomplete"
        : "disabled",
  };
}

export function channelConfiguration(channel) {
  const config = communicationProviderConfig();
  if (channel === "email") return config.email;
  if (channel === "sms") return config.sms;
  if (channel === "whatsapp") return config.whatsapp;
  return { enabled: false, provider: null };
}
