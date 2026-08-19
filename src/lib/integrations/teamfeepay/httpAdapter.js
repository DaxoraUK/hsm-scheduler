import { TEAMFEEPAY_INTEGRATION_STATUS } from "./contracts.js";

function normaliseBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

export class AuthorisedTeamFeePayHttpAdapter {
  constructor({ baseUrl = "", token = "", fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = normaliseBaseUrl(baseUrl);
    this.token = String(token || "").trim();
    this.fetchImpl = fetchImpl;
    this.status = this.baseUrl && this.token
      ? TEAMFEEPAY_INTEGRATION_STATUS.READY_FOR_AUTHORISED_CONNECTION
      : TEAMFEEPAY_INTEGRATION_STATUS.ERROR;
  }

  assertConfigured() {
    if (!this.baseUrl || !this.token) {
      throw new Error("An authorised TeamFeePay API base URL and credential are required.");
    }
  }

  async request(path, { method = "GET", body = null, headers = {} } = {}) {
    this.assertConfigured();
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(body !== null ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body !== null ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || `TeamFeePay request failed (${response.status}).`);
    }
    return payload;
  }
}
