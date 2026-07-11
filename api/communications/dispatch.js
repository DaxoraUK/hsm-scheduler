import { communicationProviderConfig, publicCommunicationCapabilities } from "../../server/communications/config.js";
import { json, methodNotAllowed, readJson } from "../../server/communications/http.js";
import { sanitiseOutboundMessages, sha256, text } from "../../server/communications/normalise.js";
import { sendProviderMessage } from "../../server/communications/providers.js";
import { serviceRpc, userRpc, verifySupabaseUser } from "../../server/communications/supabase.js";

function errorResponse(error) {
  return json({
    error: error?.message || "The message batch could not be processed",
    code: error?.code || "COMMUNICATION_DISPATCH_FAILED",
    detail: error?.detail || null,
  }, Number(error?.status) || 500);
}

export async function POST(request) {
  try {
    const capabilities = publicCommunicationCapabilities();
    if (!capabilities.webSendingEnabled) {
      return json({
        error: "Web sending is prepared but no delivery provider is enabled.",
        code: "COMMUNICATION_PROVIDER_NOT_CONFIGURED",
        capabilities,
      }, 503);
    }

    const { user, token } = await verifySupabaseUser(request);
    const body = await readJson(request);
    const clubId = text(body?.clubId, 80);
    if (!clubId) return json({ error: "No club workspace was supplied", code: "CLUB_CONTEXT_REQUIRED" }, 400);

    const messages = sanitiseOutboundMessages(clubId, body?.messages || []);
    const providerConfig = communicationProviderConfig();
    if (providerConfig.email.pilotMode) {
      const actorEmail = String(user?.email || "").trim().toLowerCase();
      if (!providerConfig.email.pilotOperatorEmails.includes(actorEmail)) {
        return json({
          error: "This account is not authorised to run the staging email pilot.",
          code: "EMAIL_PILOT_OPERATOR_NOT_AUTHORISED",
        }, 403);
      }
      if (body?.pilotAcknowledged !== true) {
        return json({
          error: "Confirm that this is a staging email test before dispatch.",
          code: "EMAIL_PILOT_ACKNOWLEDGEMENT_REQUIRED",
        }, 409);
      }
      if (messages.some((item) => item.channel !== "email")) {
        return json({
          error: "The staging pilot permits email only. SMS and WhatsApp remain disabled.",
          code: "EMAIL_PILOT_CHANNEL_RESTRICTED",
        }, 409);
      }
      if (messages.length > providerConfig.email.pilotMaxBatch) {
        return json({
          error: `The staging email pilot is limited to ${providerConfig.email.pilotMaxBatch} recipients per batch.`,
          code: "EMAIL_PILOT_BATCH_LIMIT",
        }, 413);
      }
    }
    const unavailable = messages.filter((item) => !capabilities.channels[item.channel]?.enabled);
    if (unavailable.length) {
      return json({
        error: "One or more selected recipients use a channel that is not configured for web sending.",
        code: "CHANNEL_NOT_CONFIGURED",
        unavailable: unavailable.map((item) => ({ clientKey: item.clientKey, channel: item.channel })),
        capabilities,
      }, 409);
    }

    await userRpc(token, "validate_communication_delivery_recipients", {
      target_club_id: clubId,
      recipients: messages.map((item) => ({
        teamKey: item.teamKey,
        recipientType: item.recipientType,
        channel: item.channel,
        destination: item.destination,
      })),
    });

    const requestKey = text(body?.requestKey, 240) || sha256(messages.map((item) => item.idempotencyKey).sort().join("|"));
    const databaseMessages = messages.map((item) => ({
      clientKey: item.clientKey,
      idempotencyKey: item.idempotencyKey,
      messageKey: item.messageKey,
      messageHash: item.messageHash,
      fixtureId: item.fixtureId,
      teamKey: item.teamKey,
      teamName: item.teamName,
      recipientType: item.recipientType,
      recipientLabel: item.recipientLabel,
      recipientHint: item.recipientHint,
      channel: item.channel,
      messageBody: item.messageBody,
      subject: item.subject,
    }));

    const reservation = await userRpc(token, "create_communication_delivery_batch", {
      target_club_id: clubId,
      request_key: requestKey,
      messages: databaseMessages,
    });
    const batchId = reservation?.batch_id || reservation?.batchId;
    const deliveryRows = Array.isArray(reservation?.deliveries) ? reservation.deliveries : [];
    const deliveryByKey = new Map(deliveryRows.map((row) => [row.idempotency_key || row.idempotencyKey, row]));
    const results = [];

    for (const item of messages) {
      const reserved = deliveryByKey.get(item.idempotencyKey);
      if (!reserved?.id) {
        results.push({ clientKey: item.clientKey, status: "failed", error: "The delivery record was not reserved" });
        continue;
      }
      const existingStatus = reserved.status || "queued";
      if (existingStatus !== "queued") {
        results.push({
          clientKey: item.clientKey,
          deliveryId: reserved.id,
          status: existingStatus,
          provider: reserved.provider_name || null,
          providerReference: reserved.provider_reference || null,
          reused: true,
        });
        continue;
      }

      const claimed = await serviceRpc("claim_communication_delivery", { p_delivery_id: reserved.id });
      if (!claimed) {
        results.push({ clientKey: item.clientKey, deliveryId: reserved.id, status: "processing", reused: true });
        continue;
      }

      try {
        const providerResult = await sendProviderMessage({
          ...item,
          clubTag: sha256(clubId).slice(0, 24),
          messageTag: item.idempotencyKey.slice(0, 24),
        });
        await serviceRpc("complete_communication_delivery", {
          p_delivery_id: reserved.id,
          p_next_status: providerResult.status,
          p_provider_name: providerResult.provider,
          p_provider_reference: providerResult.reference,
          p_error_code: null,
          p_error_message: null,
          p_provider_detail: { rawStatus: providerResult.rawStatus },
        });
        results.push({
          clientKey: item.clientKey,
          deliveryId: reserved.id,
          status: providerResult.status,
          provider: providerResult.provider,
          providerReference: providerResult.reference,
        });
      } catch (error) {
        await serviceRpc("complete_communication_delivery", {
          p_delivery_id: reserved.id,
          p_next_status: "failed",
          p_provider_name: null,
          p_provider_reference: null,
          p_error_code: error?.code || "PROVIDER_SEND_FAILED",
          p_error_message: error?.message || "Provider send failed",
          p_provider_detail: error?.detail && typeof error.detail === "object" ? error.detail : {},
        });
        results.push({
          clientKey: item.clientKey,
          deliveryId: reserved.id,
          status: "failed",
          error: error?.message || "Provider send failed",
          code: error?.code || "PROVIDER_SEND_FAILED",
        });
      }
    }

    await serviceRpc("refresh_communication_delivery_batch", { p_batch_id: batchId });
    const accepted = results.filter((item) => ["provider_accepted", "sent", "delivered", "read"].includes(item.status)).length;
    const failed = results.filter((item) => item.status === "failed").length;

    return json({
      batchId,
      requestKey,
      requested: results.length,
      accepted,
      failed,
      results,
    }, failed && !accepted ? 502 : 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export function GET() {
  return methodNotAllowed("POST");
}
