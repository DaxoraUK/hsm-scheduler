function env(name) {
  return String(process.env[name] || "").trim();
}

function enabled(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
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

  const email = globalEnabled && enabled("COMMUNICATIONS_EMAIL_ENABLED") && Boolean(resendApiKey && emailFrom);
  const sms = globalEnabled && enabled("COMMUNICATIONS_SMS_ENABLED") && Boolean(
    twilioAccountSid && twilioAuthToken && (twilioMessagingServiceSid || twilioSmsFrom),
  );
  const whatsapp = globalEnabled && enabled("COMMUNICATIONS_WHATSAPP_ENABLED") && Boolean(
    twilioAccountSid && twilioAuthToken && twilioWhatsAppFrom && twilioWhatsAppContentSid,
  );

  return {
    globalEnabled,
    publicBaseUrl: env("COMMUNICATIONS_PUBLIC_BASE_URL").replace(/\/$/, ""),
    email: {
      enabled: email,
      provider: "resend",
      apiKey: resendApiKey,
      from: emailFrom,
      webhookSecret: env("RESEND_WEBHOOK_SECRET"),
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

  return {
    webSendingEnabled: Object.values(channels).some((channel) => channel.enabled),
    channels,
    mode: config.globalEnabled ? "provider-configured" : "disabled",
  };
}

export function channelConfiguration(channel) {
  const config = communicationProviderConfig();
  if (channel === "email") return config.email;
  if (channel === "sms") return config.sms;
  if (channel === "whatsapp") return config.whatsapp;
  return { enabled: false, provider: null };
}
