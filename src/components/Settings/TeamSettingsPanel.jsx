import React from "react";
import { Plus, RotateCcw, Trash2, UsersRound } from "lucide-react";
import { sortPitches } from "../../lib/pitches.js";
import { numberValue } from "../../lib/settings/dataExchange.js";
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

const FORMATS = ["3v3", "5v5", "7v7", "9v9", "11v11-youth", "11v11-small", "11v11"];
const TEAM_TYPES = [
  ["youth", "Youth"],
  ["adult", "Adult"],
  ["veterans", "Veterans"],
  ["girls", "Girls"],
  ["women", "Women"],
];
const DAYS = ["Saturday", "Sunday", "Midweek"];

const TEAM_COLUMNS = [
  { key: "name", label: "Name", aliases: ["Team", "Team name"] },
  { key: "teamType", label: "Team Type", aliases: ["Type", "Category"] },
  { key: "format", label: "Format" },
  { key: "siteId", label: "Home Site", aliases: ["Site", "Site ID"] },
  { key: "defaultPitch", label: "Default Pitch", aliases: ["Pitch"] },
  { key: "altPitch", label: "Alternative Pitch", aliases: ["Alt Pitch"] },
  { key: "day", label: "Default Day", aliases: ["Day"] },
  { key: "gameMins", label: "Match Minutes", aliases: ["Minutes", "Mins"] },
  { key: "ageOrder", label: "Age Order" },
];

function getSites(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites : [];
  if (sites.length) {
    return sites.map((site, index) => ({
      id: site.id || `site-${index + 1}`,
      name: site.name || site.venue || `Site ${index + 1}`,
      isPrimary: !!site.isPrimary || site.id === club.primarySiteId || (!club.primarySiteId && index === 0),
    }));
  }
  return [{ id: club.primarySiteId || "main-ground", name: club.venue || "Main Ground", isPrimary: true }];
}

function classifyFallback(team = {}) {
  if (team.teamType) return team.teamType;
  const name = String(team.name || "").toLowerCase();
  if (/(1st|first|reserves|open age|sunday 1st|seniors|senior)/i.test(name)) return "adult";
  if (/vets|veterans/.test(name)) return "veterans";
  if (/women|ladies/.test(name)) return "women";
  if (/girls|lionesses/.test(name)) return "girls";
  return "youth";
}

function normaliseImportedTeam(row, index, primarySiteId) {
  const name = String(row.name || "").trim();
  if (!name) return null;
  const teamType = String(row.teamType || "youth").trim().toLowerCase().replace(/\s+/g, "_");
  const format = FORMATS.includes(row.format) ? row.format : "11v11-youth";
  const day = DAYS.includes(row.day) ? row.day : "Saturday";
  return {
    name,
    teamType: TEAM_TYPES.some(([value]) => value === teamType) ? teamType : "youth",
    format,
    siteId: String(row.siteId || primarySiteId || "").trim() || null,
    defaultPitch: String(row.defaultPitch || "").trim() || null,
    altPitch: String(row.altPitch || "").trim() || null,
    day,
    gameMins: Math.max(20, numberValue(row.gameMins, 70)),
    ageOrder: numberValue(row.ageOrder, index + 1),
  };
}

export default function TeamSettingsPanel({
  club = {},
  teamCfg = [],
  setTeamCfg,
  pitchCfg = [],
  TEAM_CONFIG_DEFAULT = [],
  saveTab,
  savedTab,
}) {
  const sites = getSites(club);
  const primarySite = sites.find((site) => site.isPrimary) || sites[0];
  const sortedPitches = sortPitches(pitchCfg);
  const counts = teamCfg.reduce((acc, team) => {
    const type = classifyFallback(team);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const updateTeam = (index, field, value) => {
    setTeamCfg((current) => current.map((team, rowIndex) => rowIndex === index ? { ...team, [field]: value || null } : team));
  };

  const addTeam = () => setTeamCfg((current) => [...current, {
    name: "New Team",
    teamType: "youth",
    format: "11v11-youth",
    siteId: primarySite?.id || null,
    defaultPitch: sortedPitches[0]?.id || null,
    altPitch: null,
    ageOrder: current.length + 1,
    day: "Saturday",
    gameMins: 70,
  }]);

  return (
    <div className="space-y-5">
      <SettingsPanel>
        <SettingsSectionHeader
          icon={UsersRound}
          eyebrow="Matchday setup"
          title="Teams"
          description="Team records feed format suitability, match duration, operating-day defaults and scheduling intelligence."
          action={<PrimaryButton icon={Plus} onClick={addTeam}>Add team</PrimaryButton>}
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Teams" value={teamCfg.length} tone="green" />
          <StatTile label="Youth" value={counts.youth || 0} tone="blue" />
          <StatTile label="Adult" value={counts.adult || 0} tone="violet" />
          <StatTile label="Girls / women" value={(counts.girls || 0) + (counts.women || 0)} tone="rose" />
          <StatTile label="Veterans" value={counts.veterans || 0} tone="slate" />
        </div>

        <div className="mt-5">
          <SettingsDataActions
            label="Teams"
            rows={teamCfg}
            columns={TEAM_COLUMNS}
            filename="ground-control-teams"
            templateRows={[{ name: "U14 Example", teamType: "youth", format: "11v11-youth", siteId: primarySite?.id || "main-ground", defaultPitch: "P1", altPitch: "P2", day: "Saturday", gameMins: 70, ageOrder: 7 }]}
            normaliseRow={(row, index) => normaliseImportedTeam(row, index, primarySite?.id)}
            onImport={(rows, mode) => setTeamCfg((current) => mode === "append" ? [...current, ...rows] : rows)}
          />
        </div>

        <Notice tone="info">
          Adult/open-age teams use adult rules. Midweek is available as a default day but only appears operationally when the Midweek workspace is enabled.
        </Notice>

        <div className="mt-5 overflow-x-auto rounded-[22px] border border-slate-200">
          <table className="min-w-[1120px] w-full border-collapse text-left">
            <thead className="bg-slate-950 text-white">
              <tr>
                {['Team', 'Type', 'Format', 'Home site', 'Default pitch', 'Alternative', 'Day', 'Minutes', ''].map((heading) => (
                  <th key={heading} className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.15em]">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {teamCfg.map((team, index) => {
                const homeSiteId = team.siteId || primarySite?.id || "";
                const sitePitches = sortedPitches.filter((pitch) => (pitch.siteId || primarySite?.id) === homeSiteId);
                const options = sitePitches.length ? sitePitches : sortedPitches;
                return (
                  <tr key={`${team.name}-${index}`} className="hover:bg-slate-50">
                    <td className="p-2"><input className={`${inputClass} min-w-[170px]`} value={team.name || ""} onChange={(event) => updateTeam(index, "name", event.target.value)} /></td>
                    <td className="p-2"><select className={`${selectClass} min-w-[120px]`} value={classifyFallback(team)} onChange={(event) => updateTeam(index, "teamType", event.target.value)}>{TEAM_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
                    <td className="p-2"><select className={`${selectClass} min-w-[135px]`} value={team.format || ""} onChange={(event) => updateTeam(index, "format", event.target.value)}>{FORMATS.map((format) => <option key={format}>{format}</option>)}</select></td>
                    <td className="p-2"><select className={`${selectClass} min-w-[150px]`} value={homeSiteId} onChange={(event) => updateTeam(index, "siteId", event.target.value)}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}{site.isPrimary ? " ★" : ""}</option>)}</select></td>
                    <td className="p-2"><select className={`${selectClass} min-w-[135px]`} value={team.defaultPitch || ""} onChange={(event) => updateTeam(index, "defaultPitch", event.target.value)}><option value="">Unassigned</option>{options.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label}</option>)}</select></td>
                    <td className="p-2"><select className={`${selectClass} min-w-[135px]`} value={team.altPitch || ""} onChange={(event) => updateTeam(index, "altPitch", event.target.value)}><option value="">None</option>{options.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label}</option>)}</select></td>
                    <td className="p-2"><select className={`${selectClass} min-w-[115px]`} value={team.day || "Saturday"} onChange={(event) => updateTeam(index, "day", event.target.value)}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select></td>
                    <td className="p-2"><input type="number" min={20} max={120} step={5} className={`${inputClass} w-24`} value={team.gameMins ?? 70} onChange={(event) => updateTeam(index, "gameMins", Number(event.target.value))} /></td>
                    <td className="p-2"><button type="button" onClick={() => setTeamCfg((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="flex h-10 w-10 items-center justify-center rounded-xl text-rose-600 transition hover:bg-rose-50" aria-label={`Remove ${team.name}`}><Trash2 size={17} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!teamCfg.length ? <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">No teams configured. Add a team or import a CSV template.</div> : null}

        <SaveBar onSave={() => saveTab?.("teams", { teamCfg })} saved={savedTab === "teams"} label="Save teams">
          <SecondaryButton icon={RotateCcw} onClick={() => setTeamCfg(TEAM_CONFIG_DEFAULT)}>Restore demo defaults</SecondaryButton>
        </SaveBar>
      </SettingsPanel>
    </div>
  );
}
