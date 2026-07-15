import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  PrimaryButton,
  SecondaryButton,
  inputClass,
  selectClass,
} from "../Settings/SettingsPrimitives.jsx";

function text(value) {
  return String(value ?? "").trim();
}

function iso(date, time) {
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? "" : value.toISOString();
}

export default function CoachRequestReviewDialog({ request, busy, onClose, onDecision }) {
  const [decision, setDecision] = useState("approve");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(request.preferredDate || "");
  const [startTime, setStartTime] = useState(request.preferredStartTime || "");
  const [endTime, setEndTime] = useState(request.preferredEndTime || "");
  const [pitchName, setPitchName] = useState(request.preferredPitchName || "");
  const [venueName, setVenueName] = useState(request.preferredVenueName || "");

  const isCancellation = request.requestType === "cancellation";

  const submit = () => {
    const data = { message: text(message) || null };
    if (decision === "alternative") {
      const startAt = iso(date, startTime);
      const endAt = iso(date, endTime);
      if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) {
        toast.error("Alternative slot needs attention", { description: "Choose a valid date and a finish time after the start time." });
        return;
      }
      Object.assign(data, {
        start_at: startAt,
        end_at: endAt,
        pitch_name: text(pitchName) || null,
        venue_name: text(venueName) || null,
      });
    }
    onDecision(decision, data);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Review coach request">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[26px] bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Coach request</div>
            <h2 className="mt-1 text-xl font-black text-slate-950">{request.title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{request.teamName} · {request.preferredDate} · {request.preferredStartTime}–{request.preferredEndTime}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><X size={18} /></button>
        </div>

        {request.conflicts?.length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-black uppercase tracking-[0.15em] text-amber-800">Warnings carried with request</div>
            <ul className="mt-2 space-y-1 text-xs font-semibold text-amber-900">{request.conflicts.map((row, index) => <li key={`${row.type}-${index}`}>• {row.message || row.type}</li>)}</ul>
          </div>
        ) : null}
        {request.targetBookingId ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-600">
            Existing booking reference: <span className="font-black text-slate-900">{request.targetBookingId}</span>
          </div>
        ) : null}
        {request.coachNotes ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">{request.coachNotes}</div> : null}

        <label className="mt-5 block text-xs font-black text-slate-700">Decision
          <select value={decision} onChange={(event) => setDecision(event.target.value)} className={`${selectClass} mt-2`}>
            <option value="approve">{isCancellation ? "Approve cancellation" : "Approve requested slot"}</option>
            {!isCancellation ? <option value="alternative">Offer alternative</option> : null}
            <option value="needs_information">Ask for more information</option>
            <option value="reject">Decline request</option>
          </select>
        </label>

        {decision === "alternative" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-black text-slate-700">Date<input type="date" className={`${inputClass} mt-2`} value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label className="text-xs font-black text-slate-700">Venue<input className={`${inputClass} mt-2`} value={venueName} onChange={(event) => setVenueName(event.target.value)} /></label>
            <label className="text-xs font-black text-slate-700">Start<input type="time" className={`${inputClass} mt-2`} value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
            <label className="text-xs font-black text-slate-700">Finish<input type="time" className={`${inputClass} mt-2`} value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
            <label className="text-xs font-black text-slate-700 sm:col-span-2">Pitch<input className={`${inputClass} mt-2`} value={pitchName} onChange={(event) => setPitchName(event.target.value)} /></label>
          </div>
        ) : null}

        <label className="mt-4 block text-xs font-black text-slate-700">Message to coach
          <textarea className={`${inputClass} mt-2 min-h-24 resize-y`} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Explain the decision or alternative." />
        </label>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <SecondaryButton type="button" onClick={onClose} disabled={busy}>Cancel</SecondaryButton>
          <PrimaryButton type="button" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Confirm decision"}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
