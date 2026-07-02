import { useCallback } from "react";
import { isSupaConfigured, DB, supaFetch } from "../lib/supabase.js";
import { toast } from "sonner";
import { decorateFixturesForDay, normaliseFixtureDayKey } from "../lib/domain/fixtureDay.js";

function splitFixtures(fixtures = [], dayKey) {
  const decorated = decorateFixturesForDay(fixtures, dayKey);
  return {
    active: decorated.filter(
      (game) => game.status !== "postponed" && game.status !== "cancelled"
    ),
    postponed: decorated.filter((game) => game.status === "postponed"),
    cancelled: decorated.filter((game) => game.status === "cancelled"),
  };
}

function buildFixtureDaySnapshots({
  fixtureDays = [],
  satDate,
  sunDate,
  satDateLabel,
  sunDateLabel,
  satHasRun,
  satFinal,
  sunHasRun,
  sunFinal,
  midweekDate,
  midweekDateLabel,
  midweekHasRun,
  midweekFinal,
}) {
  if (Array.isArray(fixtureDays) && fixtureDays.length) {
    return fixtureDays.map((day) => {
      const key = normaliseFixtureDayKey(day.key);
      const split = splitFixtures(day.final || day.scheduled || [], key);
      return {
        key,
        label: day.label,
        date: day.date || "",
        dateLabel: day.dateLabel || day.label,
        hasRun: Boolean(day.hasRun),
        operatingWindow: day.operatingWindow || null,
        ruleProfile: day.ruleProfile || null,
        rules: day.rules || {},
        scheduled: split.active,
        postponed: split.postponed,
        cancelled: split.cancelled,
      };
    });
  }

  return [
    ["midweek", "Midweek", midweekDate, midweekDateLabel, midweekHasRun, midweekFinal],
    ["saturday", "Saturday", satDate, satDateLabel, satHasRun, satFinal],
    ["sunday", "Sunday", sunDate, sunDateLabel, sunHasRun, sunFinal],
  ].map(([key, label, date, dateLabel, hasRun, final]) => {
    const split = splitFixtures(final, key);
    return {
      key,
      label,
      date: date || "",
      dateLabel: dateLabel || label,
      hasRun: Boolean(hasRun),
      scheduled: split.active,
      postponed: split.postponed,
      cancelled: split.cancelled,
    };
  });
}

export function useWeekPersistence({
  mode,
  satDate,
  sunDate,
  satDateLabel,
  sunDateLabel,
  satHasRun,
  satFinal,
  satActive,
  satPostponed,
  sunHasRun,
  sunFinal,
  sunActive,
  sunPostponed,
  midweekDate,
  midweekDateLabel,
  midweekHasRun,
  midweekFinal,
  midweekActive,
  midweekPostponed,
  fixtureDays = [],
  club,
  history,
  setHistory,
  setDbStatus,
  authSession,
}) {
  const saveWeek = useCallback(async () => {
    const snapshots = buildFixtureDaySnapshots({
      fixtureDays,
      satDate,
      sunDate,
      satDateLabel,
      sunDateLabel,
      satHasRun,
      satFinal,
      sunHasRun,
      sunFinal,
      midweekDate,
      midweekDateLabel,
      midweekHasRun,
      midweekFinal,
    });
    const publishedDays = snapshots.filter((day) => day.hasRun);
    if (!publishedDays.length) return;

    const byKey = Object.fromEntries(snapshots.map((day) => [day.key, day]));
    const saturday = byKey.saturday || { scheduled: [], postponed: [], cancelled: [] };
    const sunday = byKey.sunday || { scheduled: [], postponed: [], cancelled: [] };
    const midweek = byKey.midweek || { scheduled: [], postponed: [], cancelled: [] };

    const entry = {
      id: Date.now(),
      dateLabel:
        mode === "test"
          ? "Test Matchweek"
          : saturday.hasRun || sunday.hasRun
            ? satDateLabel
            : midweekDateLabel || "Midweek",
      date: saturday.hasRun || sunday.hasRun ? satDate || undefined : midweekDate || undefined,
      savedAt: new Date().toISOString(),
      carParkSpaces: club.carParkSpaces || 57,

      // Canonical v2 history model.
      fixtureDays: publishedDays,

      // Compatibility fields retained for existing analytics and reports.
      scheduled: saturday.scheduled || satActive || [],
      postponedGames: saturday.postponed || satPostponed || [],
      postponed: (saturday.postponed || satPostponed || []).length,
      sunScheduled: sunday.scheduled || sunActive || [],
      sunPostponed: sunday.postponed || sunPostponed || [],
      midweekDate: midweek.date || midweekDate || "",
      midweekDateLabel: midweek.dateLabel || midweekDateLabel || "Midweek",
      midweekScheduled: midweek.scheduled || midweekActive || [],
      midweekPostponed: midweek.postponed || midweekPostponed || [],
    };

    const updated = [entry, ...history].slice(0, 20);
    setHistory(updated);

    if (isSupaConfigured()) {
      setDbStatus("saving");
      const ok = await DB.saveHistory(updated);
      setDbStatus(ok ? "connected" : "error");

      if (ok && authSession) {
        const user = authSession.user || {};
        supaFetch("POST", "audit_log", [
          {
            id: `wk_${Date.now()}`,
            data: {
              action: "save_matchweek",
              user_email: user.email || "unknown",
              user_name:
                user.user_metadata?.display_name || user.email || "unknown",
              timestamp: new Date().toISOString(),
              detail: {
                week: entry.dateLabel,
                fixture_days: publishedDays.map((day) => ({
                  key: day.key,
                  date: day.date,
                  fixtures: day.scheduled.length,
                  postponed: day.postponed.length,
                })),
              },
            },
          },
        ]);
      }

      if (ok) {
        toast.success("Matchweek published", {
          description: publishedDays
            .map((day) => `${day.label}: ${day.scheduled.length}`)
            .join(". "),
        });
      } else {
        toast.error("Saved locally only", {
          description: "Supabase sync failed. Please check the connection.",
        });
      }
    } else {
      toast.info("Saved locally", {
        description: "Supabase is not configured. Data is stored on this device only.",
      });
    }
  }, [
    mode,
    satDate,
    sunDate,
    satDateLabel,
    sunDateLabel,
    satHasRun,
    satFinal,
    satActive,
    satPostponed,
    sunHasRun,
    sunFinal,
    sunActive,
    sunPostponed,
    midweekDate,
    midweekDateLabel,
    midweekHasRun,
    midweekFinal,
    midweekActive,
    midweekPostponed,
    fixtureDays,
    club,
    history,
    setHistory,
    setDbStatus,
    authSession,
  ]);

  return { saveWeek };
}
