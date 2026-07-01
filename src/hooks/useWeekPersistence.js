import { useCallback } from "react";
import { isSupaConfigured, DB, supaFetch } from "../lib/supabase.js";
import { toast } from "sonner";

export function useWeekPersistence({
  mode,
  satDateLabel,
  satHasRun,
  satFinal,
  satActive,
  satPostponed,
  sunHasRun,
  sunFinal,
  club,
  history,
  setHistory,
  setDbStatus,
  authSession,
}) {
  const saveWeek = useCallback(async () => {
    if (!satHasRun || !satFinal.length) return;

    const sunActive = sunHasRun
      ? sunFinal.filter((game) => game.status !== "postponed")
      : [];

    const sunPostponed = sunHasRun
      ? sunFinal.filter((game) => game.status === "postponed")
      : [];

    const entry = {
      id: Date.now(),
      dateLabel: mode === "test" ? "Test Week" : satDateLabel,
      scheduled: satActive,
      postponedGames: satPostponed,
      postponed: satPostponed.length,
      sunScheduled: sunActive,
      sunPostponed,
      carParkSpaces: club.carParkSpaces || 57,
      savedAt: new Date().toISOString(),
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
            id: "wk_" + String(Date.now()),
            data: {
              action: "save_week",
              user_email: user.email || "unknown",
              user_name:
                (user.user_metadata && user.user_metadata.display_name) ||
                user.email ||
                "unknown",
              timestamp: new Date().toISOString(),
              detail: {
                week: entry.dateLabel,
                sat_fixtures: satActive.length,
                sun_fixtures: sunActive.length,
              },
            },
          },
        ]);
      }

      if (ok) {
        toast.success("Weekend published", {
          description:
            "Saturday: " +
            satActive.length +
            " games. Sunday: " +
            (sunHasRun ? sunActive.length + " games." : "not scheduled."),
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
    satDateLabel,
    satHasRun,
    satFinal,
    satActive,
    satPostponed,
    sunHasRun,
    sunFinal,
    club,
    history,
    setHistory,
    setDbStatus,
    authSession,
  ]);

  return { saveWeek };
}