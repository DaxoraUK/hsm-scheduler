function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function tableToCsv(columns, rows) {
  const header = columns.map((column) => escapeCsv(column.label)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsv(typeof column.value === "function" ? column.value(row) : row[column.value])).join(",")
  );
  return [header, ...body].join("\r\n");
}

function fixtureColumns() {
  return [
    { label: "Matchday", value: "dayLabel" },
    { label: "Date", value: "dateLabel" },
    { label: "Kick-off", value: "koTime" },
    { label: "Home team", value: "homeTeam" },
    { label: "Opposition", value: "awayTeam" },
    { label: "Pitch", value: "pitchLabel" },
    { label: "Format", value: "format" },
    { label: "Status", value: "statusLabel" },
    { label: "Official", value: (row) => row.referee || "TBC" },
    { label: "Official status", value: "officialStatus" },
    { label: "Estimated cars", value: "estimatedCars" },
  ];
}

export function buildReportCsv(model) {
  const type = model?.reportType || "operations";

  if (["operations", "fixtures"].includes(type)) {
    return tableToCsv(fixtureColumns(), model.fixtures || []);
  }

  if (type === "pitches") {
    return tableToCsv([
      { label: "Pitch", value: "label" },
      { label: "Description", value: "description" },
      { label: "Fixtures", value: "total" },
      { label: "Scheduled", value: (row) => row.scheduled ?? row.delivered },
      { label: "Postponed", value: "postponed" },
      { label: "Cancelled", value: "cancelled" },
      { label: "Unresolved", value: "unresolved" },
      { label: "Fixture hours", value: "facilityHours" },
      { label: "Share of selected use %", value: "share" },
      { label: "Postponement rate %", value: "postponementRate" },
    ], model.pitchRows || []);
  }

  if (type === "parking") {
    return tableToCsv([
      { label: "Saved matchday", value: "matchday" },
      { label: "Day", value: "dayLabel" },
      { label: "Date", value: "dateLabel" },
      { label: "Parking enabled", value: (row) => row.enabled ? "Yes" : "No" },
      { label: "Capacity configured", value: (row) => row.configured ? "Yes" : "No" },
      { label: "Capacity", value: "capacity" },
      { label: "Peak demand", value: "peakCars" },
      { label: "Peak utilisation %", value: "utilisation" },
      { label: "Peak time", value: "peakTime" },
      { label: "Parking-impact fixtures", value: "fixtureCount" },
      { label: "Status", value: (row) => row.status?.label || "" },
    ], model.parkingRows || []);
  }

  if (type === "officials") {
    return tableToCsv([
      { label: "Matchday", value: "dayLabel" },
      { label: "Date", value: "dateLabel" },
      { label: "Kick-off", value: "koTime" },
      { label: "Fixture", value: "fixtureLabel" },
      { label: "Pitch", value: "pitchLabel" },
      { label: "Official", value: (row) => row.referee || "TBC" },
      { label: "Contact", value: "contact" },
      { label: "Status", value: "officialStatus" },
      { label: "Confirmed", value: (row) => row.officialConfirmed ? "Yes" : "No" },
    ], model.officialRows || []);
  }

  if (type === "exceptions") {
    return tableToCsv([
      { label: "Type", value: "typeLabel" },
      { label: "Matchday", value: "dayLabel" },
      { label: "Date", value: "dateLabel" },
      { label: "Kick-off", value: "koTime" },
      { label: "Fixture", value: "fixture" },
      { label: "Pitch", value: "pitch" },
      { label: "Detail", value: "detail" },
    ], model.exceptions || []);
  }

  if (type === "funding") {
    return tableToCsv([
      { label: "Category", value: "category" },
      { label: "Requirement", value: "title" },
      { label: "Status", value: "status" },
      { label: "Source type", value: "source" },
      { label: "Current evidence", value: "evidence" },
      { label: "Next action", value: "nextAction" },
    ], model?.grantFramework?.requirements || []);
  }

  const summary = model?.evidence?.summary || {};
  const rows = [
    ["Recorded fixtures", summary.total, "Scheduled, postponed and cancelled outcomes"],
    ["Scheduled fixtures", summary.scheduled ?? summary.delivered, "Fixtures recorded as scheduled to proceed"],
    ["Schedule completion", `${summary.scheduleCompletionRate ?? summary.deliveryRate ?? 0}%`, "Scheduled fixtures as a share of recorded outcomes"],
    ["Unresolved fixtures", summary.unresolved || 0, "Fixtures without a validated allocation"],
    ["Scheduled pitch hours", summary.facilityHours || 0, "Calculated from scheduled fixture durations"],
    ["Officials coverage", `${summary.officialCoverage || 0}%`, "Confirmed appointments for scheduled fixtures"],
    ["Peak parking", summary.peakParking || 0, summary.peakParkingLabel || ""],
    ["Parking pressure matchdays", summary.parkingOverCapacity || 0, "Over capacity or concurrency limit"],
    ["Historical weather coverage", `${summary.weatherCoverage || 0}%`, "Saved fixtures carrying a weather-risk snapshot"],
  ].map(([metric, value, detail]) => ({ metric, value, detail }));
  return tableToCsv([
    { label: "Metric", value: "metric" },
    { label: "Value", value: "value" },
    { label: "Detail", value: "detail" },
  ], rows);
}

export function downloadCsv(csv, filename) {
  if (typeof document === "undefined") return false;
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export { escapeCsv, tableToCsv };
