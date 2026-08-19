const DAY_KEYS = ["saturday", "sunday", "midweek"];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function savedDay(entry = {}, key) {
  return asArray(entry.fixtureDays).find((day) => day?.key === key) || null;
}

function withStatus(fixtures, status) {
  return asArray(fixtures).map((fixture) => ({
    ...fixture,
    status: fixture?.status || status,
  }));
}

function dayFixtures(day = null, compatibility = {}) {
  if (day) {
    return [
      ...withStatus(day.scheduled, "scheduled"),
      ...withStatus(day.postponed, "postponed"),
      ...withStatus(day.cancelled, "cancelled"),
    ];
  }

  return [
    ...withStatus(compatibility.scheduled, "scheduled"),
    ...withStatus(compatibility.postponed, "postponed"),
    ...withStatus(compatibility.cancelled, "cancelled"),
  ];
}

function restoreDay(entry, key) {
  const day = savedDay(entry, key);
  const compatibility = key === "saturday"
    ? {
        scheduled: entry.scheduled,
        postponed: entry.postponedGames,
        cancelled: entry.cancelledGames,
        date: entry.date,
      }
    : key === "sunday"
      ? {
          scheduled: entry.sunScheduled,
          postponed: entry.sunPostponed,
          cancelled: entry.sunCancelled,
          date: entry.sunDate,
        }
      : {
          scheduled: entry.midweekScheduled,
          postponed: entry.midweekPostponed,
          cancelled: entry.midweekCancelled,
          date: entry.midweekDate,
        };

  const fixtures = dayFixtures(day, compatibility);
  return Object.freeze({
    key,
    date: String(day?.date || compatibility.date || "").trim(),
    dateLabel: String(day?.dateLabel || day?.label || "").trim(),
    fixtures,
    hasRun: Boolean(day?.hasRun ?? fixtures.length > 0),
  });
}

export function buildHistoryRestoreState(entry = {}) {
  const days = Object.fromEntries(DAY_KEYS.map((key) => [key, restoreDay(entry, key)]));
  const firstPopulatedDay = DAY_KEYS.find((key) => days[key].hasRun || days[key].fixtures.length > 0)
    || "saturday";

  return Object.freeze({
    id: entry.id,
    label: entry.dateLabel || "Saved matchweek",
    saturday: days.saturday,
    sunday: days.sunday,
    midweek: days.midweek,
    firstPopulatedDay,
  });
}
