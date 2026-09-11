// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { useMatchdayLocks } from "../../src/hooks/useMatchdayLocks.js";

test("a cloud unlock updates the shared state and ignores an obsolete local flag", async () => {
  const input = { clubId: "club-a", satDate: "2026-09-05", canOperate: true, cloud: true };
  window.localStorage.setItem("ground-control:matchday-lock:club-a:saturday:2026-09-05", "1");
  const database = { getMatchdayLock: vi.fn(async () => ({ locked: true })), setMatchdayLock: vi.fn(async (_club, value) => ({ locked: value.locked })) };
  let state;
  function Harness() { state = useMatchdayLocks({ ...input, database }); return React.createElement("span", null, String(state.locks.saturday?.locked)); }
  const host = document.createElement("div"); const root = createRoot(host);
  await act(async () => root.render(React.createElement(Harness)));
  expect(host.textContent).toBe("true");
  await act(async () => state.setLock("saturday", false));
  expect(host.textContent).toBe("false");
  expect(state.canEdit("saturday")).toBe(true);
  await act(async () => root.unmount());
});

test("an unauthorised user cannot unlock and a failed write retains the lock", async () => {
  let state; let canOperate = false;
  const database = { getMatchdayLock: async () => ({ locked: true }), setMatchdayLock: vi.fn(async () => { throw new Error("Save failed"); }) };
  function Harness() { state = useMatchdayLocks({ clubId: "club-a", satDate: "2026-09-05", cloud: true, canOperate, database }); return null; }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(React.createElement(Harness)));
  await expect(state.setLock("saturday", false)).rejects.toThrow(/access/);
  expect(database.setMatchdayLock).not.toHaveBeenCalled();
  canOperate = true;
  await act(async () => root.render(React.createElement(Harness)));
  await act(async () => { await expect(state.setLock("saturday", false)).rejects.toThrow("Save failed"); });
  expect(state.canEdit("saturday")).toBe(false);
  await act(async () => root.unmount());
});
