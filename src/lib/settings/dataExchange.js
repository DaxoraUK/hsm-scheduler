function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows = [], columns = []) {
  const header = columns.map((column) => csvEscape(column.label || column.key)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => {
      const raw = typeof column.get === "function" ? column.get(row) : row?.[column.key];
      return csvEscape(raw);
    }).join(",")
  );
  return [header, ...body].join("\n");
}

export function parseCsv(text = "") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((header) => String(header || "").trim());
  return rows
    .slice(1)
    .filter((values) => values.some((value) => String(value || "").trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(text)) return true;
  if (["false", "0", "no", "n", "off"].includes(text)) return false;
  return fallback;
}

export function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function downloadText(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename, rows, columns) {
  downloadText(filename, toCsv(rows, columns), "text/csv;charset=utf-8");
}

export function downloadJson(filename, data) {
  downloadText(filename, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
}

export async function readImportFile(file) {
  const text = await file.text();
  const lowerName = String(file.name || "").toLowerCase();
  if (lowerName.endsWith(".json") || file.type?.includes("json")) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.data)) return parsed.data;
    const firstArray = Object.values(parsed || {}).find(Array.isArray);
    return firstArray || [];
  }
  return parseCsv(text);
}

export function mapImportedRows(rows = [], columns = []) {
  const aliases = new Map();
  columns.forEach((column) => {
    [column.key, column.label, ...(column.aliases || [])].filter(Boolean).forEach((alias) => {
      aliases.set(String(alias).trim().toLowerCase(), column.key);
    });
  });

  return rows.map((row) => {
    const mapped = {};
    Object.entries(row || {}).forEach(([key, value]) => {
      const target = aliases.get(String(key).trim().toLowerCase()) || key;
      mapped[target] = value;
    });
    return mapped;
  });
}
