import { expect, test, vi } from "vitest";
import { POST } from "../../server-api/communications/dispatch.js";
import { userRpc } from "../../server/communications/supabase.js";
vi.mock("../../server/communications/config.js", () => ({
  publicCommunicationCapabilities: () => ({ webSendingEnabled: true, channels: { email: { enabled: true } } }),
  communicationProviderConfig: () => ({ email: { pilotMode: false } }),
}));
vi.mock("../../server/communications/supabase.js", () => ({
  verifySupabaseUser: async () => ({ user: { id: "operator" }, token: "test" }),
  userRpc: vi.fn(async () => { throw new Error("stop after validation boundary"); }), serviceRpc: vi.fn(),
}));
test("dispatch supplies assignment and person identity to the real validation boundary", async () => {
  await POST(new Request("http://localhost/api/communications/dispatch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clubId: "club", messages: [{ teamKey: "u14-spartans", teamName: "U14 Spartans", assignmentId: "assignment", personId: "person", channel: "email", destination: "coach@example.org", message: "Saturday fixture details for your team." }] }) }));
  expect(userRpc).toHaveBeenCalledWith("test", "validate_communication_delivery_recipients", expect.objectContaining({ recipients: [expect.objectContaining({ assignmentId: "assignment", personId: "person" })] }));
});
