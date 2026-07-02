const WEEKEND_STORAGE_KEY = "gc_match_weekend";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function startOfLocalDay(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function parseLocalDate(value) {
  if (value instanceof Date) return startOfLocalDay(value);
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return startOfLocalDay(date);
}

export function toDateInputValue(value) {
  const date = startOfLocalDay(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfLocalDay(next);
}

export function getWeekendForDate(value = new Date()) {
  const date = startOfLocalDay(value) || startOfLocalDay(new Date());
  const day = date.getDay();

  // Sunday belongs to the weekend that started the previous day.
  // Monday-Friday resolve to the upcoming weekend; Saturday resolves to today.
  const daysToSaturday = day === 0 ? -1 : 6 - day;
  const saturday = addDays(date, daysToSaturday);
  const sunday = addDays(saturday, 1);

  return {
    saturday: toDateInputValue(saturday),
    sunday: toDateInputValue(sunday),
  };
}

export function getWeekendFromSaturday(value) {
  const selected = parseLocalDate(value);
  return selected ? getWeekendForDate(selected) : getWeekendForDate(new Date());
}

export function getWeekendFromSunday(value) {
  const selected = parseLocalDate(value);
  if (!selected) return getWeekendForDate(new Date());

  const sunday = selected.getDay() === 0 ? selected : addDays(selected, 7 - selected.getDay());
  const saturday = addDays(sunday, -1);
  return {
    saturday: toDateInputValue(saturday),
    sunday: toDateInputValue(sunday),
  };
}

export function getCurrentMatchWeekend(now = new Date()) {
  return getWeekendForDate(now);
}

export function getInitialMatchWeekend(now = new Date()) {
  const current = getCurrentMatchWeekend(now);
  if (typeof window === "undefined") return current;

  try {
    const saved = JSON.parse(window.localStorage.getItem(WEEKEND_STORAGE_KEY) || "null");
    const savedSaturday = parseLocalDate(saved?.saturday);
    const savedSunday = parseLocalDate(saved?.sunday);
    const today = startOfLocalDay(now);

    if (!savedSaturday || !savedSunday || !today) return current;

    // Never reopen the app on a completed weekend. Future selected weekends remain selected.
    if (savedSunday < today) return current;

    return {
      saturday: toDateInputValue(savedSaturday),
      sunday: toDateInputValue(savedSunday),
    };
  } catch (error) {
    return current;
  }
}

export function persistMatchWeekend(weekend) {
  if (typeof window === "undefined") return;
  if (!parseLocalDate(weekend?.saturday) || !parseLocalDate(weekend?.sunday)) return;

  try {
    window.localStorage.setItem(
      WEEKEND_STORAGE_KEY,
      JSON.stringify({ saturday: weekend.saturday, sunday: weekend.sunday })
    );
  } catch (error) {
    // Calendar persistence is a convenience only.
  }
}

export function formatMatchdayDate(value, fallback = "Matchday") {
  const date = parseLocalDate(value);
  if (!date) return fallback;

  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
