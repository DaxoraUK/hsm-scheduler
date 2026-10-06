/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import CommunicationsPage from "../../src/pages/CommunicationsPage.jsx";
import { DB } from "../../src/lib/supabase.js";
import { toast } from "../../src/lib/notifications/daxoraNotifications.js";

vi.mock("../../src/lib/supabase.js", () => ({ DB: {
  loadTeamContacts: vi.fn(async () => []), listCommunicationEvents: vi.fn(async () => []),
  listCoachHubMatchweekDeliveryStatus: vi.fn(async () => []), recordCommunicationEvent: vi.fn(async () => ({})),
  assertMatchdayApproval: vi.fn(async () => ({})),
  publishCoachHubMatchweekMessages: vi.fn(async () => ({ published: 1 })),
}, Auth: {} }));
vi.mock("../../src/lib/notifications/daxoraNotifications.js", () => ({ toast: {
  success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(),
} }));

const fixtures = [
  { id: "knights", homeTeam: "Knights", awayTeam: "Egerton", status: "active", koTime: "09:00", pitchId: "P1", refStatus: "Confirmed", referee: "Official" },
  { id: "cobras", homeTeam: "Cobras", awayTeam: "Rangers", status: "postponed" },
];
const props = { activeClubId: "club-a", workspaceAccess: { canCommunicate: true, canPublish: true },
  communicationSchemaReady: true, satHasRun: true, satFinal: fixtures,
  teamCfg: [{ id: "knights", name: "Knights" }, { id: "cobras", name: "Cobras" }],
};
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => JSON.stringify({ channels: {} }) })));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render(extra = {}) { await act(async () => root.render(React.createElement(CommunicationsPage, { ...props, ...extra }))); }
function button(label) { return [...document.querySelectorAll("button")].find((item) => item.textContent.includes(label)); }

test("searches by opposition and filters fixture status without dropping other games", async () => {
  await render();
  const search = host.querySelector('input[aria-label="Search coach messages"]');
  expect(search).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(search, "Egerton");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.querySelectorAll("article[data-communication-fixture]")).toHaveLength(1);
  expect(host.querySelector("article[data-communication-fixture]").textContent).toContain("Knights");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(search, "");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const status = host.querySelector('select[aria-label="Fixture update type"]');
  expect(status).not.toBeNull();
  await act(async () => { status.value = "postponed"; status.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(host.querySelectorAll("article[data-communication-fixture]")).toHaveLength(1);
  expect(host.querySelector("article[data-communication-fixture]").textContent).toContain("Cobras");
});

test("missing contacts have a working settings action and no empty send queue", async () => {
  const onOpenTeamSettings = vi.fn(); await render({ onOpenTeamSettings });
  expect(button("Send coach messages").disabled).toBe(true);
  expect(button("Manage team contacts")).toBeDefined();
  await act(async () => button("Manage team contacts").click());
  expect(onOpenTeamSettings).toHaveBeenCalledTimes(1);
});

test("a directory change refreshes recipients without reopening Communications", async () => {
  await render();
  const knightsCard = () => [...host.querySelectorAll("article[data-communication-fixture]")].find((card) => card.querySelector("h3")?.textContent === "Knights");
  expect(knightsCard().textContent).toContain("Coach contact missing");
  DB.loadTeamContacts.mockResolvedValue([{ teamKey: "knights", teamName: "Knights", coachName: "Updated Coach", coachEmail: "updated@example.org", preferredChannel: "email" }]);
  await act(async () => window.dispatchEvent(new CustomEvent("ground-control-coach-hub-contacts-changed")));
  expect(knightsCard().textContent).not.toContain("Coach contact missing");
  expect(knightsCard().textContent).toContain("Updated Coach");
});

test("does not claim a review was saved when the audit write fails", async () => {
  DB.recordCommunicationEvent.mockRejectedValueOnce(new Error("Audit unavailable"));
  await render();
  await act(async () => button("Record review").click());
  expect(toast.success).not.toHaveBeenCalledWith("Review recorded", expect.anything());
  expect(toast.warning).toHaveBeenCalled();
});

test("switching clubs clears old history even when the new club cannot communicate", async () => {
  DB.listCoachHubMatchweekDeliveryStatus.mockResolvedValueOnce([{ id: "old", title: "Old club private message" }]);
  await render(); expect(host.textContent).toContain("Old club private message");
  await render({ activeClubId: "club-b", workspaceAccess: { canCommunicate: false } });
  expect(host.textContent).not.toContain("Old club private message");
});

test("a double confirmation publishes only one batch", async () => {
  const contacts = [{ teamKey: "cobras", teamName: "Cobras", coachName: "Coach", coachEmail: "coach@example.org", preferredChannel: "email", privacyNoticeProvidedAt: "2026-10-01" }];
  DB.loadTeamContacts.mockResolvedValue(contacts);
  let finish;
  DB.publishCoachHubMatchweekMessages.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await render({ teamContacts: contacts, communicationPrivacy: { controllerName: "Club", privacyContactEmail: "privacy@example.org", lawfulBasis: "legitimate_interests", dpiaStatus: "screened_no_high_risk", privacyNoticeUrl: "https://example.org/privacy" } });
  await act(async () => button("Send coach messages").click());
  await act(async () => button("Publish to Coach Hub").click());
  const confirm = [...document.querySelectorAll('button')].filter((item) => item.textContent.includes("Publish to Coach Hub")).at(-1);
  await act(async () => { confirm.click(); confirm.click(); });
  expect(DB.publishCoachHubMatchweekMessages).toHaveBeenCalledTimes(1);
  await act(async () => finish({ published: 1 }));
});
