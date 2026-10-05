/** @vitest-environment jsdom */
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import FixtureDrawer from "../../src/components/Operations/shared/FixtureDrawer.jsx";
vi.mock("../../src/lib/notifications/daxoraNotifications.js", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
const fixture = { __index: 0, sourceFixtureKey: "feed:game-1", homeTeam: "Cobras", awayTeam: "Visitors", status: "active", pitchId: "P1", koTime: "11:00", koMins: 660, isAwayFixture: false, venueRole: "home", requiresScheduling: true, venueReversal: { originalHomeTeam: "Visitors", originalAwayTeam: "Cobras", originalKoTime: "10:00" }, cfg: { id: "cobras", name: "Cobras", format: "11v11", gameMins: 80 }, referee: "Official" };
let root,host;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host=document.createElement("div"); document.body.append(host); root=createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
function Harness({ readOnly=false }) {
  const [row,setRow] = useState(fixture);
  return React.createElement(FixtureDrawer, { fixture: row, fixtures: [row], refs: [], pitchCfg: [{id:"P1",label:"Pitch 1",format:"11v11"}], readOnly, onOverride: (index,field,value)=>setRow((previous)=>({...previous,[field]:value})) });
}
test("an editable reversed fixture can be restored in its real drawer", async () => {
  await act(async () => root.render(React.createElement(Harness)));
  const restore=[...host.querySelectorAll("button")].find((row)=>row.textContent.includes("Restore imported Away fixture"));
  expect(restore).toBeDefined();
  await act(async () => restore.click());
  expect(host.textContent).toContain("Away fixture — no club pitch allocation required");
  expect(host.textContent).not.toContain("Restore imported Away fixture");
});
test("a view-only user cannot undo a reversal", async () => {
  await act(async () => root.render(React.createElement(Harness, {readOnly:true})));
  expect([...host.querySelectorAll("button")].some((row)=>row.textContent.includes("Restore imported Away fixture"))).toBe(false);
});
