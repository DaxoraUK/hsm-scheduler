import { describe, expect, test } from "vitest";
import {
  communicationRowSignature,
  findStaleCommunicationRows,
} from "../../src/lib/communications/queueSafety.js";

function row(overrides = {}) {
  return {
    id: "sat:fixture-1",
    messageHash: "hash-1",
    status: "scheduled",
    readyState: "ready",
    dateLabel: "Saturday, 19 September 2026",
    ko: "10:00",
    pitch: "P1",
    message: "Fixture details",
    recipients: [{ type: "coach", channel: "email", destination: "coach@example.org", message: "Fixture details" }],
    ...overrides,
  };
}

describe("communications production controls v3", () => {
  test("unchanged queue content remains sendable", () => {
    const original = row();
    const snapshot = { [original.id]: communicationRowSignature(original) };
    expect(findStaleCommunicationRows([original], [row()], snapshot)).toEqual([]);
  });

  test("fixture, recipient or readiness changes invalidate an open queue", () => {
    const original = row();
    const snapshot = { [original.id]: communicationRowSignature(original) };
    expect(findStaleCommunicationRows([original], [row({ ko: "11:00" })], snapshot)).toHaveLength(1);
    expect(findStaleCommunicationRows([original], [row({ recipients: [{ type: "coach", channel: "email", destination: "new@example.org", message: "Fixture details" }] })], snapshot)).toHaveLength(1);
    expect(findStaleCommunicationRows([original], [row({ readyState: "blocked" })], snapshot)).toHaveLength(1);
  });

  test("removed fixtures cannot be sent from an old queue", () => {
    const original = row();
    const snapshot = { [original.id]: communicationRowSignature(original) };
    expect(findStaleCommunicationRows([original], [], snapshot)).toHaveLength(1);
  });
});
