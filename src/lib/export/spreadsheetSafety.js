export function neutraliseSpreadsheetFormula(value) {
  if (typeof value !== "string") return value;
  return /^[=+@-]/.test(value) ? `'${value}` : value;
}
