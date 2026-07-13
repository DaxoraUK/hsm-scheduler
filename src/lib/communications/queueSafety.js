export function communicationRowSignature(row = {}) {
  const recipients = (Array.isArray(row.recipients) ? row.recipients : [])
    .map((recipient) => [recipient.type, recipient.channel, recipient.destination, recipient.message || row.message])
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  return JSON.stringify([
    row.id || "",
    row.messageHash || "",
    row.status || "",
    row.dateLabel || "",
    row.ko || "",
    row.pitch || "",
    recipients,
  ]);
}

export function findStaleCommunicationRows(rows = [], currentRows = [], snapshot = {}) {
  const current = new Map((Array.isArray(currentRows) ? currentRows : []).map((row) => [row.id, row]));
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const latest = current.get(row.id);
    if (!latest || latest.readyState !== "ready") return true;
    const expected = snapshot[row.id] || communicationRowSignature(row);
    return expected !== communicationRowSignature(latest);
  });
}

function fnv1a(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildCommunicationApprovalKey(rows = []) {
  const signatures = (Array.isArray(rows) ? rows : [])
    .map((row) => communicationRowSignature(row))
    .sort()
    .join("|");
  return `elite:communications:${fnv1a(signatures)}`;
}
