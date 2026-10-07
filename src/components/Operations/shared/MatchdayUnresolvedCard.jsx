import React, { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "../../../lib/notifications/daxoraNotifications.js";
import { getFixtureFlowIdentity } from "../../../lib/domain/fixtureVenueFlow.js";
import { validateFixtureMove } from "../../../lib/scheduling/fixtureMove.js";
import { cleanName, resolveFixtureTeam } from "../../../lib/scheduler.js";
import { sortPitches } from "../../../lib/pitches.js";
import {
  getPitchDisplayFormat,
  isPitchSuitableForFixture,
} from "../../../lib/intelligence/pitch/pitchService.js";
import {
  getSuggestionWindowForFixture,
} from "../../../lib/intelligence/scheduling/kickOffRules.js";

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

function buildResolutionSuggestions({fixture={},club={},teamCfg=[],pitchCfg=[],closedPitches=[],scheduled=[],matchDate,resourceContext,limit=3}={}) {
  const cfg=fixture.cfg||resolveFixtureTeam(fixture,teamCfg);
  const candidate={...fixture,cfg,koMins:undefined,endMins:undefined};
  const window=getSuggestionWindowForFixture({fixture:candidate,club});
  const suggestions=[];
  const pitches=getSuitablePitches({fixture,cfg,pitchCfg,closedPitches});
  const startMins=timeToMinutes(window.start),endMins=timeToMinutes(window.end);
  for(let koMins=startMins;Number.isFinite(koMins)&&koMins<=endMins;koMins+=15) {
    for(const pitch of pitches) {
      const result=validateFixtureMove({fixtures:[...scheduled,candidate],fixtureIdentity:getFixtureFlowIdentity(fixture),
        patch:{pitchId:pitch.id,koMins},pitchCfg,club,closedPitches,matchDate,resourceContext});
      if(!result.ok) continue;
      suggestions.push({...result.patch,cfg,pitchDesc:pitch.desc||getPitchDisplayFormat(pitch),confidence:98,
        reasons:['Pitch and playing area are available','Full fixture and turnaround fit','Configured scheduling rules are satisfied']});
      if(suggestions.length===limit) return suggestions;
    }
  }
  return suggestions;
}

export default function MatchdayUnresolvedCard({
  club,
  teamCfg,
  pitchCfg,
  closedPitches = [],
  unresolved = [],
  scheduled = [],
  matchDate,
  resourceContext,
  onAllocationChange,
  readOnly = false,
}) {
  const [inputs,setInputs]=useState({});
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  if(unresolved.length===0) return null;
  const resolveFixture=async({fixture,patch})=>{
    if(readOnly||busyRef.current) return;
    busyRef.current=true;setBusy(true);
    try {
      if(typeof onAllocationChange!=='function') throw new Error('Schedule assignment is unavailable. Refresh the workspace.');
      const result=await onAllocationChange({fixtureIdentity:getFixtureFlowIdentity(fixture),patch,resolveUnresolved:true});
      if(!result?.ok) {toast.error('Fixture was not assigned',{description:result?.reason||'Review the current settings and try another slot.'});return;}
      toast.success('Fixture assigned',{description:'The validated allocation has been saved to the local schedule draft.'});
    } catch(error){toast.error('Fixture was not assigned',{description:error.message});}
    finally{busyRef.current=false;setBusy(false);}
  };
  const confirmManualAssignment=({fixture})=>{
    const patch=inputs[getFixtureFlowIdentity(fixture)]||{};
    if(!patch.pitchId||!patch.koTime) {toast.error('Select a pitch and kick-off time',{description:'The unresolved fixture has not been assigned.'});return;}
    return resolveFixture({fixture,patch});
  };
  const setInput=(fixture,field,value)=>setInputs(current=>({...current,[getFixtureFlowIdentity(fixture)]:{...current[getFixtureFlowIdentity(fixture)],[field]:value}}));

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
            matchDate,
            resourceContext,
            limit: 3,
          });

          return (
            <article
              key={getFixtureFlowIdentity(fixture)}
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
                        disabled={readOnly || busy}
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
                  No valid allocation was found. Review availability windows, closures, pitch areas or concurrency limits, or try a different time below.
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
                      disabled={readOnly || busy}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={inputs[getFixtureFlowIdentity(fixture)]?.pitchId || ""}
                      onChange={(event) => setInput(fixture, "pitchId", event.target.value)}
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
                      disabled={readOnly || busy}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={inputs[getFixtureFlowIdentity(fixture)]?.koTime || ""}
                      onChange={(event) => setInput(fixture, "koTime", event.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={readOnly || busy}
                    onClick={() => confirmManualAssignment({ fixture, index })}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <MapPin size={16} />
                    {busy ? "Saving…" : "Confirm Assignment"}
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
