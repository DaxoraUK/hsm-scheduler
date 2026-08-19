import { createPartnerEnvelope, TEAMFEEPAY_CAPABILITIES, TEAMFEEPAY_INTEGRATION_STATUS, validatePartnerEnvelope } from "./contracts.js";
import { mapPartnerEntity } from "./mapper.js";

function wait(ms = 220) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockTeamFeePayAdapter {
  constructor({ dataset = {}, latencyMs = 180 } = {}) {
    this.dataset = dataset;
    this.latencyMs = latencyMs;
    this.committedKeys = new Set();
    this.status = TEAMFEEPAY_INTEGRATION_STATUS.MOCK;
  }

  async getCapabilities() {
    await wait(this.latencyMs);
    return {
      status: this.status,
      provider: "TeamFeePay integration sandbox",
      capabilities: TEAMFEEPAY_CAPABILITIES,
      disclaimer: "Synthetic demonstration only. Production connection requires TeamFeePay authorisation and API documentation.",
    };
  }

  async getClubSnapshot() {
    await wait(this.latencyMs);
    return structuredClone(this.dataset);
  }

  async previewSync({ entityType, records = [] } = {}) {
    await wait(this.latencyMs);
    const accepted = [];
    const rejected = [];

    records.forEach((record, index) => {
      try {
        const mapped = mapPartnerEntity(entityType, record);
        accepted.push({ index, sourceId: mapped.externalId, mapped });
      } catch (error) {
        rejected.push({ index, message: error?.message || "Mapping failed" });
      }
    });

    return {
      dryRun: true,
      entityType,
      accepted,
      rejected,
      summary: {
        received: records.length,
        accepted: accepted.length,
        rejected: rejected.length,
      },
    };
  }

  async commitSync({ eventType, sourceId, entityType, records = [], idempotencyKey = "" } = {}) {
    const envelope = createPartnerEnvelope({
      eventType: eventType || `${entityType}.batch.updated`,
      sourceId: sourceId || "demo-club-001",
      idempotencyKey,
      data: { entityType, records },
    });
    const validation = validatePartnerEnvelope(envelope);
    if (!validation.valid) throw new Error(validation.errors.join(" "));

    if (this.committedKeys.has(envelope.idempotencyKey)) {
      return {
        duplicate: true,
        idempotencyKey: envelope.idempotencyKey,
        written: 0,
        message: "The batch was already processed safely.",
      };
    }

    const preview = await this.previewSync({ entityType, records });
    this.committedKeys.add(envelope.idempotencyKey);
    return {
      duplicate: false,
      idempotencyKey: envelope.idempotencyKey,
      written: preview.accepted.length,
      rejected: preview.rejected.length,
      message: `${preview.accepted.length} ${entityType} record(s) committed to the demo workspace.`,
    };
  }
}
