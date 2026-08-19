import { useMemo, useState } from "react";
import { CalendarPlus, Clock3, MapPin, Pencil, Plus, Snowflake, Trash2, X } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function text(value) {
  return String(value ?? "").trim();
}

function money(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((Number(pence) || 0) / 100);
}

function blankSite() {
  const year = new Date().getFullYear();
  return {
    id: "",
    name: "",
    address: "",
    seasonType: "winter",
    providerType: "external",
    availableFrom: `${year}-10-01`,
    availableTo: `${year + 1}-03-31`,
    surface: "3G",
    floodlights: true,
    costPence: 0,
    accessNotes: "",
    restrictions: "",
    cancellationTerms: "",
    active: true,
  };
}

function blankSlot(siteId = "") {
  return {
    id: "",
    siteId,
    label: "",
    dayOfWeek: 1,
    startTime: "18:00",
    endTime: "19:00",
    capacity: 1,
    areaName: "",
    costPence: 0,
    active: true,
  };
}

function normaliseSite(row = {}) {
  return {
    id: text(row.id),
    name: text(row.name || row.site_name || row.siteName),
    address: text(row.address),
    seasonType: text(row.season_type || row.seasonType || "winter"),
    providerType: text(row.provider_type || row.providerType || "external"),
    availableFrom: text(row.available_from || row.availableFrom).slice(0, 10),
    availableTo: text(row.available_to || row.availableTo).slice(0, 10),
    surface: text(row.surface || "3G"),
    floodlights: Boolean(row.floodlights),
    costPence: Number(row.cost_pence ?? row.costPence ?? 0) || 0,
    accessNotes: text(row.access_notes || row.accessNotes),
    restrictions: text(row.restrictions),
    cancellationTerms: text(row.cancellation_terms || row.cancellationTerms),
    active: row.active !== false,
  };
}

function normaliseSlot(row = {}) {
  return {
    id: text(row.id),
    siteId: text(row.site_id || row.siteId),
    label: text(row.label || row.slot_label || row.slotLabel),
    dayOfWeek: Number(row.day_of_week ?? row.dayOfWeek ?? 1),
    startTime: text(row.start_time || row.startTime).slice(0, 5),
    endTime: text(row.end_time || row.endTime).slice(0, 5),
    capacity: Math.max(1, Number(row.capacity || 1)),
    areaName: text(row.area_name || row.areaName),
    costPence: Number(row.cost_pence ?? row.costPence ?? 0) || 0,
    active: row.active !== false,
  };
}

function Field({ label, children, wide = false }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>{children}</label>;
}

export default function WinterSiteWorkspace({ sites = [], slots = [], canManage, saving, onSaveSite, onDeleteSite, onSaveSlot, onDeleteSlot, onBookSlot }) {
  const siteRows = useMemo(() => sites.map(normaliseSite), [sites]);
  const slotRows = useMemo(() => slots.map(normaliseSlot), [slots]);
  const [siteDraft, setSiteDraft] = useState(null);
  const [slotDraft, setSlotDraft] = useState(null);

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-sky-800 via-slate-950 to-violet-950 text-white shadow-xl">
      <div className="flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-sky-200"><Snowflake size={16} /> Seasonal inventory</div><h2 className="mt-2 text-3xl font-black">Winter sites and fixed training slots</h2><p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Keep external 3G, indoor and winter facilities separate from the normal grass-pitch inventory. Each site has its own dates, costs, access notes and bookable slots.</p></div>{canManage ? <button type="button" onClick={() => setSiteDraft(blankSite())} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-300 px-4 text-sm font-black text-slate-950"><Plus size={17} /> Add winter site</button> : null}</div>
    </section>

    {siteRows.length ? <div className="grid gap-5 xl:grid-cols-2">{siteRows.map((site) => {
      const siteSlots = slotRows.filter((slot) => slot.siteId === site.id).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
      return <section key={site.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><MapPin size={21} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black text-slate-950">{site.name}</h3><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-violet-700">{site.providerType}</span>{!site.active ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-500">Inactive</span> : null}</div><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{site.address || "Address not recorded"}</p><div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black text-slate-600"><span className="rounded-full bg-slate-100 px-2.5 py-1">{site.availableFrom || "Start TBC"} to {site.availableTo || "End TBC"}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{site.surface || "Surface TBC"}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{site.floodlights ? "Floodlit" : "No floodlights"}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{money(site.costPence)} base cost</span></div></div>{canManage ? <div className="flex shrink-0 gap-2"><button type="button" onClick={() => setSiteDraft(site)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600"><Pencil size={15} /></button><button type="button" onClick={() => onDeleteSite?.(site)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700"><Trash2 size={15} /></button></div> : null}</div>
        {site.accessNotes || site.restrictions ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{site.accessNotes ? <div className="rounded-xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600"><span className="font-black text-slate-800">Access:</span> {site.accessNotes}</div> : null}{site.restrictions ? <div className="rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900"><span className="font-black">Restrictions:</span> {site.restrictions}</div> : null}</div> : null}
        <div className="mt-5 flex items-center justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Fixed weekly slots</div><div className="mt-1 text-sm font-black text-slate-900">{siteSlots.length} configured</div></div>{canManage ? <button type="button" onClick={() => setSlotDraft(blankSlot(site.id))} className="inline-flex h-9 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-800"><Plus size={14} /> Add slot</button> : null}</div>
        <div className="mt-3 space-y-2">{siteSlots.length ? siteSlots.map((slot) => <div key={slot.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><Clock3 size={16} /></span><div className="min-w-0 flex-1"><div className="text-sm font-black text-slate-950">{slot.label || slot.areaName || "Training slot"}</div><div className="mt-1 text-xs font-bold text-slate-500">{DAYS[slot.dayOfWeek]} · {slot.startTime}–{slot.endTime} · capacity {slot.capacity}{slot.areaName ? ` · ${slot.areaName}` : ""} · {money(slot.costPence)}</div></div><div className="flex gap-2"><button type="button" onClick={() => onBookSlot?.(site, slot)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-[11px] font-black text-white"><CalendarPlus size={14} /> Book</button>{canManage ? <><button type="button" onClick={() => setSlotDraft(slot)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"><Pencil size={14} /></button><button type="button" onClick={() => onDeleteSlot?.(slot)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700"><Trash2 size={14} /></button></> : null}</div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-xs font-semibold text-slate-500">Add the provider's fixed weekly slots before allocating teams.</div>}</div>
      </section>;
    })}</div> : <section className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Snowflake className="mx-auto text-slate-400" size={28} /><h3 className="mt-3 text-lg font-black text-slate-800">No winter sites configured</h3><p className="mt-1 text-sm font-semibold text-slate-500">Add external 3G, indoor halls or seasonal training venues and their fixed slots.</p></section>}

    {siteDraft ? <div className="fixed inset-0 z-[250] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur sm:items-center"><section className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">Winter inventory</div><h2 className="mt-1 text-xl font-black">{siteDraft.id ? "Edit winter site" : "Add winter site"}</h2></div><button type="button" onClick={() => setSiteDraft(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><X size={18} /></button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Site name" wide><input className="input" value={siteDraft.name} onChange={(event) => setSiteDraft((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Address" wide><input className="input" value={siteDraft.address} onChange={(event) => setSiteDraft((current) => ({ ...current, address: event.target.value }))} /></Field><Field label="Available from"><input type="date" className="input" value={siteDraft.availableFrom} onChange={(event) => setSiteDraft((current) => ({ ...current, availableFrom: event.target.value }))} /></Field><Field label="Available to"><input type="date" className="input" value={siteDraft.availableTo} onChange={(event) => setSiteDraft((current) => ({ ...current, availableTo: event.target.value }))} /></Field><Field label="Provider"><select className="input" value={siteDraft.providerType} onChange={(event) => setSiteDraft((current) => ({ ...current, providerType: event.target.value }))}><option value="external">External provider</option><option value="club">Club operated</option><option value="partner">Partner facility</option></select></Field><Field label="Surface"><input className="input" value={siteDraft.surface} onChange={(event) => setSiteDraft((current) => ({ ...current, surface: event.target.value }))} /></Field><Field label="Base cost (£)"><input type="number" min="0" step="0.01" className="input" value={(siteDraft.costPence / 100).toFixed(2)} onChange={(event) => setSiteDraft((current) => ({ ...current, costPence: Math.round(Number(event.target.value || 0) * 100) }))} /></Field><Field label="Floodlights"><select className="input" value={siteDraft.floodlights ? "yes" : "no"} onChange={(event) => setSiteDraft((current) => ({ ...current, floodlights: event.target.value === "yes" }))}><option value="yes">Available</option><option value="no">Not available</option></select></Field><Field label="Access and keyholder notes" wide><textarea className="input min-h-20 py-3" value={siteDraft.accessNotes} onChange={(event) => setSiteDraft((current) => ({ ...current, accessNotes: event.target.value }))} /></Field><Field label="Restrictions" wide><textarea className="input min-h-20 py-3" value={siteDraft.restrictions} onChange={(event) => setSiteDraft((current) => ({ ...current, restrictions: event.target.value }))} /></Field><Field label="Cancellation terms" wide><textarea className="input min-h-20 py-3" value={siteDraft.cancellationTerms} onChange={(event) => setSiteDraft((current) => ({ ...current, cancellationTerms: event.target.value }))} /></Field></div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white/95 p-5 backdrop-blur"><button type="button" onClick={() => setSiteDraft(null)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black">Cancel</button><button disabled={saving || !siteDraft.name.trim()} type="button" onClick={async () => { await onSaveSite?.(siteDraft); setSiteDraft(null); }} className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save site"}</button></div></section></div> : null}

    {slotDraft ? <div className="fixed inset-0 z-[255] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur sm:items-center"><section className="w-full max-w-xl rounded-[28px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-700">Fixed winter slot</div><h2 className="mt-1 text-xl font-black">{slotDraft.id ? "Edit slot" : "Add slot"}</h2></div><button type="button" onClick={() => setSlotDraft(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><X size={18} /></button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Slot label" wide><input className="input" value={slotDraft.label} onChange={(event) => setSlotDraft((current) => ({ ...current, label: event.target.value }))} placeholder="3G Half 1" /></Field><Field label="Day"><select className="input" value={slotDraft.dayOfWeek} onChange={(event) => setSlotDraft((current) => ({ ...current, dayOfWeek: Number(event.target.value) }))}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></Field><Field label="Capacity"><input type="number" min="1" max="20" className="input" value={slotDraft.capacity} onChange={(event) => setSlotDraft((current) => ({ ...current, capacity: Math.max(1, Number(event.target.value || 1)) }))} /></Field><Field label="Starts"><input type="time" className="input" value={slotDraft.startTime} onChange={(event) => setSlotDraft((current) => ({ ...current, startTime: event.target.value }))} /></Field><Field label="Finishes"><input type="time" className="input" value={slotDraft.endTime} onChange={(event) => setSlotDraft((current) => ({ ...current, endTime: event.target.value }))} /></Field><Field label="Area / space"><input className="input" value={slotDraft.areaName} onChange={(event) => setSlotDraft((current) => ({ ...current, areaName: event.target.value }))} placeholder="Half 1, Sports Hall" /></Field><Field label="Cost per slot (£)"><input type="number" min="0" step="0.01" className="input" value={(slotDraft.costPence / 100).toFixed(2)} onChange={(event) => setSlotDraft((current) => ({ ...current, costPence: Math.round(Number(event.target.value || 0) * 100) }))} /></Field></div><div className="flex justify-end gap-2 border-t border-slate-200 p-5"><button type="button" onClick={() => setSlotDraft(null)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black">Cancel</button><button disabled={saving || !slotDraft.label.trim() || !slotDraft.startTime || !slotDraft.endTime || slotDraft.endTime <= slotDraft.startTime} type="button" onClick={async () => { await onSaveSlot?.(slotDraft); setSlotDraft(null); }} className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save slot"}</button></div></section></div> : null}
  </div>;
}
