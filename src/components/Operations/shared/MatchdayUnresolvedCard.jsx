import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "../../../lib/notifications/daxoraNotifications.js";
import ConfirmDialog from "../../../ui/ConfirmDialog.jsx";
import { cleanName, resolveFixtureTeam } from "../../../lib/scheduler.js";
import { sortPitches } from "../../../lib/pitches.js";
import {
  getPitchDisplayFormat,
  getPitchSuitabilityReason,
  isPitchSuitableForFixture,
} from "../../../lib/intelligence/pitch/pitchService.js";
import {
  getKickOffRuleFailure,
  getSuggestionWindowForFixture,
  isKickOffAllowedForFixture,
} from "../../../lib/intelligence/scheduling/kickOffRules.js";
import { getFixtureFlowIdentity } from "../../../lib/domain/fixtureVenueFlow.js";
import { getFixtureOccupancy, SCHEDULING_TIME_INCREMENT_MINS } from "../../../lib/domain/fixtureOccupancy.js";

function timeToMinutes(time) {
  const [hours, minutes] = String(time || "").split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  return hours * 60 + minutes;
}

function minutesToTime(totalMins) {
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getDuration(fixture = {}, cfg = {}, timing = {}) {
  return getFixtureOccupancy({ fixture: { ...fixture, cfg }, timing }).occupancyMins;
}

function getBlockedPitchIds(pitchId, pitchCfg = []) {
  const pitch = pitchCfg.find((item) => item.id === pitchId);
  const parentId = pitch?.innerOf || null;
  const childIds = pitchCfg
    .filter((item) => item.innerOf === pitchId)
    .map((item) => item.id);

  return [pitchId, parentId, ...childIds].filter(Boolean);
}

function isActiveFixture(fixture = {}) {
  const status = String(fixture.status || "active").toLowerCase();

  return status !== "postponed" && status !== "cancelled";
}

function getSuitablePitches({ fixture = {}, cfg = {}, pitchCfg = [], closedPitches = [] } = {}) {
  const preferredIds = [cfg.defaultPitch, cfg.altPitch].filter(Boolean);
  const fixtureWithCfg = { ...fixture, cfg };

  return sortPitches(pitchCfg)
    .filter((pitch) => {
      if (!pitch?.id) return false;
      if (closedPitches.includes(pitch.id)) return false;
      return isPitchSuitableForFixture(pitch, fixtureWithCfg);
    })
    .sort((a, b) => {
      const aPreferred = preferredIds.indexOf(a.id);
      const bPreferred = preferredIds.indexOf(b.id);

      if (aPreferred !== -1 || bPreferred !== -1) {
        if (aPreferred === -1) return 1;
        if (bPreferred === -1) return -1;
        return aPreferred - bPreferred;
      }

      return a.label.localeCompare(b.label);
    });
}

function findPitchClash({
  scheduled = [],
  pitchCfg = [],
  pitchId,
  koMins,
  endMins,
} = {}) {
  const blockedPitchIds = getBlockedPitchIds(pitchId, pitchCfg);

  return (
    scheduled.find((game) => {
      if (!isActiveFixture(game)) return false;
      if (!blockedPitchIds.includes(game.pitchId)) return false;

      const gameKo =
        game.koMins != null ? game.koMins : timeToMinutes(game.koTime);
      const gameEnd = game.endMins != null ? game.endMins : gameKo;

      if (gameKo == null || gameEnd == null) return false;

      return koMins < gameEnd && gameKo < endMins;
    }) || null
  );
}

function getConcurrentCount({
  scheduled = [],
  koMins,
  endMins,
} = {}) {
  return scheduled.filter((game) => {
    if (!isActiveFixture(game)) return false;

    const gameKo =
      game.koMins != null ? game.koMins : timeToMinutes(game.koTime);
    const gameEnd = game.endMins != null ? game.endMins : gameKo;

    if (gameKo == null || gameEnd == null) return false;

    return koMins < gameEnd && gameKo < endMins;
  }).length;
}

function buildResolutionSuggestions({
  fixture = {},
  club = {},
  teamCfg = [],
  pitchCfg = [],
  closedPitches = [],
  scheduled = [],
  limit = 3,
} = {}) {
  const cfg = resolveFixtureTeam(fixture, teamCfg);
  const duration = getDuration(fixture, cfg, club?.timingSettings || {});
  const suitablePitches = getSuitablePitches({ fixture, cfg, pitchCfg, closedPitches });
  const maxConcurrent = Number(club.maxConcurrent || 3);
  const fixtureWithCfg = { ...fixture, cfg };
  const window = getSuggestionWindowForFixture({ fixture: fixtureWithCfg, club });
  const startMins = timeToMinutes(window.start) ?? 8 * 60 + 30;
  const endMins = timeToMinutes(window.end) ?? 11 * 60 + 30;
  const suggestions = [];

  suitablePitches.forEach((pitch) => {
    for (let koMins = startMins; koMins <= endMins; koMins += SCHEDULING_TIME_INCREMENT_MINS) {
      const koTime = minutesToTime(koMins);

      if (!isKickOffAllowedForFixture({ fixture: fixtureWithCfg, koTime, club })) continue;

      const fixtureEndMins = koMins + duration;

      const pitchClash = findPitchClash({
        scheduled,
        pitchCfg,
        pitchId: pitch.id,
        koMins,
        endMins: fixtureEndMins,
      });

      if (pitchClash) continue;

      const concurrentCount = getConcurrentCount({
        scheduled,
        koMins,
        endMins: fixtureEndMins,
      });

      if (concurrentCount >= maxConcurrent) continue;

      const isDefault = pitch.id === cfg?.defaultPitch;
      const isAlt = pitch.id === cfg?.altPitch;

      const score =
        (isDefault ? 100 : 0) +
        (isAlt ? 80 : 0) -
        Math.abs(koMins - startMins) / SCHEDULING_TIME_INCREMENT_MINS -
        concurrentCount * 4;

      suggestions.push({
        pitchId: pitch.id,
        pitchLabel: pitch.label || pitch.id,
        pitchDesc: pitch.desc || getPitchDisplayFormat(pitch),
        koTime,
        koMins,
        endMins: fixtureEndMins,
        cfg,
        score,
        confidence: Math.max(72, Math.min(98, Math.round(92 + score / 20))),
        reasons: [
          `${getPitchDisplayFormat(pitch)} pitch matches ${cfg?.format || fixture.manualFormat || fixture.format || "the fixture format"}`,
          "Pitch is open",
          "Pitch is available",
          "Parking concurrency remains within limit",
          isDefault
            ? "Uses preferred pitch"
            : isAlt
            ? "Uses alternative configured pitch"
            : "Uses compatible pitch",
        ],
      });
    }
  });

  return suggestions
    .sort((a, b) => b.score - a.score || a.koMins - b.koMins)
    .slice(0, limit);
}

export default function MatchdayUnresolvedCard({
  club,
  teamCfg,
  pitchCfg,
  closedPitches = [],
  scheduled = [],
  unresolved = [],
  overrides = {},
  onOverride,
  onResolveFixture,
  readOnly = false,
}) {
  const [pendingOverride, setPendingOverride] = useState(null);
  const [resolvingFixtureIdentity, setResolvingFixtureIdentity] = useState("");

  if (unresolved.length === 0) return null;

  const resolveFixture = async ({ fixture, patch, cfg, overridden = false }) => {
    if (readOnly) return false;
    const fixtureIdentity = getFixtureFlowIdentity(fixture);
    if (!fixtureIdentity || typeof onResolveFixture !== "function") return false;
    const koMins =
      patch.koMins != null ? patch.koMins : timeToMinutes(patch.koTime);
    const duration = getDuration(cfg);
    const endMins =
      patch.endMins != null ? patch.endMins : koMins != null ? koMins + duration : null;

    setResolvingFixtureIdentity(fixtureIdentity);
    try {
      const scheduledFixture = await onResolveFixture(fixture, {
        ...patch,
        koMins,
        endMins,
        cfg,
        overridden,
      });
      if (!scheduledFixture) {
        throw new Error("Fixture remains unresolved after validation");
      }
      return scheduledFixture;
    } catch (error) {
      toast.error("Fixture assignment was not saved", {
        description: error?.message || "Fixture remains unresolved after validation.",
      });
      return false;
    } finally {
      setResolvingFixtureIdentity("");
    }
  };

  const completeManualAssignment = async ({ fixture, ov, cfg, koMins, endMins, clash = null }) => {
    const selectedPitch = pitchCfg.find((pitch) => pitch.id === ov.pitchId);

    const scheduledFixture = await resolveFixture({
      fixture,
      cfg,
      overridden: Boolean(clash),
      patch: {
        ...ov,
        pitchLabel: selectedPitch?.label || ov.pitchId,
        koMins,
        endMins,
      },
    });

    if (!scheduledFixture) return false;
    setPendingOverride(null);

    if (clash) {
      toast.success("Fixture assigned with override", {
        description: "The pitch conflict remains recorded for operational review.",
      });
    } else {
      toast.success("Fixture assigned", {
        description: `${scheduledFixture.koTime || ov.koTime} on ${scheduledFixture.pitchLabel || selectedPitch?.label || ov.pitchId} is now in the operational schedule.`,
      });
    }
    return scheduledFixture;
  };

  const confirmManualAssignment = async ({ fixture, index }) => {
    if (readOnly) return;
    const ov = overrides[getFixtureFlowIdentity(fixture)] || {};

    if (!ov.pitchId) {
      toast.error("Select a pitch first", {
        description: "Choose a suitable open pitch before confirming the fixture.",
      });
      return;
    }

    if (!ov.koTime) {
      toast.error("Set a kick-off time", {
        description: "Choose an allowed kick-off time before confirming the fixture.",
      });
      return;
    }

    if (closedPitches.includes(ov.pitchId)) {
      const selectedPitch = pitchCfg.find((pitch) => pitch.id === ov.pitchId);
      toast.error(`${selectedPitch?.label || ov.pitchId} is closed`, {
        description: "Choose another pitch or reopen it from the Resources workspace.",
      });
      return;
    }

    const koMins = timeToMinutes(ov.koTime);
    const cfg = resolveFixtureTeam(fixture, teamCfg);
    const selectedPitch = pitchCfg.find((pitch) => pitch.id === ov.pitchId);

    if (!isPitchSuitableForFixture(selectedPitch, { ...fixture, cfg })) {
      toast.error("Pitch format does not match", {
        description: getPitchSuitabilityReason(selectedPitch, { ...fixture, cfg }),
      });
      return;
    }

    const koRuleFailure = getKickOffRuleFailure({
      fixture: { ...fixture, cfg },
      koTime: ov.koTime,
      club,
    });

    if (koRuleFailure) {
      toast.error(koRuleFailure.title, {
        description: koRuleFailure.detail,
      });
      return;
    }

    const duration = getDuration(cfg);
    const endMins = koMins + duration;

    const clash = findPitchClash({
      scheduled,
      pitchCfg,
      pitchId: ov.pitchId,
      koMins,
      endMins,
    });

    if (clash) {
      setPendingOverride({ fixture, index, ov, cfg, koMins, endMins, clash });
      return;
    }

    await completeManualAssignment({ fixture, ov, cfg, koMins, endMins });
  };

  return (
    <section className="rounded-3xl border border-red-200 bg-white shadow-sm">
      <div className="rounded-t-3xl bg-red-700 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
            <AlertTriangle size={22} strokeWidth={2.5} />
          </div>

          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-red-100">
              Operations Resolution Centre
            </div>

            <div className="mt-1 text-xl font-black">
              Fixture Requires Intervention ({unresolved.length})
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {readOnly ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900">
            Schedule locked · unresolved fixtures remain visible, but assignment controls are disabled.
          </div>
        ) : null}
        {unresolved.map((fixture, index) => {
          const cfg = resolveFixtureTeam(fixture, teamCfg);
          const configuredCompatiblePitches = getSuitablePitches({
            fixture,
            cfg,
            pitchCfg,
            closedPitches: [],
          });
          const suitablePitches = getSuitablePitches({
            fixture,
            cfg,
            pitchCfg,
            closedPitches,
          });
          const suggestions = buildResolutionSuggestions({
            fixture,
            club,
            teamCfg,
            pitchCfg,
            closedPitches,
            scheduled,
            limit: 3,
          });

          return (
            <article
              key={`${fixture.homeTeam}-${fixture.awayTeam}-${index}`}
              className="rounded-3xl border border-red-200 bg-red-50/60 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-red-700">
                    Unscheduled Fixture
                  </div>

                  <div className="mt-2 text-lg font-black text-slate-950">
                    {cleanName(fixture.homeTeam, club.name) || fixture.homeTeam || "(no team name)"}
                    <span className="text-slate-400"> vs </span>
                    {fixture.awayTeam || "(no opposition)"}
                  </div>

                  <div className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
                    {fixture.reason || "Ground Control could not automatically schedule this fixture."}
                  </div>
                </div>

                <div className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-red-100">
                  {cfg?.format || "Format TBC"}
                </div>
              </div>

              {suggestions.length > 0 ? (
                <div className="mt-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
                    <Sparkles size={16} />
                    Recommended Fixes
                  </div>

                  <div className="grid gap-3">
                    {suggestions.map((suggestion, suggestionIndex) => (
                      <button
                        type="button"
                        key={`${suggestion.pitchId}-${suggestion.koTime}`}
                        disabled={readOnly}
                        onClick={() =>
                          void resolveFixture({
                            fixture,
                            index,
                            cfg: suggestion.cfg,
                            patch: {
                              pitchId: suggestion.pitchId,
                              pitchLabel: suggestion.pitchLabel,
                              koTime: suggestion.koTime,
                              koMins: suggestion.koMins,
                              endMins: suggestion.endMins,
                            },
                          })
                        }
                        className="rounded-3xl border border-emerald-200 bg-white p-4 text-left transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-black text-emerald-700">
                              {suggestionIndex === 0 ? "Recommended" : `Option ${suggestionIndex + 1}`}
                            </div>

                            <div className="mt-1 text-lg font-black text-slate-950">
                              {suggestion.koTime} on {suggestion.pitchLabel}
                            </div>

                            <div className="mt-1 text-sm font-medium text-slate-500">
                              {suggestion.pitchDesc}
                            </div>
                          </div>

                          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
                            {suggestion.confidence}% confidence
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {suggestion.reasons.map((reason) => (
                            <div
                              key={reason}
                              className="flex items-center gap-2 text-sm font-bold text-slate-600"
                            >
                              <CheckCircle2 size={16} className="text-emerald-600" />
                              {reason}
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white">
                          Apply Fix
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : configuredCompatiblePitches.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
                  No compatible pitch is configured for {cfg?.format || fixture.manualFormat || fixture.format || "this fixture"}. Add a suitable pitch in Settings or update the team&apos;s playing format.
                </div>
              ) : suitablePitches.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
                  Compatible pitches exist, but they are currently closed. Reopen a suitable pitch in Resources before assigning this fixture.
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
                  No automatic fix was found. Review pitch closures, parking concurrency, or manually assign below.
                </div>
              )}

              <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  <SlidersHorizontal size={16} />
                  Manual Override
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_150px_auto] md:items-end">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                      Pitch
                    </label>

                    <select
                      disabled={readOnly}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      onChange={(event) => onOverride(getFixtureFlowIdentity(fixture), "pitchId", event.target.value)}
                    >
                      <option value="">Select pitch...</option>
                      {suitablePitches.map((pitch) => (
                        <option key={pitch.id} value={pitch.id}>
                          {pitch.label} - {pitch.desc || getPitchDisplayFormat(pitch)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                      KO Time
                    </label>

                    <input
                      type="time"
                      disabled={readOnly}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      onChange={(event) => onOverride(getFixtureFlowIdentity(fixture), "koTime", event.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={readOnly || resolvingFixtureIdentity === getFixtureFlowIdentity(fixture)}
                    onClick={() => void confirmManualAssignment({ fixture, index })}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <MapPin size={16} />
                    Confirm Assignment
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(pendingOverride)}
        eyebrow="Manual override"
        title="Assign despite pitch conflict?"
        description="This fixture overlaps another booking on the selected pitch or one of its linked playing areas. The override will remain visible for operational review."
        confirmLabel="Assign with override"
        cancelLabel="Choose another slot"
        tone="danger"
        initialFocus="cancel"
        onCancel={() => setPendingOverride(null)}
        onConfirm={() => pendingOverride && void completeManualAssignment(pendingOverride)}
      >
        <div className="grid gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="font-bold text-rose-700">Existing fixture</span>
            <span className="text-right font-black text-rose-950">
              {pendingOverride ? cleanName(pendingOverride.clash?.homeTeam, club.name) : ""}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-rose-200 pt-2">
            <span className="font-bold text-rose-700">Current kick-off</span>
            <span className="font-black text-rose-950">{pendingOverride?.clash?.koTime || "TBC"}</span>
          </div>
        </div>
      </ConfirmDialog>
    </section>
  );
}
