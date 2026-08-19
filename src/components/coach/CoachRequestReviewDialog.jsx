import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { PrimaryButton, SecondaryButton, inputClass, selectClass } from "../Settings/SettingsPrimitives.jsx";
import { FULL_PITCH_AREA_ID, FULL_PITCH_AREA_LABEL, pitchAreaOptions } from "../../lib/planning/annualPlannerEngine.js";

function text(value) { return String(value ?? "").trim(); }
function iso(date, time) { const value = new Date(`${date}T${time}:00`); return Number.isNaN(value.getTime()) ? "" : value.toISOString(); }

export default function CoachRequestReviewDialog({ request, pitches = [], winterSites = [], winterSlots = [], busy, onClose, onDecision }) {
  const [decision, setDecision] = useState("approve");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(request.preferredDate || "");
  const [startTime, setStartTime] = useState(request.preferredStartTime || "");
  const [endTime, setEndTime] = useState(request.preferredEndTime || "");
  const [pitchId, setPitchId] = useState(request.preferredPitchId || "");
  const [pitchAreaId, setPitchAreaId] = useState(request.preferredPitchAreaId || (request.requestType === "friendly" ? FULL_PITCH_AREA_ID : ""));
  const [siteSlotId, setSiteSlotId] = useState(request.preferredSiteSlotId || "");

  const selectedPitch = useMemo(() => pitches.find((pitch) => String(pitch.id) === String(pitchId)) || null, [pitchId, pitches]);
  const areas = useMemo(() => pitchAreaOptions(selectedPitch || {}, { includeFullPitch: true }), [selectedPitch]);
  const selectedSlot = useMemo(() => winterSlots.find((slot) => String(slot.id) === String(siteSlotId)) || null, [siteSlotId, winterSlots]);
  const selectedSite = useMemo(() => winterSites.find((site) => String(site.id) === String(selectedSlot?.site_id || selectedSlot?.siteId)) || null, [selectedSlot, winterSites]);
  const isCancellation = request.requestType === "cancellation";
  const showAllocation = !isCancellation && ["approve", "alternative"].includes(decision);

  const choosePitch = (nextPitchId) => {
    setPitchId(nextPitchId); setSiteSlotId("");
    const nextPitch = pitches.find((pitch) => String(pitch.id) === String(nextPitchId));
    const nextAreas = pitchAreaOptions(nextPitch || {}, { includeFullPitch: true });
    if (!nextAreas.some((area) => String(area.id) === String(pitchAreaId))) setPitchAreaId(request.requestType === "friendly" && nextAreas.length ? FULL_PITCH_AREA_ID : "");
  };

  const chooseWinterSlot = (nextId) => {
    setSiteSlotId(nextId); setPitchId("");
    const slot = winterSlots.find((row) => String(row.id) === String(nextId));
    if (slot) { setStartTime(String(slot.start_time || slot.startTime).slice(0, 5)); setEndTime(String(slot.end_time || slot.endTime).slice(0, 5)); setPitchAreaId(FULL_PITCH_AREA_ID); }
  };

  const chooseSuggestion = (suggestion) => {
    setDate(suggestion.startDate); setStartTime(suggestion.startTime); setEndTime(suggestion.endTime);
    choosePitch(suggestion.pitchId || ""); setPitchAreaId(suggestion.pitchAreaId || (request.requestType === "friendly" ? FULL_PITCH_AREA_ID : ""));
  };

  const submit = () => {
    const data = { message: text(message) || null };
    if (showAllocation) {
      const startAt = iso(date, startTime); const endAt = iso(date, endTime);
      if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) return toast.error("Allocation needs attention", { description: "Choose a valid date and finish time." });
      if (!selectedPitch && !selectedSlot) return toast.error("Choose an allocation", { description: "Select a club pitch or fixed winter slot." });
      const area = areas.find((row) => String(row.id) === String(pitchAreaId));
      if (selectedPitch && areas.length && !area) return toast.error("Choose Full Pitch or an area", { description: "The approval must reserve a clear part of the pitch." });
      Object.assign(data, {
        start_at: startAt, end_at: endAt,
        pitch_id: selectedPitch?.id || `winter-slot:${selectedSlot.id}`,
        pitch_name: selectedPitch?.label || selectedPitch?.name || selectedSlot?.label || "Winter slot",
        venue_id: selectedPitch?.siteId || selectedPitch?.venueId || (selectedSite ? `winter-site:${selectedSite.id}` : null),
        venue_name: selectedPitch?.siteLabel || selectedPitch?.siteName || selectedPitch?.venueName || selectedSite?.name || null,
        pitch_area_id: selectedPitch ? (area?.id || null) : FULL_PITCH_AREA_ID,
        pitch_area_name: selectedPitch ? (area?.label || null) : (selectedSlot?.area_name || selectedSlot?.areaName || FULL_PITCH_AREA_LABEL),
        season_phase: selectedSlot ? "winter" : (request.seasonPhase || "regular"),
        site_inventory_id: selectedSite?.id || null,
        site_slot_id: selectedSlot?.id || null,
        cost_pence: Number(selectedSlot?.cost_pence ?? selectedSlot?.costPence ?? 0) || null,
      });
    }
    onDecision(decision, data);
  };

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Review coach request"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[26px] bg-white p-5 shadow-2xl sm:p-6">
    <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Coach request</div><h2 className="mt-1 text-xl font-black text-slate-950">{request.title}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{request.teamName} · {request.preferredDate} · {request.preferredStartTime}–{request.preferredEndTime}</p></div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><X size={18} /></button></div>
    {request.conflicts?.length ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-black uppercase tracking-[0.15em] text-amber-800">Warnings carried with request</div><ul className="mt-2 space-y-1 text-xs font-semibold text-amber-900">{request.conflicts.map((row, index) => <li key={`${row.type}-${index}`}>• {row.message || row.type}</li>)}</ul></div> : null}
    {request.targetBookingId ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-600">Existing booking reference: <span className="font-black text-slate-900">{request.targetBookingId}</span></div> : null}
    {request.coachNotes ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">{request.coachNotes}</div> : null}
    <label className="mt-5 block text-xs font-black text-slate-700">Decision<select value={decision} onChange={(event) => setDecision(event.target.value)} className={`${selectClass} mt-2`}><option value="approve">{isCancellation ? "Approve cancellation" : "Approve / allocate"}</option>{!isCancellation ? <option value="alternative">Offer alternative</option> : null}<option value="needs_information">Ask for more information</option><option value="reject">Decline request</option></select></label>
    {showAllocation ? <div className="mt-4 space-y-4">{decision === "alternative" && request.suggestions?.length ? <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-800">Recommended alternatives</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{request.suggestions.map((suggestion) => <button key={`${suggestion.startDate}-${suggestion.startTime}-${suggestion.pitchId}`} type="button" onClick={() => chooseSuggestion(suggestion)} className="rounded-xl border border-sky-200 bg-white p-3 text-left text-xs font-bold text-sky-950 shadow-sm"><span className="block font-black">{suggestion.startDate} · {suggestion.startTime}–{suggestion.endTime}</span><span className="mt-1 block text-sky-700">{suggestion.pitchName || suggestion.pitchId}</span></button>)}</div></div> : null}
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-black text-slate-700">Date<input type="date" className={`${inputClass} mt-2`} value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="text-xs font-black text-slate-700">Pitch<select className={`${selectClass} mt-2`} value={pitchId} onChange={(event) => choosePitch(event.target.value)}><option value="">Choose pitch</option>{pitches.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label || pitch.name || pitch.id}</option>)}</select></label><label className="text-xs font-black text-slate-700">Start<input type="time" className={`${inputClass} mt-2`} value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label className="text-xs font-black text-slate-700">Finish<input type="time" className={`${inputClass} mt-2`} value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
      {selectedPitch && areas.length ? <label className="text-xs font-black text-slate-700 sm:col-span-2">Pitch allocation<select className={`${selectClass} mt-2`} value={pitchAreaId} onChange={(event) => setPitchAreaId(event.target.value)}><option value="">Choose allocation</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label> : null}
      {winterSlots.length ? <label className="text-xs font-black text-slate-700 sm:col-span-2">Or fixed winter slot<select className={`${selectClass} mt-2`} value={siteSlotId} onChange={(event) => chooseWinterSlot(event.target.value)}><option value="">Choose winter slot</option>{winterSlots.filter((slot) => slot.active !== false).map((slot) => { const site = winterSites.find((row) => String(row.id) === String(slot.site_id || slot.siteId)); return <option key={slot.id} value={slot.id}>{site?.name || "Winter site"} · {slot.label || slot.area_name || "Slot"} · {String(slot.start_time || slot.startTime).slice(0,5)}–{String(slot.end_time || slot.endTime).slice(0,5)}</option>; })}</select></label> : null}
      {selectedPitch ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600 sm:col-span-2">{selectedPitch.siteLabel || selectedPitch.siteName || selectedPitch.venueName || "Club venue"} · capacity {Math.max(1, Number(selectedPitch.trainingCapacity || 1))} simultaneous training team{Number(selectedPitch.trainingCapacity || 1) === 1 ? "" : "s"}</div> : null}</div>
    </div> : null}
    <label className="mt-4 block text-xs font-black text-slate-700">Message to coach<textarea className={`${inputClass} mt-2 min-h-24 resize-y`} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Explain the decision or alternative." /></label>
    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><SecondaryButton type="button" onClick={onClose} disabled={busy}>Cancel</SecondaryButton><PrimaryButton type="button" onClick={submit} disabled={busy}>{busy ? "Saving..." : "Confirm decision"}</PrimaryButton></div>
  </div></div>;
}
