import { useCallback } from "react";
import { isSupaConfigured, DB } from "../lib/supabase.js";
import { toast } from "sonner";
import {
  decorateFixturesForDay,
  normaliseFixtureDayKey,
} from "../lib/domain/fixtureDay.js";
import { getParkingCapacity } from "../lib/domain/clubDomain.js";
import { getParkingSettings } from "../lib/intelligence/parking/parkingService.js";
import { weatherService } from "../lib/services/weatherService.js";
import { calculateWeatherIntelligence } from "../lib/engines/weatherIntelligenceEngine.js";
import { ENTITLEMENTS, hasEntitlement } from "../lib/subscriptions/entitlements.js";
import { ELITE_APPROVAL_TYPES, buildEliteEntityKey, createEliteApprovalRequest, loadEliteApprovalState } from "../lib/elite/eliteGovernanceService.js";


function approvalFixtureSignature(day = {}) {
  const rows = [
    ...(Array.isArray(day.scheduled) ? day.scheduled : []),
    ...(Array.isArray(day.postponed) ? day.postponed : []),
    ...(Array.isArray(day.cancelled) ? day.cancelled : []),
  ];
  return rows.map((fixture) => [
    day.key || day.label || "",
    fixture.id || fixture.fixtureId || "",
    fixture.homeTeam || fixture.team || fixture.teamName || "",
    fixture.awayTeam || fixture.opposition || "",
    fixture.ko || fixture.kickOff || fixture.time || "",
    fixture.pitchId || fixture.pitch || fixture.pitchName || "",
    fixture.status || "scheduled",
  ].join("~"));
}

function splitFixtures(fixtures = [], dayKey) {
  const decorated = decorateFixturesForDay(fixtures, dayKey);
  return {
    active: decorated.filter(
      (game) => game.status !== "postponed" && game.status !== "cancelled",
    ),
    postponed: decorated.filter((game) => game.status === "postponed"),
    cancelled: decorated.filter((game) => game.status === "cancelled"),
  };
}

function attachWeatherExposure(fixture = {}, exposure = null, forecast = null) {
  if (!exposure?.risk?.key) return fixture;
  return {
    ...fixture,
    weatherRisk: exposure.risk.key,
    weather: {
      provider: forecast?.provider || forecast?.source || "Connected feed",
      updatedAt: forecast?.updatedAt || new Date().toISOString(),
      forecastTime: exposure.forecastTime || exposure.time || null,
      conditions: exposure.conditions || null,
      temperatureC: exposure.temperatureC ?? null,
      windMph: exposure.windMph ?? null,
      rainProbability: exposure.rainProbability ?? null,
      rainfallMm: exposure.rainfallMm ?? null,
      risk: exposure.risk,
    },
  };
}

export async function captureWeatherSnapshots(
  days = [],
  club = {},
  service = weatherService,
) {
  const config = service.getConfiguration(club);
  if (!config.enabled || !config.postcode) return days;

  return Promise.all(
    days.map(async (day) => {
      if (!day?.hasRun || !day?.date || !day?.scheduled?.length) return day;
      const controller =
        typeof AbortController === "undefined" ? null : new AbortController();
      const timeout = controller
        ? setTimeout(() => controller.abort(), 3500)
        : null;
      try {
        const forecast = await service.getForecast({
          postcode: config.postcode,
          date: day.date,
          fixtures: day.scheduled,
          signal: controller?.signal,
        });
        const snapshot = calculateWeatherIntelligence({
          club,
          fixtures: day.scheduled,
          dateLabel: day.dateLabel || day.label,
          forecastSource: forecast,
          connectionStatus:
            forecast?.cacheStatus === "stale" ? "stale" : "success",
          connectionError: forecast?.warning || null,
        });
        const exposureById = new Map(
          (snapshot.fixtureExposure || []).map((exposure) => [
            String(exposure.id),
            exposure,
          ]),
        );
        const scheduled = day.scheduled.map((fixture, index) => {
          const key = String(
            fixture.id || fixture.fixtureId || `weather-fixture-${index}`,
          );
          const exposure =
            exposureById.get(key) || snapshot.fixtureExposure?.[index] || null;
          return attachWeatherExposure(fixture, exposure, forecast);
        });
        return {
          ...day,
          scheduled,
          weatherSnapshot: {
            provider: snapshot.provider,
            updatedAt: snapshot.updatedAt,
            overallRisk: snapshot.overallRisk,
            forecast: snapshot.forecast,
            metrics: snapshot.metrics,
            cacheStatus: forecast?.cacheStatus || "live",
          },
        };
      } catch {
        // Saving the operational record must not fail because a forecast is unavailable.
        return day;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }),
  );
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
    [
      "midweek",
      "Midweek",
      midweekDate,
      midweekDateLabel,
      midweekHasRun,
      midweekFinal,
    ],
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
  activeClubId = "",
  subscription = null,
  canPublish = true,
  onSyncFailure,
  onSyncSuccess,
}) {
  const saveWeek = useCallback(async () => {
    if (!canPublish) {
      toast.error("Read-only access", {
        description: "Your club role cannot publish or save matchweeks.",
      });
      return false;
    }
    const baseSnapshots = buildFixtureDaySnapshots({
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
    const snapshots = await captureWeatherSnapshots(baseSnapshots, club);
    const publishedDays = snapshots.filter((day) => day.hasRun);
    if (!publishedDays.length) return;

    let approvalEntityKey = "";
    if (hasEntitlement(subscription, ENTITLEMENTS.APPROVAL_WORKFLOWS) && activeClubId) {
      approvalEntityKey = buildEliteEntityKey(
        ELITE_APPROVAL_TYPES.MATCHWEEK,
        publishedDays.flatMap(approvalFixtureSignature),
      );
      try {
        const approvalState = await loadEliteApprovalState(activeClubId, ELITE_APPROVAL_TYPES.MATCHWEEK, approvalEntityKey);
        if (approvalState.policy.matchweekApprovalRequired && !approvalState.approved) {
          if (!approvalState.pending) {
            await createEliteApprovalRequest(activeClubId, {
              approvalType: ELITE_APPROVAL_TYPES.MATCHWEEK,
              entityKey: approvalEntityKey,
              title: "Current matchweek release",
              summary: `${publishedDays.reduce((total, day) => total + (day.scheduled?.length || 0), 0)} scheduled fixtures across ${publishedDays.length} operating day${publishedDays.length === 1 ? "" : "s"}.`,
              snapshot: {
                days: publishedDays.map((day) => ({ key: day.key, date: day.date, scheduled: day.scheduled?.length || 0, postponed: day.postponed?.length || 0, cancelled: day.cancelled?.length || 0 })),
              },
            });
          }
          toast.info("Elite approval required", {
            description: approvalState.pending
              ? "This exact matchweek is already waiting for a separate reviewer in Organisation Command."
              : "An approval request has been created in Organisation Command. A separate reviewer must approve this exact matchweek before publication.",
          });
          return false;
        }
      } catch (error) {
        toast.error("Matchweek approval could not be checked", { description: error?.message });
        return false;
      }
    }

    const byKey = Object.fromEntries(snapshots.map((day) => [day.key, day]));
    const saturday = byKey.saturday || {
      scheduled: [],
      postponed: [],
      cancelled: [],
    };
    const sunday = byKey.sunday || {
      scheduled: [],
      postponed: [],
      cancelled: [],
    };
    const midweek = byKey.midweek || {
      scheduled: [],
      postponed: [],
      cancelled: [],
    };

    const parkingSettings = getParkingSettings(club);
    const parkingCapacity = getParkingCapacity(club, 0);
    const entry = {
      id: Date.now(),
      dateLabel:
        mode === "test"
          ? "Demonstration Matchweek"
          : saturday.hasRun || sunday.hasRun
            ? satDateLabel
            : midweekDateLabel || "Midweek",
      date:
        saturday.hasRun || sunday.hasRun
          ? satDate || undefined
          : midweekDate || undefined,
      savedAt: new Date().toISOString(),
      approvalEntityKey: approvalEntityKey || undefined,
      carParkSpaces: parkingCapacity,
      parking: {
        enabled: parkingSettings.enabled,
        capacity: parkingCapacity,
        maxConcurrent: parkingSettings.maxConcurrent,
        pressureThresholdPct: parkingSettings.parkingPressureThresholdPct,
        avgCars: parkingSettings.avgCars,
      },

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

    let cloudSaved = true;
    const publishToCloud = () => DB.saveHistoryEntry(activeClubId, entry);

    if (isSupaConfigured() && activeClubId) {
      setDbStatus("saving");
      try {
        await publishToCloud();
        setDbStatus("connected");
        onSyncSuccess?.();
        toast.success("Matchweek published", {
          description: publishedDays
            .map((day) => `${day.label}: ${day.scheduled.length}`)
            .join(". "),
        });
      } catch (error) {
        cloudSaved = false;
        setDbStatus("error");
        onSyncFailure?.(error, publishToCloud);
        toast.error("Matchweek was not published", {
          description:
            error?.message ||
            "The secure workspace rejected the update. No browser-only copy was created.",
        });
        return false;
      }
    } else if (activeClubId) {
      toast.error("Secure workspace unavailable", {
        description: "Ground Control cannot publish authenticated club data without the cloud workspace.",
      });
      return false;
    } else {
      toast.info("Saved in local demonstration mode", {
        description: "This local-only save is available only when no authenticated club workspace is active.",
      });
    }

    setHistory(updated);
    return cloudSaved;
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
    activeClubId,
    subscription,
    canPublish,
    onSyncFailure,
    onSyncSuccess,
  ]);

  return { saveWeek };
}
