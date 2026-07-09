import React from "react";
import { Layers3, Plus, RotateCcw, Trash2 } from "lucide-react";
import { sortPitches } from "../../lib/pitches.js";
import { booleanValue } from "../../lib/settings/dataExchange.js";
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
  StatTile,
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

function getSites(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites : [];
  if (sites.length) return sites.map((site, index) => ({ id: site.id || `site-${index + 1}`, name: site.name || site.venue || `Site ${index + 1}`, isPrimary: !!site.isPrimary || site.id === club.primarySiteId || (!club.primarySiteId && index === 0) }));
  return [{ id: club.primarySiteId || "main-ground", name: club.venue || "Main Ground", isPrimary: true }];
}

function inferSurface(pitch) {
  if (pitch?.surface) return pitch.surface;
  const text = `${pitch?.id || ""} ${pitch?.label || ""} ${pitch?.desc || ""}`.toLowerCase();
  if (text.includes("astro")) return "astro";
  if (text.includes("3g")) return "3g";
  if (text.includes("4g")) return "4g";
  if (text.includes("indoor")) return "indoor";
  return "grass";
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

export default function PitchSettingsPanel({
  club = {},
  pitchCfg = [],
  setPitchCfg,
  PITCHES = [],
  saveTab,
  savedTab,
  subscription,
}) {
  const sites = getSites(club);
  const primarySite = sites.find((site) => site.isPrimary) || sites[0];
  const pitchLimit = getEntitlementLimit(subscription, LIMIT_KEYS.PITCHES);
  const canAddPitch = isUnlimitedLimit(pitchLimit) || pitchCfg.length < pitchLimit;
  const surfaces = pitchCfg.reduce((acc, pitch) => {
    const surface = inferSurface(pitch);
    acc[surface] = (acc[surface] || 0) + 1;
    return acc;
  }, {});

  const updatePitch = (realIndex, field, value) => {
    setPitchCfg((current) => current.map((pitch, index) => {
      if (index !== realIndex) return pitch;
      const next = { ...pitch, [field]: value === "" ? null : value };
      delete next.astroOnly;
      delete next.toggleOnly;
      return next;
    }));
  };

  const addPitch = () => {
    if (!canAddPitch) return;
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
  };

  const importPitches = (rows, mode) => setPitchCfg((current) => {
    const next = mode === "append" ? [...current, ...rows] : rows;
    return isUnlimitedLimit(pitchLimit) ? next : next.slice(0, pitchLimit);
  });

  return (
    <SettingsPanel>
      <SettingsSectionHeader
        icon={Layers3}
        eyebrow="Single source of truth"
        title="Pitch registry"
        description="Formats, surfaces, site allocation and shared-pitch relationships are used by scheduling, validation and analytics. Temporary closures are managed in Operations, not Settings."
        action={<PrimaryButton icon={Plus} onClick={addPitch} disabled={!canAddPitch}>Add pitch</PrimaryButton>}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Pitches" value={pitchCfg.length} detail={isUnlimitedLimit(pitchLimit) ? "Unlimited plan limit" : `${pitchLimit} plan limit`} tone="green" />
        <StatTile label="Grass" value={surfaces.grass || 0} tone="slate" />
        <StatTile label="Artificial" value={(surfaces.astro || 0) + (surfaces["3g"] || 0) + (surfaces["4g"] || 0)} tone="blue" />
        <StatTile label="Independent" value={pitchCfg.filter((pitch) => pitch.independent).length} tone="violet" />
        <StatTile label="Sites" value={new Set(pitchCfg.map((pitch) => pitch.siteId || primarySite?.id)).size} tone="amber" />
      </div>

      {!canAddPitch ? (
        <Notice tone="warning" className="mt-5">
          {subscription?.planName || "The current plan"} allows {pitchLimit} pitches. Remove a pitch or review Plan & subscription before adding another.
        </Notice>
      ) : null}

      <div className="mt-5">
        <SettingsDataActions
          label="Pitches"
          rows={pitchCfg}
          columns={PITCH_COLUMNS}
          filename="ground-control-pitches"
          templateRows={[{ id: "P1", label: "Pitch 1", siteId: primarySite?.id || "main-ground", format: "11v11", surface: "grass", innerOf: "", independent: false, desc: "Full-size grass pitch" }]}
          normaliseRow={(row, index) => normaliseImportedPitch(row, index, primarySite?.id)}
          onImport={importPitches}
        />
      </div>

      <div className="mt-5">
        <Notice tone="info">
          “Inside pitch” models a smaller layout marked within a larger pitch. Independent pitches do not count towards the concurrent-game limit.
        </Notice>
      </div>

      <div className="mt-6 space-y-4">
        {sortPitches(pitchCfg).map((pitch, displayIndex) => {
          const realIndex = Math.max(0, pitchCfg.findIndex((candidate) => candidate === pitch || candidate.id === pitch.id));
          return (
            <article key={`pitch-${realIndex}`} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pitch {displayIndex + 1}</div>
                  <div className="mt-1 text-sm font-black text-slate-950">{pitch.label || pitch.id || "Unnamed pitch"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPitchCfg((current) => current.filter((_, index) => index !== realIndex))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                  aria-label={`Remove ${pitch.label || pitch.id || "pitch"}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>

              <div className="grid gap-x-4 gap-y-5 lg:grid-cols-2 xl:grid-cols-3">
                <Field label="Pitch ID" >
                  <input className={`${inputClass} font-mono`} value={pitch.id || ""} onChange={(event) => updatePitch(realIndex, "id", event.target.value.replace(/\s+/g, ""))} />
                </Field>
                <Field label="Name" className="lg:col-span-2 xl:col-span-2">
                  <input className={inputClass} value={pitch.label || ""} onChange={(event) => updatePitch(realIndex, "label", event.target.value)} />
                </Field>
                <Field label="Site" >
                  <select className={selectClass} value={pitch.siteId || primarySite?.id || ""} onChange={(event) => updatePitch(realIndex, "siteId", event.target.value)}>
                    {sites.map((site) => <option key={site.id} value={site.id}>{site.name}{site.isPrimary ? " ★" : ""}</option>)}
                  </select>
                </Field>
                <Field label="Format" >
                  <select className={selectClass} value={pitch.format || ""} onChange={(event) => updatePitch(realIndex, "format", event.target.value)}>
                    {FORMATS.map(([value, label]) => <option key={value || "any"} value={value}>{label}</option>)}
                  </select>
                </Field>

                <Field label="Surface" >
                  <select className={selectClass} value={pitch.surface || inferSurface(pitch)} onChange={(event) => updatePitch(realIndex, "surface", event.target.value)}>
                    {SURFACES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Inside pitch" hint="Optional parent layout." >
                  <select className={selectClass} value={pitch.innerOf || ""} onChange={(event) => updatePitch(realIndex, "innerOf", event.target.value || null)}>
                    <option value="">None</option>
                    {pitchCfg.filter((candidate) => candidate.id !== pitch.id && !candidate.innerOf).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label || candidate.id}</option>)}
                  </select>
                </Field>
                <Field label="Capacity handling" >
                  <label className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-black text-slate-700">
                    <input type="checkbox" checked={!!pitch.independent} onChange={(event) => updatePitch(realIndex, "independent", event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600" />
                    Independent pitch
                  </label>
                </Field>
                <Field label="Description" >
                  <input className={inputClass} value={pitch.desc || ""} onChange={(event) => updatePitch(realIndex, "desc", event.target.value)} placeholder="Optional notes" />
                </Field>
              </div>
            </article>
          );
        })}
      </div>

      {!pitchCfg.length ? <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">No pitches configured. Add one or import the CSV template.</div> : null}

      <SaveBar onSave={() => saveTab?.("pitches")} saved={savedTab === "pitches"} label="Save pitches">
        <SecondaryButton icon={RotateCcw} onClick={() => setPitchCfg(PITCHES.map((pitch) => ({ ...pitch, siteId: pitch.siteId || primarySite?.id || null, surface: pitch.surface || inferSurface(pitch) })))}>Restore demo defaults</SecondaryButton>
      </SaveBar>
    </SettingsPanel>
  );
}
