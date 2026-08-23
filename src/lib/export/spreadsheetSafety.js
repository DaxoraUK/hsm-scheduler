export function neutraliseSpreadsheetFormula(value) {
  if (typeof value !== "string") return value;
  return /^\s*[=+@-]/.test(value) ? `'${value}` : value;
}
