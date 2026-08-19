import React, { useState } from "react";
import { Plus, PlugZap, Search, Trash2 } from "lucide-react";
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
import { BBDFL_FIXTURE_FEEDS, LANCASHIRE_AMATEUR_FIXTURE_FEEDS } from "../../lib/fullTimeFeed.js";

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
    feedId: fullTime.feedId || "",
    clubId: fullTime.clubId || "",
    teamAliases: fullTime.teamAliases || "",
    enabled: true,
  }];
}

export default function IntegrationSettingsPanel({ club = {}, setClub, saveTab, savedTab }) {
  const [sourceFilter, setSourceFilter] = useState("");
  const [sourceStatus, setSourceStatus] = useState("all");
  const integrations = club.integrations || {};
  const fullTime = integrations.fullTimeFa || {};
  const sources = configuredSources(fullTime);
  const normalisedFilter = sourceFilter.trim().toLowerCase();
  const visibleSources = sources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => {
      if (sourceStatus === "enabled" && source.enabled === false) return false;
      if (sourceStatus === "disabled" && source.enabled !== false) return false;
      if (!normalisedFilter) return true;
      return [source.name, source.feedId, source.clubId, source.url, source.sourceUrl,
        Array.isArray(source.teamAliases) ? source.teamAliases.join(" ") : source.teamAliases]
        .some((value) => String(value || "").toLowerCase().includes(normalisedFilter));
    });

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
      feedId: first.feedId || "",
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
    feedId: "",
    clubId: "",
    teamAliases: "",
    enabled: true,
  }]);

  const addLancashireFeeds = () => {
    const existingIds = new Set(sources.map((source) => String(source.feedId || "")));
    const additions = LANCASHIRE_AMATEUR_FIXTURE_FEEDS
      .filter((feed) => !existingIds.has(feed.id))
      .map((feed) => ({
        id: `full-time-feed-${feed.id}`,
        name: feed.name,
        feedId: feed.id,
        url: "",
        clubId: "",
        teamAliases: "Horwich St. Mary's, Horwich St Mary's, HSM",
        enabled: true,
      }));
    updateSources([...sources, ...additions]);
  };

  const addPresetFeeds = (feeds) => {
    const existingIds = new Set(sources.map((source) => String(source.feedId || "")));
    const additions = feeds.filter((feed) => !existingIds.has(feed.id)).map((feed) => ({
      id: `full-time-feed-${feed.id}`,
      name: feed.name,
      feedId: feed.id,
      url: "",
      clubId: "",
      teamAliases: "Horwich St. Mary's, Horwich St Mary's",
      enabled: true,
    }));
    updateSources([...sources, ...additions]);
  };

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

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_190px_auto] md:items-center">
          <label className="relative block">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputClass} pl-11`} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} placeholder="Find a source by name, feed ID or alias..." aria-label="Filter fixture sources" />
          </label>
          <select className={selectClass} value={sourceStatus} onChange={(event) => setSourceStatus(event.target.value)} aria-label="Filter fixture sources by status">
            <option value="all">All sources</option>
            <option value="enabled">Enabled only</option>
            <option value="disabled">Disabled only</option>
          </select>
          <div className="text-sm font-bold text-slate-500 md:text-right">Showing {visibleSources.length} of {sources.length}</div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {visibleSources.map(({ source, index }) => (
          <details key={source.id || index} className="group rounded-[24px] border border-slate-200 bg-slate-50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Source {index + 1}</div>
                <div className="mt-1 font-black text-slate-900">{source.name || "Unnamed Full-Time source"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-500">Feed {source.feedId || "not set"}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-black ${source.enabled !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>{source.enabled !== false ? "Enabled" : "Disabled"}</span>
                <span className="text-sm font-black text-slate-500 group-open:hidden">Expand</span>
                <span className="hidden text-sm font-black text-slate-500 group-open:inline">Collapse</span>
              </div>
            </summary>
            <div className="border-t border-slate-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mt-1 text-sm font-semibold text-slate-500">Prefer the official numeric code-snippet feed ID. Page URLs remain available as a legacy fallback.</div>
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
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Official feed ID" hint="The numeric cs value from Full-Time's Media → Code Snippets feed.">
                <input className={inputClass} inputMode="numeric" value={source.feedId || ""} onChange={(event) => updateSource(index, { feedId: event.target.value.replace(/\D/g, "") })} placeholder="583264498" />
              </Field>
              <Field label="Legacy fixture page URL" hint="Cloudflare may block server-side page imports; official feed IDs are preferred.">
                <input className={inputClass} value={source.url || source.sourceUrl || ""} onChange={(event) => updateSource(index, { url: event.target.value, sourceUrl: event.target.value })} placeholder="https://fulltime.thefa.com/displayTeam.html?..." />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px] md:items-end">
              <Field label="Club team aliases" hint="Comma-separated names used to identify the club's home fixtures.">
                <input className={inputClass} value={Array.isArray(source.teamAliases) ? source.teamAliases.join(", ") : source.teamAliases || ""} onChange={(event) => updateSource(index, { teamAliases: event.target.value })} placeholder="Horwich, St Mary's, HSM" />
              </Field>
              <Toggle checked={source.enabled !== false} onChange={(enabled) => updateSource(index, { enabled })} label="Source enabled" description="Include this page in live imports." />
            </div>
            </div>
          </details>
        ))}

        {sources.length > 0 && visibleSources.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
            No fixture sources match this filter.
          </div>
        )}

        <button type="button" onClick={addSource} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 px-4 text-sm font-black text-emerald-800 hover:bg-emerald-100">
          <Plus size={17} /> Add Full-Time source
        </button>
        <button type="button" onClick={addLancashireFeeds} className="ml-2 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 text-sm font-black text-sky-800 hover:bg-sky-100">
          <Plus size={17} /> Add Lancashire Amateur feeds
        </button>
        <button type="button" onClick={() => addPresetFeeds(BBDFL_FIXTURE_FEEDS)} className="ml-2 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 text-sm font-black text-violet-800 hover:bg-violet-100">
          <Plus size={17} /> Add BBDFL feed
        </button>
      </div>

      <Notice tone="warning" className="mt-5">
        Enable a source only after comparing one live import with the club's own fixture list. A failed source never silently clears an existing schedule.
      </Notice>

      <SaveBar onSave={() => saveTab?.("integrations", { club })} saved={savedTab === "integrations"} label="Save fixture sources">
        Official feeds load in your browser using The FA's published website integration. Daxora does not publish changes back to Full-Time.
      </SaveBar>
    </SettingsPanel>
  );
}
