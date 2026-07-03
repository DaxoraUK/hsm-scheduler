const MIDWEEK_DATE_KEY = "gc_midweek_date";
const MIDWEEK_WINDOW_KEY = "gc_midweek_window";

function pad(value) {
  return String(value).padStart(2, "0");
}

export function toLocalDateInputValue(date = new Date()) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) return "";
  return `${safeDate.getFullYear()}-${pad(safeDate.getMonth() + 1)}-${pad(safeDate.getDate())}`;
}

export function parseLocalDateInput(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function getCurrentOrNextMidweekDate(now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = date.getDay();

  if (day >= 1 && day <= 5) return toLocalDateInputValue(date);

  const daysUntilMonday = day === 6 ? 2 : 1;
  date.setDate(date.getDate() + daysUntilMonday);
  return toLocalDateInputValue(date);
}

export function getInitialMidweekDate(now = new Date()) {
  try {
    const saved = window.localStorage.getItem(MIDWEEK_DATE_KEY);
    if (parseLocalDateInput(saved)) return saved;
  } catch (error) {
    // Local storage is optional.
  }

  return getCurrentOrNextMidweekDate(now);
}

export function persistMidweekDate(value) {
  if (!parseLocalDateInput(value)) return;
  try {
    window.localStorage.setItem(MIDWEEK_DATE_KEY, value);
  } catch (error) {
    // Local storage is optional.
  }
}

export function formatMidweekDate(value, fallback = "Midweek") {
  const date = parseLocalDateInput(value);
  if (!date) return fallback;

  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function isWeekendDate(value) {
  const date = parseLocalDateInput(value);
  if (!date) return false;
  return date.getDay() === 0 || date.getDay() === 6;
}

export function getInitialMidweekWindow() {
  const fallback = { start: "18:00", end: "21:30" };

  try {
    const saved = JSON.parse(window.localStorage.getItem(MIDWEEK_WINDOW_KEY) || "null");
    if (
      saved &&
      /^\d{2}:\d{2}$/.test(saved.start || "") &&
      /^\d{2}:\d{2}$/.test(saved.end || "")
    ) {
      return saved;
    }
  } catch (error) {
    // Use the safe default.
  }

  return fallback;
}

export function persistMidweekWindow(windowValue) {
  try {
    window.localStorage.setItem(MIDWEEK_WINDOW_KEY, JSON.stringify(windowValue));
  } catch (error) {
    // Local storage is optional.
  }
}

export function timeValueToMinutes(value, fallback = 0) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return fallback;
  }

  return hours * 60 + minutes;
}
