import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  FilePenLine,
  Mail,
  MapPin,
  RefreshCw,
  Send,
  ShieldAlert,
  Table2,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import { useDaxoraPrompt } from "../../contexts/DaxoraInteractionContext.jsx";
import { normaliseLeagueResultsData } from "../../lib/league/leagueResultsEngine.js";
import LeagueClubDisciplinePanel from "./LeagueClubDisciplinePanel.jsx";
import LeagueClubRegistrationsPanel from "./LeagueClubRegistrationsPanel.jsx";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500";

const TABS = [
  ["fixtures", "Fixtures", CalendarDays],
  ["actions", "Actions", CheckCircle2],
  ["requests", "Change requests", FilePenLine],
  ["results", "Results", Table2],
  ["registrations", "Registrations", UserRoundCheck],
  ["discipline", "Discipline", ShieldAlert],
  ["messages", "Messages", Mail],
  ["calendar", "Calendar", CalendarPlus],
];

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Badge({ children, tone = "slate" }) {
  const styles = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    navy: "border-slate-950 bg-slate-950 text-white",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${styles[tone] || styles.slate}`}>{children}</span>;
}

function Field({ label, children }) {
  return <label><span className={LABEL}>{label}</span>{children}</label>;
}

function dateLabel(value) {
  if (!value) return "Date to be confirmed";
  try { return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(value); }
}

function acknowledgementTone(status) {
  if (["received", "ground_confirmed", "kickoff_confirmed"].includes(status)) return "green";
  if (["disputed", "unable_to_fulfil"].includes(status)) return "rose";
  return "amber";
}

function requestTone(status) {
  if (status === "approved") return "green";
  if (status === "rejected") return "rose";
  if (status === "under_review") return "blue";
  return "amber";
}

export default function LeagueClubPortalPage({ leagueId, portal, onRefresh }) {
  const daxoraPrompt = useDaxoraPrompt();
  const [tab, setTab] = useState("fixtures");
  const [busy, setBusy] = useState(false);
  const [selectedFixture, setSelectedFixture] = useState(null);
  const [requestForm, setRequestForm] = useState({ requestType: "date_change", requestedDate: "", requestedKickOff: "", requestedVenueId: "", reason: "" });
  const [lastCalendarUrl, setLastCalendarUrl] = useState("");
  const [resultData, setResultData] = useState(() => normaliseLeagueResultsData({}));
  const [resultLoading, setResultLoading] = useState(true);
  const [resultEdits, setResultEdits] = useState({});

  const loadResults = useCallback(async () => {
    setResultLoading(true);
    try { setResultData(normaliseLeagueResultsData(await DB.getLeagueClubResultsData(leagueId))); }
    catch (error) { toast.error("Club results could not be loaded", { description: error?.message }); }
    finally { setResultLoading(false); }
  }, [leagueId]);

  useEffect(() => { loadResults(); }, [loadResults]);

  const acknowledgementsByFixture = useMemo(() => new Map(portal.acknowledgements.map((row) => [row.publicationFixtureId, row])), [portal.acknowledgements]);
  const fixtureRows = useMemo(() => [...portal.fixtures].sort((left, right) => `${left.scheduledDate || "9999"}T${left.kickOff || "99"}`.localeCompare(`${right.scheduledDate || "9999"}T${right.kickOff || "99"}`)), [portal.fixtures]);
  const awaiting = useMemo(() => portal.acknowledgements.filter((row) => row.status === "awaiting"), [portal.acknowledgements]);
  const openRequests = useMemo(() => portal.changeRequests.filter((row) => ["submitted", "under_review"].includes(row.status)), [portal.changeRequests]);
  const resultByPublicationFixture = useMemo(() => new Map(resultData.results.map((row) => [row.publicationFixtureId, row])), [resultData.results]);
  const submissionByPublicationFixture = useMemo(() => new Map(resultData.submissions.filter((row) => row.status === "submitted").map((row) => [row.publicationFixtureId, row])), [resultData.submissions]);
  const resultFixtures = useMemo(() => fixtureRows.filter((fixture) => fixture.scheduledDate && fixture.scheduledDate <= new Date().toISOString().slice(0, 10)), [fixtureRows]);

  const requestReady = requestForm.reason.trim().length >= 3
    && (requestForm.requestType !== "date_change" || Boolean(requestForm.requestedDate))
    && (requestForm.requestType !== "kickoff_change" || Boolean(requestForm.requestedKickOff))
    && (requestForm.requestType !== "venue_change" || Boolean(requestForm.requestedVenueId));

  const acknowledge = async (acknowledgement, status) => {
    if (!acknowledgement) return;
    const notes = ["disputed", "unable_to_fulfil"].includes(status) ? await daxoraPrompt({
      title: status === "disputed" ? "Dispute fixture details" : "Report fixture issue",
      description: "Explain the issue clearly so the league can investigate and respond.",
      label: "Message to the league",
      confirmLabel: "Send response",
      required: true,
      minLength: 3,
      multiline: true,
    }) : "";
    if (["disputed", "unable_to_fulfil"].includes(status) && (notes === null || !notes.trim())) return;
    setBusy(true);
    try {
      await DB.acknowledgeLeagueFixture(leagueId, acknowledgement.id, status, notes);
      await onRefresh?.();
      toast.success("Fixture response recorded");
    } catch (error) { toast.error("Fixture response could not be recorded", { description: error?.message }); }
    finally { setBusy(false); }
  };

  const submitRequest = async () => {
    if (!selectedFixture || requestForm.reason.trim().length < 3) { toast.error("Add a reason for the request"); return; }
    setBusy(true);
    try {
      await DB.createLeagueFixtureChangeRequest(leagueId, {
        publicationId: selectedFixture.publicationId,
        targetType: selectedFixture.targetType,
        targetId: selectedFixture.targetId,
        ...requestForm,
      });
      setSelectedFixture(null);
      setRequestForm({ requestType: "date_change", requestedDate: "", requestedKickOff: "", requestedVenueId: "", reason: "" });
      await onRefresh?.();
      toast.success("Fixture-change request submitted");
    } catch (error) { toast.error("Fixture-change request could not be submitted", { description: error?.message }); }
    finally { setBusy(false); }
  };

  const submitResult = async (fixture) => {
    const edit = resultEdits[fixture.publicationFixtureId] || {};
    if (edit.homeScore === "" || edit.homeScore === undefined || edit.awayScore === "" || edit.awayScore === undefined) { toast.error("Enter both scores"); return; }
    setBusy(true);
    try {
      await DB.submitLeagueFixtureResult(leagueId, fixture.publicationFixtureId, { outcomeType: "played", homeScore: edit.homeScore, awayScore: edit.awayScore, notes: edit.notes || "" });
      setResultEdits((current) => { const next = { ...current }; delete next[fixture.publicationFixtureId]; return next; });
      await loadResults();
      toast.success("Result sent to the league for verification");
    } catch (error) { toast.error("Result could not be submitted", { description: error?.message }); }
    finally { setBusy(false); }
  };

  const createCalendar = async (scopeType, scopeId, label) => {
    setBusy(true);
    try {
      const result = await DB.createLeagueCalendarFeed(leagueId, { scopeType, scopeId, label });
      const url = `${window.location.origin}/api/league/calendar?token=${encodeURIComponent(result.token)}`;
      setLastCalendarUrl(url);
      await onRefresh?.();
      toast.success("Calendar subscription created");
    } catch (error) { toast.error("Calendar subscription could not be created", { description: error?.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-5">
      <Panel className="overflow-hidden">
        <div className="grid gap-6 bg-slate-950 px-6 py-7 text-white lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div><div className="flex flex-wrap items-center gap-2"><Badge tone="green">Club portal</Badge><Badge tone="navy">{String(portal.access.role || "club member").replaceAll("_", " ")}</Badge></div><h1 className="mt-4 text-3xl font-black tracking-tight">{portal.club.name || "Club workspace"}</h1><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">{portal.league.name || "League Manager"} fixtures, acknowledgements, change requests and league communications.</p></div>
          <button type="button" onClick={onRefresh} className={`${BUTTON} border border-white/15 bg-white/10 text-white`}><RefreshCw size={15} /> Refresh portal</button>
        </div>
        <div className="grid gap-3 border-t border-white/10 bg-slate-900 px-6 py-4 sm:grid-cols-4 lg:px-8">
          <div><div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Teams</div><div className="mt-1 text-lg font-black text-white">{portal.teams.length}</div></div>
          <div><div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Published fixtures</div><div className="mt-1 text-lg font-black text-white">{fixtureRows.length}</div></div>
          <div><div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Awaiting response</div><div className="mt-1 text-lg font-black text-white">{awaiting.length}</div></div>
          <div><div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Open requests</div><div className="mt-1 text-lg font-black text-white">{openRequests.length}</div></div>
        </div>
      </Panel>

      <nav className="grid grid-cols-2 gap-2 rounded-[22px] border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        {TABS.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-xs font-black ${tab === key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={15} className={tab === key ? "text-emerald-300" : "text-slate-400"} />{label}{key === "actions" && awaiting.length ? <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] text-white">{awaiting.length}</span> : null}</button>)}
      </nav>

      {tab === "fixtures" ? <div className="space-y-3">{fixtureRows.length ? fixtureRows.map((fixture) => {
        const acknowledgement = acknowledgementsByFixture.get(fixture.publicationFixtureId);
        return <Panel key={`${fixture.publicationId}:${fixture.targetType}:${fixture.targetId}`} className="p-4 sm:p-5"><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={fixture.competitionType === "cup" ? "amber" : "blue"}>{fixture.competitionType}</Badge>{acknowledgement ? <Badge tone={acknowledgementTone(acknowledgement.status)}>{acknowledgement.status.replaceAll("_", " ")}</Badge> : null}</div><h3 className="mt-3 text-lg font-black text-slate-950">{fixture.homeTeamName || "Home team"} <span className="text-slate-400">v</span> {fixture.awayTeamName || "Away team"}</h3><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{dateLabel(fixture.scheduledDate)}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={14} />{String(fixture.kickOff || "TBC").slice(0, 5)}</span><span className="inline-flex items-center gap-1.5"><MapPin size={14} />{fixture.venueName || "Venue TBC"}</span></div></div><div className="flex flex-wrap gap-2">{acknowledgement && portal.access.canRespond ? <button type="button" disabled={busy} onClick={() => acknowledge(acknowledgement, "received")} className={`${BUTTON} border border-emerald-200 bg-emerald-50 text-emerald-700`}><CheckCircle2 size={14} /> Fixture received</button> : null}{portal.access.canRequestChanges ? <button type="button" disabled={busy} onClick={() => setSelectedFixture(fixture)} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}><FilePenLine size={14} /> Request change</button> : null}</div></div></Panel>;
      }) : <Panel className="p-10 text-center text-sm font-bold text-slate-500">No published fixtures are available for this club yet.</Panel>}</div> : null}

      {tab === "actions" ? <Panel className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">Club action queue</h2><p className="mt-1 text-sm font-semibold text-slate-500">Confirm receipt, ground and kick-off, or tell the league when a fixture cannot be fulfilled.</p></div><Badge tone={awaiting.length ? "amber" : "green"}>{awaiting.length ? `${awaiting.length} awaiting` : "Clear"}</Badge></div><div className="mt-5 space-y-3">{awaiting.length ? awaiting.map((acknowledgement) => {
        const fixture = fixtureRows.find((row) => row.publicationFixtureId === acknowledgement.publicationFixtureId);
        if (!fixture) return null;
        return <div key={acknowledgement.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-sm font-black text-slate-950">{fixture.homeTeamName} v {fixture.awayTeamName}</div><div className="mt-1 text-xs font-semibold text-slate-600">{dateLabel(fixture.scheduledDate)} · {String(fixture.kickOff || "TBC").slice(0, 5)} · {fixture.venueName || "Venue TBC"}</div><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => acknowledge(acknowledgement, "received")} className={`${BUTTON} bg-slate-950 text-white`}>Received</button><button disabled={busy} onClick={() => acknowledge(acknowledgement, "ground_confirmed")} className={`${BUTTON} bg-emerald-600 text-white`}>Ground confirmed</button><button disabled={busy} onClick={() => acknowledge(acknowledgement, "kickoff_confirmed")} className={`${BUTTON} bg-sky-600 text-white`}>Kick-off confirmed</button><button disabled={busy} onClick={() => acknowledge(acknowledgement, "disputed")} className={`${BUTTON} border border-rose-200 bg-rose-50 text-rose-700`}>Dispute</button><button disabled={busy} onClick={() => acknowledge(acknowledgement, "unable_to_fulfil")} className={`${BUTTON} border border-rose-200 bg-white text-rose-700`}>Unable to fulfil</button></div></div>;
      }) : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center"><CheckCircle2 className="mx-auto text-emerald-600" /><div className="mt-3 text-sm font-black text-emerald-900">No fixture acknowledgements are outstanding.</div></div>}</div></Panel> : null}

      {tab === "requests" ? <Panel className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">Fixture-change requests</h2><p className="mt-1 text-sm font-semibold text-slate-500">Every request retains the league decision and any resulting schedule version.</p></div><button type="button" onClick={() => setTab("fixtures")} className={`${BUTTON} bg-slate-950 text-white`}><FilePenLine size={14} /> Select a fixture</button></div><div className="mt-5 space-y-3">{portal.changeRequests.length ? portal.changeRequests.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.requestType.replaceAll("_", " ")}</div><div className="mt-1 text-xs font-semibold text-slate-500">Submitted {row.createdAt ? new Date(row.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : ""}</div></div><Badge tone={requestTone(row.status)}>{row.status.replaceAll("_", " ")}</Badge></div><p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{row.reason}</p>{row.league_response || row.leagueResponse ? <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">League response: {row.league_response || row.leagueResponse}</div> : null}</div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">No fixture-change requests have been submitted.</div>}</div></Panel> : null}

      {tab === "results" ? <Panel className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">Submit match results</h2><p className="mt-1 text-sm font-semibold text-slate-500">Club submissions remain pending until the league verifies the official result.</p></div><Badge tone={resultData.submissions.some((row) => row.status === "submitted") ? "amber" : "green"}>{resultData.submissions.filter((row) => row.status === "submitted").length} pending</Badge></div>{resultLoading ? <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-8 text-sm font-black text-slate-600"><RefreshCw className="animate-spin" size={16} /> Loading results…</div> : <div className="mt-5 space-y-3">{resultFixtures.length ? resultFixtures.map((fixture) => { const verified = resultByPublicationFixture.get(fixture.publicationFixtureId); const pending = submissionByPublicationFixture.get(fixture.publicationFixtureId); const edit = resultEdits[fixture.publicationFixtureId] || {}; return <div key={fixture.publicationFixtureId} className="rounded-2xl border border-slate-200 p-4"><div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-center"><div><div className="text-sm font-black text-slate-950">{fixture.homeTeamName} v {fixture.awayTeamName}</div><div className="mt-1 text-xs font-semibold text-slate-500">{dateLabel(fixture.scheduledDate)} · {String(fixture.kickOff || "TBC").slice(0, 5)} · {fixture.competitionName || fixture.divisionName || (fixture.competitionType === "cup" ? "Cup" : "League")}</div></div>{verified ? <Badge tone="green">Verified {verified.homeScore}–{verified.awayScore}</Badge> : pending ? <Badge tone="amber">Awaiting league verification</Badge> : resultData.access.canSubmit ? <div className="flex flex-wrap items-center gap-2"><input aria-label={`Home score ${fixture.publicationFixtureId}`} type="number" min="0" className="h-10 w-16 rounded-xl border border-slate-200 px-2 text-center text-sm font-black" value={edit.homeScore ?? ""} onChange={(event) => setResultEdits((current) => ({ ...current, [fixture.publicationFixtureId]: { ...current[fixture.publicationFixtureId], homeScore: event.target.value } }))} /><span className="font-black text-slate-400">–</span><input aria-label={`Away score ${fixture.publicationFixtureId}`} type="number" min="0" className="h-10 w-16 rounded-xl border border-slate-200 px-2 text-center text-sm font-black" value={edit.awayScore ?? ""} onChange={(event) => setResultEdits((current) => ({ ...current, [fixture.publicationFixtureId]: { ...current[fixture.publicationFixtureId], awayScore: event.target.value } }))} /><button type="button" disabled={busy} onClick={() => submitResult(fixture)} className={`${BUTTON} bg-emerald-600 text-white`}><Send size={14} /> Submit</button></div> : <Badge tone="slate">Read only</Badge>}</div></div>; }) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">No played published fixtures are available yet.</div>}</div>}</Panel> : null}

      {tab === "registrations" ? <LeagueClubRegistrationsPanel leagueId={leagueId} /> : null}

      {tab === "discipline" ? <LeagueClubDisciplinePanel leagueId={leagueId} /> : null}

      {tab === "messages" ? <Panel className="p-5 sm:p-6"><h2 className="text-xl font-black text-slate-950">League communications</h2><div className="mt-5 space-y-3">{portal.communications.length ? portal.communications.map((row) => <article key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.subject}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.sentAt ? new Date(row.sentAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "League message"}</div></div>{row.requiresAcknowledgement ? <Badge tone="amber">Acknowledgement</Badge> : <Badge tone="slate">Information</Badge>}</div><p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{row.body}</p></article>) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">No league messages are available.</div>}</div></Panel> : null}

      {tab === "calendar" ? <div className="grid gap-5 lg:grid-cols-2"><Panel className="p-5 sm:p-6"><div className="flex items-center gap-3"><CalendarPlus className="text-emerald-600" /><div><h2 className="text-xl font-black text-slate-950">Subscribe to fixtures</h2><p className="text-sm font-semibold text-slate-500">Changes update automatically in calendar applications that support ICS subscriptions.</p></div></div><div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => createCalendar("club", portal.club.id, `${portal.club.name} fixtures`)} className={`${BUTTON} bg-emerald-600 text-white`}><CalendarPlus size={14} /> Club calendar</button>{portal.teams.map((team) => <button key={team.id} type="button" disabled={busy} onClick={() => createCalendar("team", team.id, `${team.name} fixtures`)} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}>{team.name}</button>)}</div>{lastCalendarUrl ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-black text-emerald-900">Private calendar URL</div><div className="mt-2 flex gap-2"><input readOnly className={INPUT} value={lastCalendarUrl} /><button type="button" onClick={async () => { await navigator.clipboard.writeText(lastCalendarUrl); toast.success("Calendar URL copied"); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><ClipboardCopy size={15} /></button></div><p className="mt-2 text-[11px] font-semibold leading-5 text-emerald-800">Do not post this URL publicly. It grants access to the calendar feed.</p></div> : null}</Panel><Panel className="p-5 sm:p-6"><h2 className="text-xl font-black text-slate-950">Active feeds</h2><div className="mt-5 space-y-3">{portal.calendarFeeds.length ? portal.calendarFeeds.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="text-sm font-black text-slate-950">{row.feedLabel || `${row.feedType} calendar`}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.feedType}</div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">No calendar feeds have been created by this account.</div>}</div></Panel></div> : null}

      {selectedFixture ? <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true"><Panel className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Fixture-change request</div><h2 className="mt-2 text-xl font-black text-slate-950">{selectedFixture.homeTeamName} v {selectedFixture.awayTeamName}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{dateLabel(selectedFixture.scheduledDate)} · {String(selectedFixture.kickOff || "TBC").slice(0, 5)}</p></div><button type="button" onClick={() => setSelectedFixture(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">Close</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Request type"><select className={INPUT} value={requestForm.requestType} onChange={(event) => setRequestForm((current) => ({ ...current, requestType: event.target.value }))}><option value="date_change">Date change</option><option value="kickoff_change">Kick-off change</option><option value="venue_change">Venue change</option><option value="postponement">Postponement</option><option value="ground_unavailable">Ground unavailable</option><option value="cup_conflict">Cup conflict</option><option value="team_withdrawal">Team withdrawal</option></select></Field><Field label="Proposed date"><input type="date" className={INPUT} value={requestForm.requestedDate} onChange={(event) => setRequestForm((current) => ({ ...current, requestedDate: event.target.value }))} /></Field><Field label="Proposed kick-off"><input type="time" className={INPUT} value={requestForm.requestedKickOff} onChange={(event) => setRequestForm((current) => ({ ...current, requestedKickOff: event.target.value }))} /></Field><Field label="Proposed venue"><select className={INPUT} value={requestForm.requestedVenueId} onChange={(event) => setRequestForm((current) => ({ ...current, requestedVenueId: event.target.value }))}><option value="">No venue change</option>{portal.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></Field><label className="sm:col-span-2"><span className={LABEL}>Reason and evidence</span><textarea className="min-h-32 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={requestForm.reason} onChange={(event) => setRequestForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Explain why the change is required and include any relevant evidence or agreement." /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setSelectedFixture(null)} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}>Cancel</button><button type="button" disabled={busy || !requestReady} onClick={submitRequest} className={`${BUTTON} bg-emerald-600 text-white`}><Send size={14} /> Submit request</button></div></Panel></div> : null}
    </div>
  );
}
