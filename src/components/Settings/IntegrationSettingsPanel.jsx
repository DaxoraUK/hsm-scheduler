import React from "react";
import { Plus, PlugZap, Trash2 } from "lucide-react";
import {
  Field,
  Notice,
  SaveBar,
  SettingsPanel,
  SettingsSectionHeader,
  Toggle,
  inputClass,
  selectClass,
} from "./SettingsPrimitives.jsx";

function sourceId() {
  return `full-time-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function configuredSources(fullTime = {}) {
  if (Array.isArray(fullTime.sources) && fullTime.sources.length) return fullTime.sources;
  if (!fullTime.sourceUrl) return [];
  return [{
    id: fullTime.clubId || "full-time-primary",
    name: "Primary Full-Time source",
    url: fullTime.sourceUrl,
    clubId: fullTime.clubId || "",
    teamAliases: fullTime.teamAliases || "",
    enabled: true,
  }];
}

export default function IntegrationSettingsPanel({ club = {}, setClub, saveTab, savedTab }) {
  const integrations = club.integrations || {};
  const fullTime = integrations.fullTimeFa || {};
  const sources = configuredSources(fullTime);

  const updateFullTime = (patch) => {
    setClub((current) => ({
      ...current,
      integrations: {
        ...(current.integrations || {}),
        fullTimeFa: { ...((current.integrations || {}).fullTimeFa || {}), ...patch },
      },
    }));
  };

  const updateSources = (nextSources) => {
    const first = nextSources.find((source) => source.enabled !== false) || nextSources[0] || {};
    updateFullTime({
      sources: nextSources,
      sourceUrl: first.url || "",
      clubId: first.clubId || "",
      teamAliases: first.teamAliases || "",
    });
  };

  const updateSource = (index, patch) => updateSources(
    sources.map((source, sourceIndex) => sourceIndex === index ? { ...source, ...patch } : source)
  );

  const addSource = () => updateSources([...sources, {
    id: sourceId(),
    name: `Full-Time source ${sources.length + 1}`,
    url: "",
    clubId: "",
    teamAliases: "",
    enabled: true,
  }]);

  return (
    <SettingsPanel>
      <SettingsSectionHeader
        icon={PlugZap}
        eyebrow="Fixture connections"
        title="Full-Time FA sources"
        description="Connect each league or competition page used by the club. Imports report every source separately and remove duplicate fixtures before scheduling."
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div>
          <Field label="Import mode">
            <select className={selectClass} value={fullTime.mode || "import"} onChange={(event) => updateFullTime({ mode: event.target.value })}>
              <option value="import">Import fixtures</option>
              <option value="manual">Manual preparation</option>
            </select>
          </Field>
        </div>
        <Toggle
          checked={!!fullTime.enabled}
          onChange={(enabled) => updateFullTime({ enabled })}
          label="Enable Full-Time FA"
          description="Makes enabled, valid sources available to fixture import workflows."
        />
      </div>

      <div className="mt-6 space-y-4">
        {sources.map((source, index) => (
          <section key={source.id || index} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Source {index + 1}</div>
                <div className="mt-1 text-sm font-semibold text-slate-500">Use the final HTTPS team or fixture page URL shown by Full-Time.</div>
              </div>
              <button type="button" onClick={() => updateSources(sources.filter((_, sourceIndex) => sourceIndex !== index))} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-700 hover:bg-rose-50" aria-label={`Remove ${source.name || `source ${index + 1}`}`}>
                <Trash2 size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Source name">
                <input className={inputClass} value={source.name || ""} onChange={(event) => updateSource(index, { name: event.target.value })} placeholder="Bolton & Bury League" />
              </Field>
              <Field label="Full-Time club/team ID">
                <input className={inputClass} value={source.clubId || ""} onChange={(event) => updateSource(index, { clubId: event.target.value })} placeholder="Optional reference" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Fixture page URL" hint="Only secure fulltime.thefa.com pages are accepted by the import service.">
                <input className={inputClass} value={source.url || source.sourceUrl || ""} onChange={(event) => updateSource(index, { url: event.target.value, sourceUrl: event.target.value })} placeholder="https://fulltime.thefa.com/displayTeam.html?..." />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px] md:items-end">
              <Field label="Club team aliases" hint="Comma-separated names used to identify the club's home fixtures.">
                <input className={inputClass} value={Array.isArray(source.teamAliases) ? source.teamAliases.join(", ") : source.teamAliases || ""} onChange={(event) => updateSource(index, { teamAliases: event.target.value })} placeholder="Horwich, St Mary's, HSM" />
              </Field>
              <Toggle checked={source.enabled !== false} onChange={(enabled) => updateSource(index, { enabled })} label="Source enabled" description="Include this page in live imports." />
            </div>
          </section>
        ))}

        <button type="button" onClick={addSource} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 px-4 text-sm font-black text-emerald-800 hover:bg-emerald-100">
          <Plus size={17} /> Add Full-Time source
        </button>
      </div>

      <Notice tone="warning" className="mt-5">
        Enable a source only after comparing one live import with the club's own fixture list. A failed source never silently clears an existing schedule.
      </Notice>

      <SaveBar onSave={() => saveTab?.("integrations", { club })} saved={savedTab === "integrations"} label="Save fixture sources">
        Full-Time remains an import source. Daxora does not publish changes back to Full-Time in this release.
      </SaveBar>
    </SettingsPanel>
  );
}
