import React, { useRef, useState } from "react";
import { Archive, Database, Download, FileUp, ShieldCheck } from "lucide-react";
import SupabaseStatusBar from "./SupabaseStatusBar.jsx";
import { downloadJson } from "../../lib/settings/dataExchange.js";
import { normalisePitchClosures } from "../../lib/domain/pitchClosures.js";
import {
  Notice,
  PrimaryButton,
  SecondaryButton,
  SettingsPanel,
  SettingsSectionHeader,
  StatTile,
} from "./SettingsPrimitives.jsx";

const SCHEMA_VERSION = 2;

export default function DataSettingsPanel({
  club = {},
  setClub,
  teamCfg = [],
  setTeamCfg,
  pitchCfg = [],
  setPitchCfg,
  pitchClosures = [],
  setPitchClosures,
  refs = [],
  setRefs,
  history = [],
  dbStatus,
  setDbStatus,
  setHistory,
  startHour,
  setStartHour,
  startMin,
  setStartMin,
  endHour,
  setEndHour,
  endMin,
  setEndMin,
  bufferYouth,
  setBufferYouth,
  bufferAdult,
  setBufferAdult,
}) {
  const inputRef = useRef(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const backup = {
    product: "Daxora Ground Control",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    club,
    teams: teamCfg,
    pitches: pitchCfg,
    pitchClosures: normalisePitchClosures(pitchClosures),
    officials: refs,
    scheduling: { startHour, startMin, endHour, endMin, bufferYouth, bufferAdult },
  };

  const exportBackup = () => {
    const safeName = String(club.name || "club").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "club";
    downloadJson(`ground-control-${safeName}-configuration.json`, backup);
    setMessage("Configuration backup downloaded.");
    setError("");
  };

  const importBackup = async (file) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object") throw new Error("That file is not a Ground Control configuration backup.");
      if (!parsed.club || !Array.isArray(parsed.teams) || !Array.isArray(parsed.pitches) || !Array.isArray(parsed.officials)) {
        throw new Error("The backup is missing club, team, pitch or official data.");
      }
      setClub?.(parsed.club);
      setTeamCfg?.(parsed.teams);
      setPitchCfg?.(parsed.pitches);
      if (Array.isArray(parsed.pitchClosures)) {
        setPitchClosures?.(normalisePitchClosures(parsed.pitchClosures));
      }
      setRefs?.(parsed.officials);
      const scheduling = parsed.scheduling || {};
      if (Number.isFinite(Number(scheduling.startHour))) setStartHour?.(Number(scheduling.startHour));
      if (Number.isFinite(Number(scheduling.startMin))) setStartMin?.(Number(scheduling.startMin));
      if (Number.isFinite(Number(scheduling.endHour))) setEndHour?.(Number(scheduling.endHour));
      if (Number.isFinite(Number(scheduling.endMin))) setEndMin?.(Number(scheduling.endMin));
      if (Number.isFinite(Number(scheduling.bufferYouth))) setBufferYouth?.(Number(scheduling.bufferYouth));
      if (Number.isFinite(Number(scheduling.bufferAdult))) setBufferAdult?.(Number(scheduling.bufferAdult));
      setMessage("Configuration imported. Review each section, then save before using it live.");
      setError("");
    } catch (importError) {
      setError(importError?.message || "The backup could not be imported.");
      setMessage("");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <SettingsPanel>
        <SettingsSectionHeader
          icon={Database}
          eyebrow="Storage"
          title="Cloud sync status"
          description="Ordinary club users should never need to enter a Supabase key or run database SQL from this screen. Production credentials belong in the deployment environment."
        />
        <div className="mt-5"><SupabaseStatusBar dbStatus={dbStatus} setDbStatus={setDbStatus} setHistory={setHistory} /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Teams" value={teamCfg.length} tone="green" />
          <StatTile label="Pitches" value={pitchCfg.length} tone="blue" />
          <StatTile label="Officials" value={refs.length} tone="violet" />
          <StatTile label="Saved matchweeks" value={history.length} tone="amber" />
        </div>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSectionHeader
          icon={Archive}
          eyebrow="Portability"
          title="Configuration backup"
          description="Export the permanent club setup before a pilot, major change or support session. Matchweek history remains separate."
        />

        <div className="mt-6 flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-black text-slate-950">Club configuration JSON</div>
            <div className="mt-1 text-sm font-semibold leading-5 text-slate-500">Includes club, venues, modules, teams, pitches, pitch closure records, officials and scheduling controls.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => importBackup(event.target.files?.[0])} />
            <SecondaryButton icon={FileUp} onClick={() => inputRef.current?.click()}>Import backup</SecondaryButton>
            <PrimaryButton icon={Download} onClick={exportBackup}>Download backup</PrimaryButton>
          </div>
        </div>

        {message ? <Notice tone="success" className="mt-4">{message}</Notice> : null}
        {error ? <Notice tone="warning" className="mt-4">{error}</Notice> : null}
        <Notice tone="neutral" className="mt-4">Team, pitch and official pages also provide spreadsheet-friendly CSV import and export for day-to-day administration.</Notice>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSectionHeader
          icon={ShieldCheck}
          eyebrow="Launch requirement"
          title="Production data controls"
          description="Before customer onboarding, cloud tables must use club-level row security, audit logging and tested backups. The settings UX no longer exposes insecure ‘allow all’ SQL policies."
        />
      </SettingsPanel>
    </div>
  );
}
