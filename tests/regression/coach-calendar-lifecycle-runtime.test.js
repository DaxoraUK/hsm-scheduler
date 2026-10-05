/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import CoachSharedCalendar from "../../src/components/coach/CoachSharedCalendar.jsx";
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("React", React);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
test("calendar date chips identify inactive games and Away games; unknown KO displays TBC", async () => {
  const date = new Date();
  const dateKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  await act(async () => root.render(React.createElement(CoachSharedCalendar, { onCreateFeed: () => {}, workspace: { bookings: [
    { id: "inactive", kind: "booking", title: "Knights vs Rovers", teamName: "Knights", status: "postponed", bookingType: "match", fixtureVenueRole: "home", startAt: `${dateKey}T10:00:00`, endAt: `${dateKey}T11:00:00` },
    { id: "away", kind: "booking", title: "Visitors vs Cobras", teamName: "Cobras", status: "confirmed", bookingType: "match", fixtureVenueRole: "away", fixtureTimeKnown: false, startAt: `${dateKey}T00:00:00`, endAt: `${dateKey}T01:00:00` },
  ] } })));
  const chips = [...host.querySelectorAll("button span")];
  expect(chips.find((span) => span.textContent.includes("Knights"))?.textContent).toContain("Postponed");
  expect(chips.find((span) => span.textContent.includes("Cobras"))?.textContent).toContain("Away");
  const awayDetail = [...host.querySelectorAll("article")].find((row) => row.textContent.includes("Cobras"));
  expect(awayDetail.textContent).toContain("Kick-off TBC");
  expect(awayDetail.textContent).not.toContain("00:00");
});
