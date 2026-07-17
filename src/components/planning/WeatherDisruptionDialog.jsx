import { useMemo, useState } from "react";
import { CloudRain, X } from "lucide-react";
import { FULL_PITCH_AREA_ID, FULL_PITCH_AREA_LABEL, pitchAreaOptions } from "../../lib/planning/annualPlannerEngine.js";

function text(value) {
  return String(value ?? "").trim();
}

function iso(date, time) {
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? "" : value.toISOString();
}

export default function WeatherDisruptionDialog({ booking, pitches = [], winterSites = [], winterSlots = [], saving, onClose, onSubmit }) {
  const [action, setAction] = useState("postpone");
  const [reason, setReason] = useState("Pitch unplayable due to weather");
  const [publicMessage, setPublicMessage] = useState("");
  const [date, setDate] = useState(booking?.startDate || "");
  const [startTime, setStartTime] = useState(booking?.startTime || "");
  const [endTime, setEndTime] = useState(booking?.endTime || "");
  const [pitchId, setPitchId] = useState(booking?.pitchId || "");
  const [pitchAreaId, setPitchAreaId] = useState(booking?.pitchAreaId || "");
  const [siteSlotId, setSiteSlotId] = useState(booking?.siteSlotId || "");
  const [error, setError] = useState("");

  const selectedPitch = useMemo(() => pitches.find((pitch) => String(pitch.id) === String(pitchId)) || null, [pitchId, pitches]);
  const pitchAreas = useMemo(() => pitchAreaOptions(selectedPitch || {}, { includeFullPitch: true }), [selectedPitch]);
  const selectedWinterSlot = useMemo(() => winterSlots.find((slot) => String(slot.id) === String(siteSlotId)) || null, [siteSlotId, winterSlots]);
  const selectedWinterSite = useMemo(() => winterSites.find((site) => String(site.id) === String(selectedWinterSlot?.site_id || selectedWinterSlot?.siteId)) || null, [selectedWinterSlot, winterSites]);

  if (!booking) return null;

  const choosePitch = (nextId) => {
    setPitchId(nextId);
    setSiteSlotId("");
    const pitch = pitches.find((row) => String(row.id) === String(nextId));
    const options = pitchAreaOptions(pitch || {}, { includeFullPitch: true });
    if (!options.some((area) => String(area.id) === String(pitchAreaId))) {
      setPitchAreaId(options.length ? FULL_PITCH_AREA_ID : "");
    }
  };

  const chooseWinterSlot = (nextId) => {
    setSiteSlotId(nextId);
    setPitchId("");
    const slot = winterSlots.find((row) => String(row.id) === String(nextId));
    setStartTime(String(slot?.start_time || slot?.startTime || startTime).slice(0, 5));
    setEndTime(String(slot?.end_time || slot?.endTime || endTime).slice(0, 5));
    setPitchAreaId(FULL_PITCH_AREA_ID);
  };

  const submit = () => {
    setError("");
    if (!text(reason)) {
      setError("Record the weather reason before continuing.");
      return;
    }
    const data = {
      reason: text(reason),
      public_message: text(publicMessage) || null,
    };
    if (action === "rearrange") {
      const startAt = iso(date, startTime);
      const endAt = iso(date, endTime);
      if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) {
        setError("Choose a valid replacement date and finish time.");
        return;
      }
      if (!pitchId && !siteSlotId) {
        setError("Choose a replacement club pitch or winter slot.");
        return;
      }
      const area = pitchAreas.find((row) => String(row.id) === String(pitchAreaId));
      Object.assign(data, {
        start_at: startAt,
        end_at: endAt,
        pitch_id: pitchId || (siteSlotId ? `winter-slot:${siteSlotId}` : null),
        pitch_name: selectedPitch?.label || selectedPitch?.name || selectedWinterSlot?.label || booking.pitchName || null,
        pitch_area_id: pitchId ? (area?.id || null) : FULL_PITCH_AREA_ID,
        pitch_area_name: pitchId ? (area?.label || null) : (selectedWinterSlot?.area_name || selectedWinterSlot?.areaName || FULL_PITCH_AREA_LABEL),
        venue_id: selectedPitch?.siteId || selectedPitch?.venueId || (selectedWinterSite ? `winter-site:${selectedWinterSite.id}` : null),
        venue_name: selectedPitch?.siteLabel || selectedPitch?.siteName || selectedWinterSite?.name || booking.venueName || null,
        season_phase: siteSlotId ? "winter" : (booking.seasonPhase || "regular"),
        site_inventory_id: selectedWinterSite?.id || null,
        site_slot_id: selectedWinterSlot?.id || null,
        cost_pence: Number(selectedWinterSlot?.cost_pence ?? selectedWinterSlot?.costPence ?? booking.costPence ?? 0) || 0,
      });
    }
    onSubmit(action, data);
  };

  return <div className="fixed inset-0 z-[270] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur sm:items-center" role="dialog" aria-modal="true" aria-label="Weather disruption">
    <section className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
      <div className="flex items-start gap-3 border-b border-slate-200 p-5 sm:p-6"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><CloudRain size={21} /></span><div className="min-w-0 flex-1"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">Weather disruption</div><h2 className="mt-1 text-xl font-black text-slate-950">{booking.title}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{booking.startDate} · {booking.startTime}–{booking.endTime} · {[booking.pitchName, booking.pitchAreaName].filter(Boolean).join(" · ")}</p></div><button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200"><X size={18} /></button></div>
      <div className="space-y-4 p-5 sm:p-6">
        <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Action</span><select className="input" value={action} onChange={(event) => setAction(event.target.value)}><option value="postpone">Postpone - awaiting rearrangement</option><option value="rearrange">Rearrange now</option><option value="cancel">Cancel due to weather</option></select></label>
        <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Weather reason</span><input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Waterlogged pitch, frozen surface, unsafe wind..." /></label>
        <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Message to coach</span><textarea className="input min-h-24 py-3" value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} placeholder="Explain what has changed and what happens next." /></label>
        {action === "rearrange" ? <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-sky-800">Replacement booking</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Date</span><input type="date" className="input" value={date} onChange={(event) => setDate(event.target.value)} /></label><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Club pitch</span><select className="input" value={pitchId} onChange={(event) => choosePitch(event.target.value)}><option value="">Choose club pitch</option>{pitches.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label || pitch.name || pitch.id}</option>)}</select></label><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Start</span><input type="time" className="input" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Finish</span><input type="time" className="input" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>{pitchId && pitchAreas.length ? <label className="sm:col-span-2"><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Pitch allocation</span><select className="input" value={pitchAreaId} onChange={(event) => setPitchAreaId(event.target.value)}>{pitchAreas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label> : null}{winterSlots.length ? <label className="sm:col-span-2"><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Or use a winter fixed slot</span><select className="input" value={siteSlotId} onChange={(event) => chooseWinterSlot(event.target.value)}><option value="">Choose winter slot</option>{winterSlots.filter((slot) => slot.active !== false).map((slot) => { const site = winterSites.find((row) => String(row.id) === String(slot.site_id || slot.siteId)); return <option key={slot.id} value={slot.id}>{site?.name || "Winter site"} · {slot.label || slot.area_name || "Slot"} · {String(slot.start_time || slot.startTime).slice(0, 5)}–{String(slot.end_time || slot.endTime).slice(0, 5)}</option>; })}</select></label> : null}</div></div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900">{error}</div> : null}
      </div>
      <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 p-5 backdrop-blur sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={saving} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black">Cancel</button><button type="button" onClick={submit} disabled={saving} className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving..." : action === "rearrange" ? "Save rearrangement" : action === "cancel" ? "Cancel session" : "Postpone session"}</button></div>
    </section>
  </div>;
}
