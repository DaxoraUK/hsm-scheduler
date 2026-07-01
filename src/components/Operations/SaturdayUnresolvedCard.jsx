import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { FORMAT_COMPAT } from "../../lib/constants.js";
import { cleanName, findCfg } from "../../lib/scheduler.js";
import { sortPitches } from "../../lib/pitches.js";
import {
  getKickOffRuleFailure,
  getSuggestionWindowForFixture,
  isKickOffAllowedForFixture,
} from "../../lib/intelligence/scheduling/kickOffRules.js";

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

function getDuration(cfg = {}) {
  const format = cfg.format || "";
  const gameMins = cfg.gameMins || 70;
  const bufferMins = String(format).includes("11") ? 30 : 15;

  return gameMins + bufferMins;
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

function getCompatiblePitchIds(cfg = {}) {
  const format = cfg.format || "";

  return FORMAT_COMPAT[format] || [];
}

function getSuitablePitches({ cfg = {}, pitchCfg = [], closedPitches = [] } = {}) {
  const compatibleIds = getCompatiblePitchIds(cfg);
  const preferredIds = [cfg.defaultPitch, cfg.altPitch].filter(Boolean);

  return sortPitches(pitchCfg)
    .filter((pitch) => {
      if (!pitch?.id) return false;
      if (closedPitches.includes(pitch.id)) return false;
      if (preferredIds.includes(pitch.id)) return true;
      if (compatibleIds.length === 0) return true;

      return compatibleIds.includes(pitch.id);
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
  satScheduled = [],
  pitchCfg = [],
  pitchId,
  koMins,
  endMins,
} = {}) {
  const blockedPitchIds = getBlockedPitchIds(pitchId, pitchCfg);

  return (
    satScheduled.find((game) => {
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
  satScheduled = [],
  koMins,
  endMins,
} = {}) {
  return satScheduled.filter((game) => {
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
  satScheduled = [],
  limit = 3,
} = {}) {
  const cfg = findCfg(fixture.homeTeam, teamCfg);
  const duration = getDuration(cfg);
  const suitablePitches = getSuitablePitches({ cfg, pitchCfg, closedPitches });
  const maxConcurrent = Number(club.maxConcurrent || 3);
  const fixtureWithCfg = { ...fixture, cfg };
  const window = getSuggestionWindowForFixture({ fixture: fixtureWithCfg, club });
  const startMins = timeToMinutes(window.start) ?? 8 * 60 + 30;
  const endMins = timeToMinutes(window.end) ?? 11 * 60 + 30;
  const suggestions = [];

  suitablePitches.forEach((pitch) => {
    for (let koMins = startMins; koMins <= endMins; koMins += 15) {
      const koTime = minutesToTime(koMins);

      if (!isKickOffAllowedForFixture({ fixture: fixtureWithCfg, koTime, club })) continue;

      const fixtureEndMins = koMins + duration;

      const pitchClash = findPitchClash({
        satScheduled,
        pitchCfg,
        pitchId: pitch.id,
        koMins,
        endMins: fixtureEndMins,
      });

      if (pitchClash) continue;

      const concurrentCount = getConcurrentCount({
        satScheduled,
        koMins,
        endMins: fixtureEndMins,
      });

      if (concurrentCount >= maxConcurrent) continue;

      const isDefault = pitch.id === cfg?.defaultPitch;
      const isAlt = pitch.id === cfg?.altPitch;

      const score =
        (isDefault ? 100 : 0) +
        (isAlt ? 80 : 0) -
        Math.abs(koMins - startMins) / 15 -
        concurrentCount * 4;

      suggestions.push({
        pitchId: pitch.id,
        pitchLabel: pitch.label || pitch.id,
        pitchDesc: pitch.desc || "",
        koTime,
        koMins,
        endMins: fixtureEndMins,
        cfg,
        score,
        confidence: Math.max(72, Math.min(98, Math.round(92 + score / 20))),
        reasons: [
          "Correct fixture format",
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

export default function SaturdayUnresolvedCard({
  club,
  teamCfg,
  pitchCfg,
  closedPitches = [],
  satUnresolved,
  satOverrides,
  satOv,
  satScheduled,
  setSatScheduled,
  setSatUnresolved,
}) {
  if (satUnresolved.length === 0) return null;

  const resolveFixture = ({ fixture, index, patch, cfg, overridden = false }) => {
    const koMins =
      patch.koMins != null ? patch.koMins : timeToMinutes(patch.koTime);
    const duration = getDuration(cfg);
    const endMins =
      patch.endMins != null ? patch.endMins : koMins != null ? koMins + duration : null;

    const resolved = {
      ...fixture,
      ...patch,
      koMins,
      endMins,
      cfg,
      manual: true,
      overridden,
    };

    setSatScheduled((previous) =>
      [...previous, resolved].sort((a, b) => (a.koMins || 0) - (b.koMins || 0))
    );

    setSatUnresolved((previous) => previous.filter((_, fixtureIndex) => fixtureIndex !== index));
  };

  const confirmManualAssignment = ({ fixture, index }) => {
    const ov = satOverrides[9000 + index] || {};

    if (!ov.pitchId) return alert("Please select a pitch first.");
    if (!ov.koTime) return alert("Please set a KO time.");

    if (closedPitches.includes(ov.pitchId)) {
      const selectedPitch = pitchCfg.find((pitch) => pitch.id === ov.pitchId);
      return alert(`${selectedPitch?.label || ov.pitchId} is closed. Please choose another pitch.`);
    }

    const koMins = timeToMinutes(ov.koTime);
    const cfg = findCfg(fixture.homeTeam, teamCfg);

    const koRuleFailure = getKickOffRuleFailure({
      fixture: { ...fixture, cfg },
      koTime: ov.koTime,
      club,
    });

    if (koRuleFailure) {
      return alert(`${koRuleFailure.title}: ${koRuleFailure.detail}`);
    }

    const duration = getDuration(cfg);
    const endMins = koMins + duration;

    const clash = findPitchClash({
      satScheduled,
      pitchCfg,
      pitchId: ov.pitchId,
      koMins,
      endMins,
    });

    if (clash) {
      const proceed = window.confirm(
        `Conflict: ${cleanName(clash.homeTeam, club.name)} is already using this or a linked pitch at ${clash.koTime}.\n\nAssign anyway as an override?`
      );

      if (!proceed) return;
    }

    const selectedPitch = pitchCfg.find((pitch) => pitch.id === ov.pitchId);

    resolveFixture({
      fixture,
      index,
      cfg,
      overridden: !!clash,
      patch: {
        ...ov,
        pitchLabel: selectedPitch?.label || ov.pitchId,
        koMins,
        endMins,
      },
    });
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
              Fixture Requires Intervention ({satUnresolved.length})
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {satUnresolved.map((fixture, index) => {
          const cfg = findCfg(fixture.homeTeam, teamCfg);
          const suggestions = buildResolutionSuggestions({
            fixture,
            club,
            teamCfg,
            pitchCfg,
            closedPitches,
            satScheduled,
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
                        onClick={() =>
                          resolveFixture({
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
                        className="rounded-3xl border border-emerald-200 bg-white p-4 text-left transition hover:bg-emerald-50"
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
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      onChange={(event) => satOv(9000 + index, "pitchId", event.target.value)}
                    >
                      <option value="">Select pitch...</option>
                      {getSuitablePitches({ cfg, pitchCfg, closedPitches }).map((pitch) => (
                        <option key={pitch.id} value={pitch.id}>
                          {pitch.label} - {pitch.desc}
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
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      onChange={(event) => satOv(9000 + index, "koTime", event.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => confirmManualAssignment({ fixture, index })}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
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
    </section>
  );
}
