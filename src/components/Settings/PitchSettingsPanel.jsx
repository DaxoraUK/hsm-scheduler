import React from "react";
import { Layers3, Plus, RotateCcw, Trash2 } from "lucide-react";
import { sortPitches } from "../../lib/pitches.js";
import { booleanValue } from "../../lib/settings/dataExchange.js";
import SettingsDataActions from "./SettingsDataActions.jsx";
import {
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
}) {
  const sites = getSites(club);
  const primarySite = sites.find((site) => site.isPrimary) || sites[0];
  const surfaces = pitchCfg.reduce((acc, pitch) => {
    const surface = inferSurface(pitch);
    acc[surface] = (acc[surface] || 0) + 1;
    return acc;
  }, {});

  const updatePitch = (realIndex, field, value) => {
    setPitchCfg((current) => current.map((pitch, index) => {
      if (index !== realIndex) return pitch;
      const next = { ...pitch, [field]: value };
      delete next.astroOnly;
      delete next.toggleOnly;
      return next;
    }));
  };

  const addPitch = () => setPitchCfg((current) => [...current, {
    id: `P${current.length + 1}`,
    label: `Pitch ${current.length + 1}`,
    desc: "",
    format: "",
    siteId: primarySite?.id || null,
    surface: "grass",
    innerOf: null,
    independent: false,
  }]);

  return (
    <SettingsPanel>
      <SettingsSectionHeader
        icon={Layers3}
        eyebrow="Single source of truth"
        title="Pitch registry"
        description="Formats, surfaces, site allocation and shared-pitch relationships are used by scheduling, validation and analytics. Temporary closures are managed in Operations, not Settings."
        action={<PrimaryButton icon={Plus} onClick={addPitch}>Add pitch</PrimaryButton>}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Pitches" value={pitchCfg.length} tone="green" />
        <StatTile label="Grass" value={surfaces.grass || 0} tone="slate" />
        <StatTile label="Artificial" value={(surfaces.astro || 0) + (surfaces["3g"] || 0) + (surfaces["4g"] || 0)} tone="blue" />
        <StatTile label="Independent" value={pitchCfg.filter((pitch) => pitch.independent).length} tone="violet" />
        <StatTile label="Sites" value={new Set(pitchCfg.map((pitch) => pitch.siteId || primarySite?.id)).size} tone="amber" />
      </div>

      <div className="mt-5">
        <SettingsDataActions
          label="Pitches"
          rows={pitchCfg}
          columns={PITCH_COLUMNS}
          filename="ground-control-pitches"
          templateRows={[{ id: "P1", label: "Pitch 1", siteId: primarySite?.id || "main-ground", format: "11v11", surface: "grass", innerOf: "", independent: false, desc: "Full-size grass pitch" }]}
          normaliseRow={(row, index) => normaliseImportedPitch(row, index, primarySite?.id)}
          onImport={(rows, mode) => setPitchCfg((current) => mode === "append" ? [...current, ...rows] : rows)}
        />
      </div>

      <Notice tone="info">
        “Inside pitch” models a smaller layout marked within a larger pitch. Independent pitches do not count towards the concurrent-game limit.
      </Notice>

      <div className="mt-5 overflow-x-auto rounded-[22px] border border-slate-200">
        <table className="min-w-[1080px] w-full border-collapse text-left">
          <thead className="bg-slate-950 text-white">
            <tr>
              {['ID', 'Name', 'Site', 'Format', 'Surface', 'Inside', 'Independent', ''].map((heading) => <th key={heading} className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.15em]">{heading}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sortPitches(pitchCfg).map((pitch, displayIndex) => {
              const realIndex = Math.max(0, pitchCfg.findIndex((candidate) => candidate === pitch || candidate.id === pitch.id));
              return (
                <tr key={`${pitch.id}-${displayIndex}`} className="hover:bg-slate-50">
                  <td className="p-2"><input className={`${inputClass} w-24 font-mono`} value={pitch.id || ""} onChange={(event) => updatePitch(realIndex, "id", event.target.value.replace(/\s+/g, ""))} /></td>
                  <td className="p-2"><input className={`${inputClass} min-w-[150px]`} value={pitch.label || ""} onChange={(event) => updatePitch(realIndex, "label", event.target.value)} /></td>
                  <td className="p-2"><select className={`${selectClass} min-w-[150px]`} value={pitch.siteId || primarySite?.id || ""} onChange={(event) => updatePitch(realIndex, "siteId", event.target.value)}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}{site.isPrimary ? " ★" : ""}</option>)}</select></td>
                  <td className="p-2"><select className={`${selectClass} min-w-[135px]`} value={pitch.format || ""} onChange={(event) => updatePitch(realIndex, "format", event.target.value)}>{FORMATS.map(([value, label]) => <option key={value || "any"} value={value}>{label}</option>)}</select></td>
                  <td className="p-2"><select className={`${selectClass} min-w-[115px]`} value={pitch.surface || inferSurface(pitch)} onChange={(event) => updatePitch(realIndex, "surface", event.target.value)}>{SURFACES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
                  <td className="p-2"><select className={`${selectClass} min-w-[110px]`} value={pitch.innerOf || ""} onChange={(event) => updatePitch(realIndex, "innerOf", event.target.value || null)}><option value="">None</option>{pitchCfg.filter((candidate) => candidate.id !== pitch.id && !candidate.innerOf).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.id}</option>)}</select></td>
                  <td className="p-2 text-center"><input type="checkbox" checked={!!pitch.independent} onChange={(event) => updatePitch(realIndex, "independent", event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600" /></td>
                  <td className="p-2"><button type="button" onClick={() => setPitchCfg((current) => current.filter((_, index) => index !== realIndex))} className="flex h-10 w-10 items-center justify-center rounded-xl text-rose-600 transition hover:bg-rose-50" aria-label={`Remove ${pitch.label}`}><Trash2 size={17} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!pitchCfg.length ? <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">No pitches configured. Add one or import the CSV template.</div> : null}

      <SaveBar onSave={() => saveTab?.("pitches")} saved={savedTab === "pitches"} label="Save pitches">
        <SecondaryButton icon={RotateCcw} onClick={() => setPitchCfg(PITCHES.map((pitch) => ({ ...pitch, siteId: pitch.siteId || primarySite?.id || null, surface: pitch.surface || inferSurface(pitch) })))}>Restore demo defaults</SecondaryButton>
      </SaveBar>
    </SettingsPanel>
  );
}
