import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Info, Layers3, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { sortPitches } from "../../lib/pitches.js";
import { booleanValue } from "../../lib/settings/dataExchange.js";
import { getClubSites, getPrimarySite, reconcileSiteAssignments, resolveSiteId } from "../../lib/siteAssignments.js";
import { getEntitlementLimit, isUnlimitedLimit, LIMIT_KEYS } from "../../lib/subscriptions/entitlements.js";
import SettingsDataActions from "./SettingsDataActions.jsx";
import {
  Field,
  Notice,
  PrimaryButton,
  SaveBar,
  SecondaryButton,
  SettingsPanel,
  SettingsSectionHeader,
  inputClass,
  selectClass,
} from "./SettingsPrimitives.jsx";

const FORMATS = [
  ["", "Any"],
  ["3v3", "3v3"],
  ["5v5", "5v5"],
  ["7v7", "7v7"],
  ["9v9", "9v9"],
  ["11v11-youth", "11v11 Youth"],
  ["11v11-small", "11v11 Small"],
  ["11v11", "11v11 Full"],
];
const SURFACES = [["grass", "Grass"], ["astro", "Astro"], ["3g", "3G"], ["4g", "4G"], ["indoor", "Indoor"]];

const PITCH_COLUMNS = [
  { key: "id", label: "ID", aliases: ["Pitch ID"] },
  { key: "label", label: "Name", aliases: ["Pitch", "Pitch Name"] },
  { key: "siteId", label: "Site", aliases: ["Site ID"] },
  { key: "format", label: "Format" },
  { key: "surface", label: "Surface" },
  { key: "innerOf", label: "Inside Pitch", aliases: ["Inner Of", "Parent Pitch"] },
  { key: "independent", label: "Independent" },
  { key: "desc", label: "Description", aliases: ["Notes"] },
];

function inferSurface(pitch) {
  if (pitch?.surface) return pitch.surface;
  const text = `${pitch?.id || ""} ${pitch?.label || ""} ${pitch?.desc || ""}`.toLowerCase();
  if (text.includes("astro")) return "astro";
  if (text.includes("3g")) return "3g";
  if (text.includes("4g")) return "4g";
  if (text.includes("indoor")) return "indoor";
  return "grass";
}

function surfaceLabel(pitch) {
  const surface = inferSurface(pitch);
  return SURFACES.find(([value]) => value === surface)?.[1] || "Grass";
}

function normaliseImportedPitch(row, index, primarySiteId) {
  const id = String(row.id || `P${index + 1}`).trim().replace(/\s+/g, "");
  if (!id) return null;
  const surface = String(row.surface || "grass").trim().toLowerCase();
  return {
    id,
    label: String(row.label || id).trim(),
    siteId: String(row.siteId || primarySiteId || "").trim() || null,
    format: String(row.format || "").trim(),
    surface: SURFACES.some(([value]) => value === surface) ? surface : "grass",
    innerOf: String(row.innerOf || "").trim() || null,
    independent: booleanValue(row.independent, false),
    desc: String(row.desc || "").trim(),
  };
}

function CompactMetric({ label, value, detail, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    violet: "border-violet-200 bg-violet-50 text-violet-950",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone] || tones.slate}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-55">{label}</div>
      <div className="mt-1 text-xl font-black tracking-tight">{value}</div>
      {detail ? <div className="mt-0.5 text-[11px] font-bold opacity-60">{detail}</div> : null}
    </div>
  );
}

export default function PitchSettingsPanel({
  club = {},
  pitchCfg = [],
  setPitchCfg,
  PITCHES = [],
  saveTab,
  savedTab,
  subscription,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [limitMessage, setLimitMessage] = useState("");
  const sites = useMemo(() => getClubSites(club), [club]);
  const primarySite = getPrimarySite(sites);
  const assignments = useMemo(() => reconcileSiteAssignments({ club, pitches: pitchCfg }), [club, pitchCfg]);
  const pitchLimit = getEntitlementLimit(subscription, LIMIT_KEYS.PITCHES);
  const canAddPitch = isUnlimitedLimit(pitchLimit) || pitchCfg.length < pitchLimit;
  const overPitchLimit = !isUnlimitedLimit(pitchLimit) && pitchCfg.length > pitchLimit;
  const excessPitches = overPitchLimit ? pitchCfg.length - pitchLimit : 0;
  const surfaces = pitchCfg.reduce((acc, pitch) => {
    const surface = inferSurface(pitch);
    acc[surface] = (acc[surface] || 0) + 1;
    return acc;
  }, {});

  useEffect(() => {
    if (!pitchCfg.length) {
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex((current) => Math.min(Math.max(current, 0), pitchCfg.length - 1));
  }, [pitchCfg.length]);

  const orderedPitches = useMemo(() => sortPitches(pitchCfg).map((pitch) => ({
    pitch,
    index: Math.max(0, pitchCfg.findIndex((candidate) => candidate === pitch || candidate.id === pitch.id)),
  })), [pitchCfg]);

  const siteForPitch = (pitch) => {
    const siteId = resolveSiteId(pitch?.siteId || pitch?.venueId || pitch?.groundId, sites, primarySite?.id);
    return sites.find((site) => site.id === siteId) || primarySite;
  };

  const filteredPitches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orderedPitches.filter(({ pitch }) => {
      if (!needle) return true;
      const siteName = siteForPitch(pitch)?.name || "";
      return [pitch.id, pitch.label, pitch.format, surfaceLabel(pitch), siteName, pitch.desc]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [orderedPitches, query, sites, primarySite?.id]);

  const updatePitch = (realIndex, field, value) => {
    setPitchCfg((current) => current.map((pitch, index) => {
      if (index !== realIndex) return pitch;
      const next = { ...pitch, [field]: value === "" ? null : value };
      delete next.astroOnly;
      delete next.toggleOnly;
      return next;
    }));
  };

  const savePitches = () => {
    const nextPitches = reconcileSiteAssignments({ club, pitches: pitchCfg }).pitches;
    if (nextPitches.some((pitch, index) => pitch.siteId !== pitchCfg[index]?.siteId)) setPitchCfg(nextPitches);
    return saveTab?.("pitches", { pitchCfg: nextPitches });
  };

  const addPitch = () => {
    if (!canAddPitch) {
      setLimitMessage(`${subscription?.planName || "The current plan"} allows ${pitchLimit} pitches.`);
      return;
    }
    setLimitMessage("");
    const nextIndex = pitchCfg.length;
    setPitchCfg((current) => [...current, {
      id: `P${current.length + 1}`,
      label: `Pitch ${current.length + 1}`,
      desc: "",
      format: "",
      siteId: primarySite?.id || null,
      surface: "grass",
      innerOf: null,
      independent: false,
    }]);
    setQuery("");
    setSelectedIndex(nextIndex);
  };

  const removePitch = (index) => {
    setLimitMessage("");
    setPitchCfg((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setSelectedIndex((current) => {
      if (current > index) return current - 1;
      if (current === index) return Math.max(0, Math.min(index, pitchCfg.length - 2));
      return current;
    });
  };

  const importPitches = (rows, mode) => {
    const next = mode === "append" ? [...pitchCfg, ...rows] : rows;
    if (!isUnlimitedLimit(pitchLimit) && next.length > pitchLimit) {
      setLimitMessage(`Import blocked: ${next.length} pitches exceeds the ${pitchLimit}-pitch ${subscription?.planName || "plan"} limit.`);
      return;
    }
    setLimitMessage("");
    setPitchCfg(reconcileSiteAssignments({ club, pitches: next }).pitches);
    setSelectedIndex(0);
    setQuery("");
  };

  const restoreDefaults = () => {
    if (!isUnlimitedLimit(pitchLimit) && PITCHES.length > pitchLimit) {
      setLimitMessage(`Demonstration defaults contain ${PITCHES.length} pitches and cannot be restored on this plan.`);
      return;
    }
    setLimitMessage("");
    setPitchCfg(reconcileSiteAssignments({
      club,
      pitches: PITCHES.map((pitch) => ({ ...pitch, surface: pitch.surface || inferSurface(pitch) })),
    }).pitches);
    setSelectedIndex(0);
    setQuery("");
  };

  const selectedPitch = pitchCfg[selectedIndex] || null;
  const selectedSiteId = resolveSiteId(selectedPitch?.siteId, sites, primarySite?.id);
  const selectedSiteName = sites.find((site) => site.id === selectedSiteId)?.name || primarySite?.name || "Main site";

  return (
    <SettingsPanel className="p-5 sm:p-6">
      <SettingsSectionHeader
        icon={Layers3}
        eyebrow="Single source of truth"
        title="Pitch registry"
        description="Select a pitch, edit the record and save. Temporary closures remain in Operations."
        action={<PrimaryButton icon={Plus} onClick={addPitch} disabled={!canAddPitch}>Add pitch</PrimaryButton>}
      />

      <SaveBar
        sticky
        onSave={savePitches}
        saved={savedTab === "pitches"}
        label="Save pitches"
        disabled={overPitchLimit}
        disabledReason={overPitchLimit ? `Remove ${excessPitches} pitch${excessPitches === 1 ? "" : "es"} or upgrade before saving.` : ""}
      >
        <span className="font-black text-slate-700">Editing {selectedPitch?.label || selectedPitch?.id || "pitch settings"}</span>
        <SecondaryButton icon={RotateCcw} onClick={restoreDefaults}>Restore defaults</SecondaryButton>
      </SaveBar>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <CompactMetric label="Pitches" value={pitchCfg.length} detail={isUnlimitedLimit(pitchLimit) ? "Unlimited" : `${pitchLimit} limit`} tone="green" />
        <CompactMetric label="Grass" value={surfaces.grass || 0} />
        <CompactMetric label="Artificial" value={(surfaces.astro || 0) + (surfaces["3g"] || 0) + (surfaces["4g"] || 0)} tone="blue" />
        <CompactMetric label="Independent" value={pitchCfg.filter((pitch) => pitch.independent).length} tone="violet" />
        <CompactMetric label="Sites" value={new Set(assignments.pitches.map((pitch) => pitch.siteId || primarySite?.id)).size} tone="amber" />
      </div>

      {assignments.repairedPitches > 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {assignments.repairedPitches} historic pitch assignment{assignments.repairedPitches === 1 ? "" : "s"} will be linked to {primarySite?.name || "the primary site"} when saved.
        </div>
      ) : null}

      {limitMessage ? <Notice tone="warning" className="mt-4">{limitMessage}</Notice> : null}
      {!canAddPitch ? (
        <Notice tone="warning" className="mt-4">
          {subscription?.planName || "The current plan"} allows {pitchLimit} pitches. {overPitchLimit ? `Remove ${excessPitches} pitch${excessPitches === 1 ? "" : "es"} in this session and then save, or upgrade the workspace.` : "Remove a pitch or review Plan & subscription before adding another."}
        </Notice>
      ) : null}

      <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-slate-800 marker:hidden">Import, export or download a pitch template</summary>
        <div className="border-t border-slate-200 p-4">
          <SettingsDataActions
            label="Pitches"
            rows={assignments.pitches}
            columns={PITCH_COLUMNS}
            filename="ground-control-pitches"
            templateRows={[{ id: "P1", label: "Pitch 1", siteId: primarySite?.id || "main-ground", format: "11v11", surface: "grass", innerOf: "", independent: false, desc: "Full-size grass pitch" }]}
            normaliseRow={(row, index) => normaliseImportedPitch(row, index, primarySite?.id)}
            onImport={importPitches}
          />
        </div>
      </details>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold leading-5 text-blue-950">
        <Info size={16} className="mt-0.5 shrink-0" />
        “Inside pitch” marks a smaller layout inside a larger pitch. Independent pitches do not count towards the concurrent-game limit.
      </div>

      <div className="@container mt-4">
      <div className="grid min-w-0 gap-4 @4xl:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-[22px] border border-slate-200 bg-slate-50/80 p-3 @4xl:sticky @4xl:top-44 @4xl:max-h-[calc(100vh-12rem)] @4xl:self-start @4xl:overflow-hidden">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find pitch" aria-label="Find a pitch, site or format" />
          </div>
          <div className="mt-2.5 flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
            <span>{filteredPitches.length} shown</span><span>{pitchCfg.length} total</span>
          </div>
          <div className="mt-2 grid max-h-[320px] grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-1.5 overflow-y-auto pr-1 @4xl:block @4xl:max-h-[calc(100vh-18rem)] @4xl:space-y-1">
            {filteredPitches.map(({ pitch, index }) => {
              const active = index === selectedIndex;
              const siteName = siteForPitch(pitch)?.name || primarySite?.name || "Main site";
              return (
                <button key={`pitch-list-${index}-${pitch.id || "new"}`} type="button" onClick={() => setSelectedIndex(index)} className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-slate-950 bg-slate-950 text-white shadow-sm" : "border-transparent bg-white text-slate-800 hover:border-slate-200"}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${active ? "bg-white/10 text-emerald-300" : "bg-blue-50 text-blue-700"}`}>{pitch.id || index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">{pitch.label || pitch.id || "Unnamed pitch"}</span>
                    <span className={`mt-0.5 block truncate text-[10px] font-bold ${active ? "text-slate-300" : "text-slate-400"}`}>{siteName} · {pitch.format || "Any"} · {surfaceLabel(pitch)}</span>
                  </span>
                  <ChevronRight size={15} className={active ? "text-slate-300" : "text-slate-400"} />
                </button>
              );
            })}
            {!filteredPitches.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">No pitches match that search.</div> : null}
          </div>
        </aside>

        <div className="min-w-0">
          {selectedPitch ? (
            <article className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Pitch {selectedIndex + 1} of {pitchCfg.length}</div>
                  <div className="mt-1 text-lg font-black text-slate-950">{selectedPitch.label || selectedPitch.id || "Unnamed pitch"}</div>
                  <div className="mt-0.5 text-xs font-bold text-slate-400">{selectedSiteName}</div>
                </div>
                <button type="button" onClick={() => removePitch(selectedIndex)} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 transition hover:bg-rose-50"><Trash2 size={15} /> Remove</button>
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-x-4 gap-y-4">
                <Field label="Pitch ID"><input className={`${inputClass} font-mono`} value={selectedPitch.id || ""} onChange={(event) => updatePitch(selectedIndex, "id", event.target.value.replace(/\s+/g, ""))} /></Field>
                <Field label="Name" className="col-span-full"><input className={inputClass} value={selectedPitch.label || ""} onChange={(event) => updatePitch(selectedIndex, "label", event.target.value)} /></Field>
                <Field label="Site"><select className={selectClass} value={selectedSiteId || ""} onChange={(event) => updatePitch(selectedIndex, "siteId", event.target.value)}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}{site.isPrimary ? " ★" : ""}</option>)}</select></Field>
                <Field label="Format"><select className={selectClass} value={selectedPitch.format || ""} onChange={(event) => updatePitch(selectedIndex, "format", event.target.value)}>{FORMATS.map(([value, label]) => <option key={value || "any"} value={value}>{label}</option>)}</select></Field>
                <Field label="Surface"><select className={selectClass} value={selectedPitch.surface || inferSurface(selectedPitch)} onChange={(event) => updatePitch(selectedIndex, "surface", event.target.value)}>{SURFACES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                <Field label="Inside pitch" hint="Optional parent layout."><select className={selectClass} value={selectedPitch.innerOf || ""} onChange={(event) => updatePitch(selectedIndex, "innerOf", event.target.value || null)}><option value="">None</option>{pitchCfg.filter((candidate) => candidate.id !== selectedPitch.id && !candidate.innerOf).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label || candidate.id}</option>)}</select></Field>
                <Field label="Capacity handling"><label className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-black text-slate-700"><input type="checkbox" checked={!!selectedPitch.independent} onChange={(event) => updatePitch(selectedIndex, "independent", event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600" /> Independent pitch</label></Field>
                <Field label="Description" className="col-span-full"><input className={inputClass} value={selectedPitch.desc || ""} onChange={(event) => updatePitch(selectedIndex, "desc", event.target.value)} placeholder="Optional notes" /></Field>
              </div>
            </article>
          ) : <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/70 p-10 text-center text-sm font-semibold text-slate-500">No pitches configured. Add one or import the CSV template.</div>}
        </div>
      </div>
      </div>
    </SettingsPanel>
  );
}
