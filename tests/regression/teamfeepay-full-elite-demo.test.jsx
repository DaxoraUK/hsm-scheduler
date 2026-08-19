import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import App from "../../src/App.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let host;

afterEach(async () => {
  if (root) {
    await act(async () => root.unmount());
  }
  root = null;
  host?.remove();
  host = null;
  window.localStorage.clear();
  window.sessionStorage.clear();
});

async function waitForText(text, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (host?.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  }
  throw new Error(`Timed out waiting for ${text}. Current output: ${host?.textContent?.slice(0, 1000)}`);
}

async function clickButton(label) {
  const button = [...host.querySelectorAll("button")].find((node) => node.textContent?.trim() === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe("TeamFeePay full Elite acquisition demo", () => {
  test("opens the current v3.10.13 product with Elite and league workspaces visible", async () => {
    window.history.replaceState({}, "", "/teamfeepay-demo");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root.render(<App />);
    });

    await waitForText("Mission Control");
    await waitForText("Organisation Command");
    await waitForText("Annual Planner");
    await waitForText("League Manager");

    expect(host.textContent).toContain("Elite");
    expect(host.textContent).toContain("Northwest Community Football Club");
    expect(host.textContent).toContain("Private TeamFeePay acquisition demonstration");

    await clickButton("Annual Planner");
    await waitForText("Pitch Booking, Training & Friendlies");

    await clickButton("League Manager");
    await waitForText("Northwest Community League");
  });
});
