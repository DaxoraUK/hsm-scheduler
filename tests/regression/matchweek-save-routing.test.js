// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { useWeekPersistence } from "../../src/hooks/useWeekPersistence.js";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("legacy history publication still requires publish capability", async () => {
  let state;
  function Harness() { state = useWeekPersistence({ canSave: true, canPublish: false }); return null; }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(React.createElement(Harness)));
  expect(await state.saveWeek()).toBe(false);
  await act(async () => root.unmount());
});

test("a scheduling-only user saves built days through canonical persistence without publication", async () => {
  const saved = [];
  let state;
  function Harness() {
    state = useWeekPersistence({ canPublish: false, canSave: true,
      satDate: "2026-09-05", satHasRun: true, sunDate: "2026-09-06", sunHasRun: false,
      saveMatchday: async (day) => { saved.push(day); return { revision: 3 }; },
    });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(React.createElement(Harness)));
  let result;
  await act(async () => { result = await state.saveWeek(); });
  expect(result).toBe(true);
  expect(saved).toEqual([{ scope: "saturday", date: "2026-09-05" }]);
  await act(async () => root.unmount());
});

test("a rejected canonical day save cannot become a successful history-only save", async () => {
  let state;
  function Harness() {
    state = useWeekPersistence({ canPublish: false, canSave: true,
      satDate: "2026-09-05", satHasRun: true,
      saveMatchday: async () => false,
    });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(React.createElement(Harness)));
  expect(await state.saveWeek()).toBe(false);
  await act(async () => root.unmount());
});
