import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { DB } from "../../lib/supabase.js";
import { buildRequestPayload, requestTypeOptions } from "../../lib/coach/coachHubEngine.js";
import { normaliseAvailabilityResult } from "../../lib/coach/sharedCalendarEngine.js";

function formatDate(value, options = { weekday: "short", day: "numeric", month: "short" }) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-GB", options).format(date);
}

function time(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function Field({ label, children, wide = false, hint = "" }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>{children}{hint ? <span className="mt-1.5 block text-[11px] font-semibold leading-5 text-slate-500">{hint}</span> : null}</label>;
}

const STEPS = ["Request", "Date & time", "Pitch options", "Review"];

export default function CoachRequestWizard({ clubId, draft, setDraft, assignments, bookings, pitches = [], busy, onSubmit }) {
  const [step, setStep] = useState(0);
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const assignment = assignments.find((row) => row.id === draft.assignmentId) || assignments[0] || {};
  const options = requestTypeOptions(assignment);
  const isExistingBookingRequest = ["change", "cancellation"].includes(draft.requestType);
  const eligibleBookings = (Array.isArray(bookings) ? bookings : []).filter((row) => row.teamKey === assignment.teamKey && !["cancelled", "rejected"].includes(row.status)).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const selectedPitch = pitches.find((row) => String(row.id) === String(draft.pitchId));
  const selectedAreas = selectedPitch?.trainingAreas || [];
  const requiresNamedArea = !isExistingBookingRequest
    && draft.requestType === "training"
    && Boolean(draft.pitchId)
    && selectedAreas.length > 0;
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const payload = useMemo(() => buildRequestPayload({
    ...draft,
    allowAdvisorySubmission: Boolean(draft.timeFlexible || draft.acceptablePitchIds?.length),
  }), [draft]);

  useEffect(() => {
    if (!clubId || !draft.assignmentId || !draft.date || !draft.startTime || !draft.endTime || draft.endTime <= draft.startTime || isExistingBookingRequest) {
      setAvailability(null);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setChecking(true);
      try {
        const result = normaliseAvailabilityResult(await DB.checkCoachHubRequestAvailability(clubId, payload));
        if (!cancelled) setAvailability(result);
      } catch (error) {
        if (!cancelled) setAvailability({ available: false, status: "unavailable", reasons: [{ message: error?.message || "Availability could not be checked." }], alternatives: [] });
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [clubId, draft.assignmentId, draft.date, draft.endTime, draft.pitchId, draft.requestType, draft.startTime, draft.timeFlexible, draft.flexibilityMinutes, draft.acceptablePitchIds, isExistingBookingRequest, payload]);

  const selectPitch = (pitchId) => {
    const pitch = pitches.find((row) => String(row.id) === String(pitchId));
    setDraft((current) => ({
      ...current,
      pitchId: pitch?.id || "",
      pitchName: pitch?.label || "",
      pitchAreaId: "",
      pitchAreaName: "",
      venueId: pitch?.siteId || "",
      venueName: pitch?.siteName || current.venueName || "",
    }));
  };

  const selectArea = (areaId) => {
    const area = selectedAreas.find((row) => row.id === areaId);
    setDraft((current) => ({ ...current, pitchAreaId: area?.id || "", pitchAreaName: area?.label || "" }));
  };

  const selectBooking = (bookingId) => {
    const booking = eligibleBookings.find((row) => row.id === bookingId);
    if (!booking) { set("targetBookingId", ""); return; }
    setDraft((current) => ({
      ...current,
      targetBookingId: booking.id,
      title: current.requestType === "cancellation" ? `Cancel ${booking.title}` : `Change ${booking.title}`,
      venueId: booking.venueId || "",
      venueName: booking.venueName || "",
      pitchId: booking.pitchId || "",
      pitchName: booking.pitchName || "",
      date: booking.startDate || current.date,
      startTime: booking.startTime || current.startTime,
      endTime: booking.endTime || current.endTime,
      recurrence: "none",
    }));
  };

  const changeRequestType = (requestType) => setDraft((current) => ({
    ...current,
    requestType,
    targetBookingId: ["change", "cancellation"].includes(requestType) ? current.targetBookingId : "",
    title: assignment.teamName ? `${assignment.teamName} ${requestType}` : `${requestType} request`,
    recurrence: requestType === "cancellation" ? "none" : current.recurrence,
  }));

  const canContinue = () => {
    if (step === 0) return Boolean(draft.assignmentId && draft.requestType && draft.title?.trim() && (!isExistingBookingRequest || draft.targetBookingId));
    if (step === 1) return Boolean(draft.date && draft.startTime && draft.endTime && draft.endTime > draft.startTime);
    if (step === 2) return !requiresNamedArea || Boolean(draft.pitchAreaId);
    return true;
  };

  const submit = async () => {
    if (!canContinue()) {
      toast.error(requiresNamedArea && !draft.pitchAreaId ? "Choose a pitch area" : "Complete the required request details", {
        description: requiresNamedArea && !draft.pitchAreaId ? "Select Half A, Half B or another named area so shared-pitch capacity can be checked correctly." : undefined,
      });
      return;
    }
    if (!isExistingBookingRequest && availability && !availability.available && !draft.timeFlexible && !draft.acceptablePitchIds?.length) {
      toast.error("The requested slot is unavailable", { description: "Choose an alternative pitch, allow a flexible time, or select one of the suggested slots." });
      return;
    }
    try {
      await onSubmit({ ...draft, allowAdvisorySubmission: Boolean(draft.timeFlexible || draft.acceptablePitchIds?.length) });
    } catch {
      // Grounded error is shown by the page and the wizard remains open.
    }
  };

  const toggleAcceptablePitch = (pitchId) => {
    setDraft((current) => {
      const ids = new Set(current.acceptablePitchIds || []);
      if (ids.has(pitchId)) ids.delete(pitchId); else ids.add(pitchId);
      return { ...current, acceptablePitchIds: [...ids] };
    });
  };

  const useAlternative = (alternative) => {
    const pitch = pitches.find((row) => row.id === alternative.pitchId);
    setDraft((current) => ({
      ...current,
      pitchId: alternative.pitchId,
      pitchName: alternative.pitchName,
      pitchAreaId: "",
      pitchAreaName: "",
      venueId: alternative.venueId || pitch?.siteId || "",
      venueName: alternative.venueName || pitch?.siteName || "",
      date: alternative.startDate,
      startTime: alternative.startTime,
      endTime: alternative.endTime,
    }));
    setStep(3);
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}>
      <section className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-[30px] bg-white shadow-2xl">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Guided Coach Hub request</div><h2 className="mt-1 text-xl font-black">{draft.requestId ? "Edit booking request" : "Find and request a suitable slot"}</h2></div><button type="button" onClick={() => setDraft(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><X size={18} /></button></div>
          <div className="mt-4 grid grid-cols-4 gap-2">{STEPS.map((label, index) => <button type="button" key={label} onClick={() => index <= step && setStep(index)} className={`rounded-xl px-2 py-2 text-[10px] font-black uppercase tracking-wide ${index === step ? "bg-slate-950 text-white" : index < step ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"}`}>{index + 1}. {label}</button>)}</div>
        </header>

        <div className="p-5 sm:p-6">
          {step === 0 ? <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Team"><select value={draft.assignmentId} onChange={(event) => { const next = assignments.find((row) => row.id === event.target.value); setDraft((current) => ({ ...current, assignmentId: event.target.value, targetBookingId: "", title: next?.teamName ? `${next.teamName} ${current.requestType}` : current.title })); }} className="input">{assignments.map((row) => <option key={row.id} value={row.id}>{row.teamName} · {row.staffRole}</option>)}</select></Field>
            <Field label="Request type"><select value={draft.requestType} onChange={(event) => changeRequestType(event.target.value)} className="input">{options.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}</select></Field>
            {isExistingBookingRequest ? <Field label={draft.requestType === "cancellation" ? "Booking to cancel" : "Booking to change"} wide><p className="mb-2 text-xs font-semibold text-slate-500">Choose the booking you want to change or cancel.</p><select value={draft.targetBookingId || ""} onChange={(event) => selectBooking(event.target.value)} className="input"><option value="">Choose an active team booking…</option>{eligibleBookings.map((booking) => <option key={booking.id} value={booking.id}>{formatDate(booking.startAt, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {booking.startTime} · {booking.pitchName || booking.title}</option>)}</select></Field> : null}
            <Field label="Title" wide><input value={draft.title} onChange={(event) => set("title", event.target.value)} className="input" /></Field>
            {draft.requestType === "friendly" ? <><Field label="Opponent"><input value={draft.opponentName} onChange={(event) => set("opponentName", event.target.value)} className="input" /></Field><Field label="Format"><input value={draft.format} onChange={(event) => set("format", event.target.value)} placeholder="11v11, 9v9…" className="input" /></Field></> : null}
          </div> : null}

          {step === 1 ? <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date"><input type="date" value={draft.date} onChange={(event) => set("date", event.target.value)} className="input" /></Field>
            <Field label="Estimated attendance"><input type="number" min="0" value={draft.estimatedAttendance} onChange={(event) => set("estimatedAttendance", event.target.value)} className="input" /></Field>
            <Field label="Starts"><input type="time" step="900" value={draft.startTime} onChange={(event) => set("startTime", event.target.value)} className="input" /></Field>
            <Field label="Finishes"><input type="time" step="900" value={draft.endTime} onChange={(event) => set("endTime", event.target.value)} className="input" /></Field>
            {!isExistingBookingRequest ? <><Field label="Repeats"><select value={draft.recurrence} onChange={(event) => set("recurrence", event.target.value)} className="input"><option value="none">One-off</option><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option></select></Field>{draft.recurrence !== "none" ? <><Field label="Repeat until"><input type="date" min={draft.date} value={draft.recurrenceUntil} onChange={(event) => set("recurrenceUntil", event.target.value)} className="input" /></Field><Field label="School holidays"><select value={draft.holidayPolicy || "include"} onChange={(event) => set("holidayPolicy", event.target.value)} className="input"><option value="include">Continue through holidays</option><option value="exclude">Exclude school holidays</option><option value="custom">Use dates to skip</option></select></Field></> : null}</> : null}
            {draft.recurrence !== "none" ? <Field label="Dates to skip" wide><textarea rows="3" value={draft.exceptionDatesText || ""} onChange={(event) => set("exceptionDatesText", event.target.value)} className="input min-h-[88px] py-3" placeholder="2026-10-26, 2026-11-02" /></Field> : null}
          </div> : null}

          {step === 2 ? <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Preferred pitch"><select value={draft.pitchId || ""} onChange={(event) => selectPitch(event.target.value)} className="input"><option value="">No pitch preference</option>{pitches.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label} · {pitch.trainingCapacity} training slot{pitch.trainingCapacity === 1 ? "" : "s"}</option>)}</select></Field><Field label="Pitch area" hint={selectedPitch ? `${selectedPitch.trainingCapacity} team${selectedPitch.trainingCapacity === 1 ? "" : "s"} can train simultaneously.` : "Choose a pitch first."}><select disabled={!selectedAreas.length} value={draft.pitchAreaId || ""} onChange={(event) => selectArea(event.target.value)} className="input disabled:bg-slate-100"><option value="">{selectedAreas.length ? "Choose a pitch area…" : "Whole pitch / shared capacity"}</option>{selectedAreas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></Field></div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="text-xs font-black uppercase tracking-wide text-sky-800">Acceptable alternatives</div><p className="mt-1 text-xs font-semibold leading-5 text-sky-900/75">Select pitches the club may approve without sending the request back to you.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{pitches.filter((pitch) => pitch.id !== draft.pitchId).map((pitch) => <label key={pitch.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 text-xs font-black text-sky-950"><input type="checkbox" checked={(draft.acceptablePitchIds || []).includes(pitch.id)} onChange={() => toggleAcceptablePitch(pitch.id)} /> {pitch.label}</label>)}</div></div>
            <label className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4"><input type="checkbox" className="mt-1" checked={Boolean(draft.timeFlexible)} onChange={(event) => set("timeFlexible", event.target.checked)} /><span className="min-w-0 flex-1"><span className="block text-sm font-black text-violet-950">My time is flexible</span><span className="mt-1 block text-xs font-semibold leading-5 text-violet-800">Let the club offer a nearby slot automatically.</span>{draft.timeFlexible ? <select value={draft.flexibilityMinutes || 30} onChange={(event) => set("flexibilityMinutes", Number(event.target.value))} className="input mt-3"><option value="30">Within 30 minutes</option><option value="60">Within 1 hour</option><option value="90">Within 90 minutes</option><option value="120">Within 2 hours</option></select> : null}</span></label>
            {selectedAreas.length ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold leading-5 text-emerald-900">Each named area is checked separately. A team may run a split training session on two different halves when the pitch capacity allows it; the same half cannot be booked twice.</div> : null}
            <Field label="Notes for the club" wide><textarea rows="4" value={draft.notes} onChange={(event) => set("notes", event.target.value)} className="input min-h-[110px] py-3" placeholder="Access needs, preferred areas or anything the scheduler should know." /></Field>
          </div> : null}

          {step === 3 ? <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Request summary</div><h3 className="mt-2 text-xl font-black">{draft.title}</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="flex items-center gap-2 text-sm font-bold"><CalendarDays size={17} /> {formatDate(`${draft.date}T12:00:00`, { weekday: "long", day: "numeric", month: "long" })}</div><div className="flex items-center gap-2 text-sm font-bold"><Clock3 size={17} /> {draft.startTime}–{draft.endTime}</div><div className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><MapPin size={17} /> {[draft.venueName, draft.pitchName, draft.pitchAreaName].filter(Boolean).join(" · ") || "Club to allocate a pitch"}</div></div></div>
              {checking ? <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-black text-sky-900">Checking live availability…</div> : availability ? <div className={`rounded-2xl border p-5 ${availability.available ? "border-emerald-200 bg-emerald-50" : availability.advisory ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"}`}><div className="flex items-center gap-2 text-sm font-black">{availability.available ? <CheckCircle2 className="text-emerald-600" size={19} /> : <AlertTriangle className={availability.advisory ? "text-amber-600" : "text-rose-600"} size={19} />}{availability.available ? "Requested slot is available" : availability.advisory ? "Preferred slot is unavailable, but alternatives exist" : "Requested slot is unavailable"}</div>{availability.available && draft.pitchId ? <p className="mt-2 text-xs font-semibold leading-5 opacity-80">{availability.remainingCapacity} of {availability.capacity} training place{availability.capacity === 1 ? "" : "s"} will remain after this request is approved.</p> : null}{availability.reasons?.length ? <ul className="mt-3 space-y-1 text-xs font-semibold opacity-80">{availability.reasons.map((row, index) => <li key={`${row.type || "reason"}-${index}`}>• {row.message || row.type}</li>)}</ul> : null}</div> : null}
              {availability?.alternatives?.length ? <div><div className="text-[10px] font-black uppercase tracking-wide text-sky-700">Available alternatives</div><div className="mt-2 grid gap-2 sm:grid-cols-2">{availability.alternatives.map((alternative) => <button type="button" key={`${alternative.pitchId}-${alternative.startAt}`} onClick={() => useAlternative(alternative)} className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left"><span className="block text-sm font-black text-sky-950">{alternative.pitchName}</span><span className="mt-1 block text-xs font-bold text-sky-800">{formatDate(alternative.startAt)} · {time(alternative.startAt)}–{time(alternative.endAt)}</span></button>)}</div></div> : null}
            </div>
            <aside className="space-y-3"><div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><Sparkles className="text-violet-600" size={19} /><div className="mt-2 text-sm font-black text-violet-950">What the club can do</div><p className="mt-1 text-xs font-semibold leading-5 text-violet-800">Approve this slot, use an acceptable pitch, offer another time, ask a question or decline with a reason.</p></div>{draft.timeFlexible || draft.acceptablePitchIds?.length ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold leading-5 text-emerald-900">Flexible approval enabled. The request may still be sent when the preferred slot is unavailable.</div> : null}</aside>
          </div> : null}
        </div>

        <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 p-5 backdrop-blur sm:flex-row sm:justify-between"><button type="button" onClick={() => step ? setStep((current) => current - 1) : setDraft(null)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-black"><ChevronLeft size={16} /> {step ? "Back" : "Cancel"}</button>{step < STEPS.length - 1 ? <button disabled={!canContinue()} type="button" onClick={() => setStep((current) => current + 1)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-40">Continue <ChevronRight size={16} /></button> : <button disabled={busy || checking} type="button" onClick={submit} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-50"><Send size={16} /> {busy ? (draft.requestId ? "Saving…" : "Sending…") : (draft.requestId ? "Save changes" : "Send request")}</button>}</footer>
      </section>
    </div>
  );
}
