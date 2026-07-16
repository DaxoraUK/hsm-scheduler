import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import CoachRequestConversation from "../components/coach/CoachRequestConversation.jsx";
import { DB } from "../lib/supabase.js";
import {
  buildBlankCoachRequest,
  buildCoachHubIcsUrl,
  buildCoachHubMetrics,
  buildRequestPayload,
  normaliseCoachHubWorkspace,
  requestStatusLabel,
  requestTypeOptions,
} from "../lib/coach/coachHubEngine.js";

const TABS = [
  ["home", "Home", Sparkles],
  ["calendar", "Calendar", CalendarDays],
  ["requests", "Requests", CalendarPlus],
  ["messages", "Messages", MessageSquareText],
  ["team", "Team", Users],
  ["profile", "Profile", Settings],
];

function formatDate(value, options = { weekday: "short", day: "numeric", month: "short" }) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-GB", options).format(date);
}

function time(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function statusTone(status) {
  const value = String(status || "");
  if (["approved", "accepted", "confirmed"].includes(value)) return "bg-emerald-100 text-emerald-800";
  if (["rejected", "declined", "cancelled"].includes(value)) return "bg-rose-100 text-rose-700";
  if (["alternative_offered", "needs_information"].includes(value)) return "bg-amber-100 text-amber-800";
  return "bg-sky-100 text-sky-800";
}

function Badge({ children, tone = "bg-slate-100 text-slate-700" }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${tone}`}>{children}</span>;
}

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Empty({ icon: Icon, title, body }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Icon className="mx-auto text-slate-400" size={26} /><div className="mt-3 text-sm font-black text-slate-800">{title}</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{body}</div></div>;
}

export default function CoachHubPage({
  clubId,
  activeMembership,
  memberships = [],
  authSession,
  subscription,
  onClubChange,
  onSignOut,
}) {
  const [workspace, setWorkspace] = useState(() => normaliseCoachHubWorkspace({}));
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");
  const [mobileNav, setMobileNav] = useState(false);
  const [requestDraft, setRequestDraft] = useState(null);
  const [conversationRequest, setConversationRequest] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setStatus("loading");
    setError("");
    try {
      const today = new Date();
      const payload = await DB.getCoachHubWorkspace(clubId, {
        startDate: `${today.getFullYear()}-01-01`,
        endDate: `${today.getFullYear() + 1}-12-31`,
      });
      setWorkspace(normaliseCoachHubWorkspace(payload));
      setStatus("ready");
    } catch (loadError) {
      setError(loadError?.message || "Coach Hub could not be loaded.");
      setStatus("error");
    }
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => buildCoachHubMetrics(workspace), [workspace]);
  const upcoming = useMemo(() => workspace.bookings.filter((row) => new Date(row.endAt || row.startAt).getTime() >= Date.now()).sort((a, b) => new Date(a.startAt) - new Date(b.startAt)), [workspace.bookings]);
  const unread = metrics.unreadMessages + metrics.acknowledgements;
  const clubName = workspace.club?.name || activeMembership?.club?.name || "Your club";

  const openRequest = (assignment = workspace.assignments[0]) => {
    if (!assignment) {
      toast.error("No team assignment found", { description: "Ask a club administrator to connect your contact record to a team." });
      return;
    }
    setRequestDraft(buildBlankCoachRequest(assignment));
  };

  async function submitRequest(draft) {
    setBusy(true);
    try {
      await DB.submitCoachHubRequest(clubId, buildRequestPayload(draft));
      setRequestDraft(null);
      await load({ quiet: true });
      setTab("requests");
      toast.success("Request sent to the club scheduler");
    } catch (requestError) {
      toast.error("Request could not be sent", { description: requestError?.message || "Review the booking details and try again." });
      throw requestError;
    } finally {
      setBusy(false);
    }
  }

  async function respondAlternative(request, response) {
    setBusy(true);
    try {
      await DB.respondToCoachHubAlternative(clubId, request.id, response);
      await load({ quiet: true });
      toast.success(response === "accept" ? "Alternative accepted" : "Alternative declined");
    } catch (responseError) {
      toast.error("Response could not be saved", { description: responseError?.message });
    } finally {
      setBusy(false);
    }
  }

  async function markMessage(message, acknowledge = false) {
    try {
      await DB.markCoachHubMessage(clubId, message.id, acknowledge);
      await load({ quiet: true });
    } catch (messageError) {
      toast.error("Message status could not be updated", { description: messageError?.message });
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white shadow-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => setMobileNav(true)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 lg:hidden" aria-label="Open Coach Hub navigation"><Menu size={20} /></button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 font-black text-slate-950">D</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black">Daxora Coach Hub</div>
            <div className="truncate text-[11px] font-bold text-slate-400">{clubName} · {workspace.assignments.map((row) => row.teamName).join(", ") || "Team access"}</div>
          </div>
          <button type="button" onClick={() => setTab("messages")} className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10" aria-label={`${unread} unread Coach Hub items`}><Bell size={18} />{unread ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black">{Math.min(unread, 99)}</span> : null}</button>
          <button type="button" onClick={onSignOut} className="hidden h-10 items-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-black sm:flex"><LogOut size={16} /> Sign out</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:py-7">
        <aside className="hidden self-start rounded-[26px] border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-24 lg:block">
          <CoachNavigation tab={tab} setTab={setTab} metrics={metrics} />
          {memberships.length > 1 ? <div className="mt-2 border-t border-slate-200 p-2"><label className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Workspace</label><select value={clubId} onChange={(event) => onClubChange?.(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{memberships.map((row) => <option key={row.clubId} value={row.clubId}>{row.club?.name || "Club"}</option>)}</select></div> : null}
        </aside>

        <main id="coach-hub-main" className="min-w-0 space-y-5">
          {status === "loading" ? <CoachHubLoading /> : null}
          {status === "error" ? <Panel className="p-6"><div className="text-lg font-black">Coach Hub needs attention</div><p className="mt-2 text-sm font-semibold text-slate-500">{error}</p><button type="button" onClick={() => load()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><RefreshCw size={17} /> Try again</button></Panel> : null}
          {status === "ready" ? <>
            {tab === "home" ? <HomeTab workspace={workspace} metrics={metrics} upcoming={upcoming} onRequest={openRequest} setTab={setTab} /> : null}
            {tab === "calendar" ? <CalendarTab bookings={upcoming} assignments={workspace.assignments} onCreateFeed={async (assignment = null) => {
              setBusy(true);
              try {
                const label = assignment ? `${assignment.teamName} calendar` : `${workspace.assignments.map((row) => row.teamName).join(" & ")} calendar`;
                const result = assignment
                  ? await DB.createCoachHubTeamCalendarFeed(clubId, assignment.teamKey, label)
                  : await DB.createCoachHubCalendarFeed(clubId, label);
                const url = buildCoachHubIcsUrl(result?.token);
                await navigator.clipboard.writeText(url);
                toast.success("Private calendar link copied", { description: assignment ? `${assignment.teamName} only · add it to Google, Apple or Outlook.` : "All assigned teams · add it to Google, Apple or Outlook." });
              } catch (feedError) { toast.error("Calendar feed could not be created", { description: feedError?.message }); }
              finally { setBusy(false); }
            }} busy={busy} /> : null}
            {tab === "requests" ? <RequestsTab requests={workspace.requests} assignments={workspace.assignments} onRequest={openRequest} onAlternative={respondAlternative} onConversation={setConversationRequest} busy={busy} /> : null}
            {tab === "messages" ? <MessagesTab messages={workspace.messages} onMark={markMessage} /> : null}
            {tab === "team" ? <TeamTab assignments={workspace.assignments} contacts={workspace.teamContacts} /> : null}
            {tab === "profile" ? <ProfileTab clubId={clubId} person={workspace.person} authSession={authSession} subscription={subscription} onSaved={() => load({ quiet: true })} onSignOut={onSignOut} /> : null}
          </> : null}
        </main>
      </div>

      <button type="button" onClick={() => openRequest()} className="fixed bottom-5 right-5 z-30 flex h-14 items-center gap-2 rounded-2xl bg-emerald-500 px-5 text-sm font-black text-slate-950 shadow-2xl shadow-emerald-900/20 lg:hidden"><Plus size={20} /> Request</button>

      {mobileNav ? <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileNav(false); }}><aside className="h-full w-[86%] max-w-sm bg-white p-4 shadow-2xl"><div className="flex items-center justify-between"><div><div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Coach Hub</div><div className="mt-1 text-lg font-black">{workspace.person.displayName || authSession?.user?.email}</div></div><button type="button" onClick={() => setMobileNav(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><X size={18} /></button></div><div className="mt-6"><CoachNavigation tab={tab} setTab={(next) => { setTab(next); setMobileNav(false); }} metrics={metrics} /></div><button type="button" onClick={onSignOut} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-black text-white"><LogOut size={17} /> Sign out</button></aside></div> : null}
      {requestDraft ? <RequestDialog draft={requestDraft} setDraft={setRequestDraft} assignments={workspace.assignments} bookings={workspace.bookings} busy={busy} onSubmit={submitRequest} /> : null}
      {conversationRequest ? <CoachRequestConversation clubId={clubId} request={conversationRequest} role="coach" onClose={() => setConversationRequest(null)} /> : null}
    </div>
  );
}

function CoachNavigation({ tab, setTab, metrics }) {
  return <nav className="space-y-1" aria-label="Coach Hub sections">{TABS.map(([key, label, Icon]) => { const badge = key === "requests" ? metrics.pendingRequests : key === "messages" ? metrics.unreadMessages + metrics.acknowledgements : 0; return <button key={key} type="button" onClick={() => setTab(key)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black transition ${tab === key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tab === key ? "bg-emerald-400/15 text-emerald-300" : "bg-slate-100 text-slate-400"}`}><Icon size={18} /></span><span className="flex-1">{label}</span>{badge ? <span className="flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 py-1 text-[9px] text-white">{badge}</span> : null}</button>; })}</nav>;
}

function HomeTab({ workspace, metrics, upcoming, onRequest, setTab }) {
  const next = metrics.nextBooking;
  return <>
    <section className="overflow-hidden rounded-[30px] bg-slate-950 p-6 text-white shadow-xl sm:p-8"><div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">My Team Planner</div><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Welcome, {workspace.person.displayName?.split(" ")[0] || "coach"}</h1><p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">Fixtures, training, friendlies and club decisions in one place—without shared spreadsheets or repeated contact setup.</p></div><button type="button" onClick={() => onRequest()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 text-sm font-black text-slate-950"><Plus size={18} /> Request a session</button></div></section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Upcoming" value={metrics.upcomingCount} detail="fixtures and sessions" tone="sky" /><Metric label="Pending requests" value={metrics.pendingRequests} detail={metrics.alternatives ? `${metrics.alternatives} alternative offered` : "with the club"} tone="amber" /><Metric label="Unread messages" value={metrics.unreadMessages} detail="team and club updates" tone="violet" /><Metric label="Actions" value={metrics.acknowledgements} detail="need acknowledgement" tone={metrics.acknowledgements ? "rose" : "emerald"} /></div>
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><Panel className="p-5 sm:p-6"><div className="flex items-start justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Next up</div><h2 className="mt-1 text-xl font-black">Your next team activity</h2></div><button type="button" onClick={() => setTab("calendar")} className="text-xs font-black text-sky-700">View calendar</button></div>{next ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><Badge tone="bg-white text-emerald-800">{next.bookingType}</Badge><div className="mt-3 text-xl font-black text-emerald-950">{next.title}</div><div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-emerald-900/75"><span className="inline-flex items-center gap-1"><CalendarDays size={15} /> {formatDate(next.startAt, { weekday: "long", day: "numeric", month: "long" })}</span><span className="inline-flex items-center gap-1"><Clock3 size={15} /> {time(next.startAt)}–{time(next.endAt)}</span><span className="inline-flex items-center gap-1"><MapPin size={15} /> {[next.venueName, next.pitchName].filter(Boolean).join(" · ") || "Venue TBC"}</span></div></div> : <Empty icon={CalendarDays} title="No upcoming bookings" body="Submit a training or friendly request to start building the team calendar." />}</Panel><Panel className="p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">Team access</div><h2 className="mt-1 text-xl font-black">Your connected teams</h2><div className="mt-5 space-y-3">{workspace.assignments.map((row) => <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Users size={18} /></span><div className="min-w-0"><div className="truncate text-sm font-black">{row.teamName}</div><div className="mt-0.5 text-xs font-semibold capitalize text-slate-500">{row.staffRole}</div></div><CheckCircle2 className="ml-auto text-emerald-500" size={18} /></div>)}</div></Panel></div>
    <Panel className="p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Coming up</h2><button type="button" onClick={() => setTab("calendar")} className="inline-flex items-center gap-1 text-xs font-black text-sky-700">All dates <ChevronRight size={15} /></button></div><div className="mt-5 grid gap-3 lg:grid-cols-3">{upcoming.slice(0, 3).map((row) => <BookingCard key={row.id} booking={row} />)}{!upcoming.length ? <div className="lg:col-span-3"><Empty icon={CalendarDays} title="Calendar clear" body="Approved requests and matchday bookings will appear here." /></div> : null}</div></Panel>
  </>;
}

function Metric({ label, value, detail, tone }) {
  const tones = { sky: "border-sky-200 bg-sky-50 text-sky-950", amber: "border-amber-200 bg-amber-50 text-amber-950", violet: "border-violet-200 bg-violet-50 text-violet-950", rose: "border-rose-200 bg-rose-50 text-rose-950", emerald: "border-emerald-200 bg-emerald-50 text-emerald-950" };
  return <div className={`rounded-2xl border p-4 ${tones[tone] || tones.sky}`}><div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-55">{label}</div><div className="mt-1 text-2xl font-black">{value}</div><div className="mt-0.5 text-[11px] font-bold opacity-60">{detail}</div></div>;
}

function BookingCard({ booking }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-black">{booking.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{booking.teamName}</div></div><Badge tone={statusTone(booking.status)}>{booking.status}</Badge></div><div className="mt-4 space-y-1.5 text-xs font-bold text-slate-600"><div className="flex items-center gap-2"><CalendarDays size={14} /> {formatDate(booking.startAt)}</div><div className="flex items-center gap-2"><Clock3 size={14} /> {time(booking.startAt)}–{time(booking.endAt)}</div><div className="flex items-center gap-2"><MapPin size={14} /> {[booking.venueName, booking.pitchName].filter(Boolean).join(" · ") || "Venue TBC"}</div></div></div>;
}

function CalendarTab({ bookings, assignments = [], onCreateFeed, busy }) {
  const grouped = useMemo(() => bookings.reduce((map, row) => {
    const key = new Date(row.startAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map()), [bookings]);
  return <>
    <section className="rounded-[30px] bg-gradient-to-br from-sky-700 to-slate-950 p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-200">My calendar</div><h1 className="mt-2 text-3xl font-black">Every team commitment</h1><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-sky-100/80">Fixtures, approved training, friendlies and club events stay together and update automatically.</p></div>
        <button disabled={busy} type="button" onClick={() => onCreateFeed(null)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950"><ClipboardCopy size={17} /> Copy all-team calendar</button>
      </div>
      {assignments.length ? <div className="mt-5 flex gap-2 overflow-x-auto pb-1">{assignments.map((assignment) => <button key={assignment.id} disabled={busy} type="button" onClick={() => onCreateFeed(assignment)} className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/15"><ClipboardCopy size={14} className="mr-1 inline" /> {assignment.teamName}</button>)}</div> : null}
    </section>
    <div className="space-y-5">{[...grouped.entries()].map(([month, rows]) => <Panel key={month} className="overflow-hidden"><div className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm font-black">{month}</div><div className="divide-y divide-slate-100">{rows.map((row) => <div key={row.id} className="grid gap-3 p-4 sm:grid-cols-[90px_minmax(0,1fr)_auto] sm:items-center"><div><div className="text-lg font-black">{new Date(row.startAt).getDate()}</div><div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{new Date(row.startAt).toLocaleDateString("en-GB", { weekday: "short" })}</div></div><div><div className="text-sm font-black">{row.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{time(row.startAt)}–{time(row.endAt)} · {[row.venueName, row.pitchName].filter(Boolean).join(" · ") || "Venue TBC"}</div></div><Badge tone={statusTone(row.status)}>{row.bookingType}</Badge></div>)}</div></Panel>)}{!bookings.length ? <Empty icon={CalendarDays} title="No upcoming dates" body="Approved team bookings will appear here automatically." /> : null}</div>
  </>;
}

function RequestsTab({ requests, assignments, onRequest, onAlternative, onConversation, busy }) {
  return <>
    <section className="rounded-[30px] bg-gradient-to-br from-emerald-600 to-slate-950 p-6 text-white shadow-xl sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Booking requests</div><h1 className="mt-2 text-3xl font-black">Ask once. Track everything.</h1><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-emerald-100/80">Request training, friendlies, changes and cancellations, then keep the conversation attached to the request.</p></div><button type="button" onClick={() => onRequest(assignments[0])} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 text-sm font-black text-slate-950"><Plus size={18} /> New request</button></div></section>
    <div className="space-y-3">{requests.map((row) => <Panel key={row.id} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{row.title}</h3><Badge tone={statusTone(row.status)}>{requestStatusLabel(row.status)}</Badge></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-slate-500"><span>{row.teamName}</span><span>{formatDate(row.preferredStartAt)} · {time(row.preferredStartAt)}–{time(row.preferredEndAt)}</span><span>{row.preferredPitchName || "Pitch preference not set"}</span></div>{row.exceptionDates?.length ? <div className="mt-3 text-xs font-bold text-violet-700">{row.exceptionDates.length} recurrence exception date{row.exceptionDates.length === 1 ? "" : "s"}</div> : null}{row.coachNotes ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{row.coachNotes}</p> : null}{row.conflicts.length ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">{row.conflicts[0]?.message || "The club will resolve an availability warning before approval."}</div> : null}{row.status === "alternative_offered" ? <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="text-xs font-black uppercase tracking-wide text-sky-800">Club alternative</div><div className="mt-2 text-sm font-black text-sky-950">{formatDate(row.proposedStartAt)} · {time(row.proposedStartAt)}–{time(row.proposedEndAt)}</div><div className="mt-1 text-xs font-bold text-sky-700">{row.proposedPitchName || "Pitch TBC"}</div>{row.proposedMessage ? <p className="mt-3 text-xs font-semibold leading-5 text-sky-900">{row.proposedMessage}</p> : null}<div className="mt-4 flex gap-2"><button disabled={busy} type="button" onClick={() => onAlternative(row, "decline")} className="h-10 rounded-xl border border-sky-300 bg-white px-4 text-xs font-black text-sky-900">Decline</button><button disabled={busy} type="button" onClick={() => onAlternative(row, "accept")} className="h-10 rounded-xl bg-sky-700 px-4 text-xs font-black text-white">Accept alternative</button></div></div> : null}<button type="button" onClick={() => onConversation(row)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-xs font-black text-violet-800"><MessageSquareText size={15} /> Open conversation</button></div><div className="shrink-0 text-right text-[11px] font-bold text-slate-400">Sent {row.createdAt ? formatDate(row.createdAt, { day: "numeric", month: "short", year: "numeric" }) : "recently"}</div></div></Panel>)}{!requests.length ? <Empty icon={CalendarPlus} title="No requests yet" body="Request training or a friendly and its progress will stay visible here." /> : null}</div>
  </>;
}

function MessagesTab({ messages, onMark }) {
  return <><section className="rounded-[30px] bg-slate-950 p-6 text-white shadow-xl sm:p-8"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Team messages</div><h1 className="mt-2 text-3xl font-black">Club updates that do not get lost</h1><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">Booking decisions, venue changes and action requests remain in your Coach Hub history.</p></section><div className="space-y-3">{messages.map((row) => <Panel key={row.id} className={`p-5 ${!row.readAt ? "ring-2 ring-sky-200" : ""}`}><div className="flex items-start gap-4"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${row.requiresAcknowledgement && !row.acknowledgedAt ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}><Mail size={19} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black">{row.title}</h3>{!row.readAt ? <Badge tone="bg-sky-100 text-sky-800">New</Badge> : null}{row.acknowledgedAt ? <Badge tone="bg-emerald-100 text-emerald-800">Acknowledged</Badge> : null}</div><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{row.body}</p><div className="mt-3 text-[11px] font-bold text-slate-400">{row.createdAt ? formatDate(row.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</div>{row.requiresAcknowledgement && !row.acknowledgedAt ? <button type="button" onClick={() => onMark(row, true)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white"><Check size={15} /> Acknowledge</button> : !row.readAt ? <button type="button" onClick={() => onMark(row, false)} className="mt-4 text-xs font-black text-sky-700">Mark as read</button> : null}</div></div></Panel>)}{!messages.length ? <Empty icon={MessageSquareText} title="No messages" body="Booking decisions and club updates will appear here." /> : null}</div></>;
}

function TeamTab({ assignments, contacts }) {
  return <><section className="rounded-[30px] bg-gradient-to-br from-violet-700 to-slate-950 p-6 text-white shadow-xl sm:p-8"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">My teams</div><h1 className="mt-2 text-3xl font-black">The right people and details</h1><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-violet-100/80">Your access comes directly from the club’s team contact record, so communication lists stay current automatically.</p></section><div className="grid gap-5 lg:grid-cols-2">{assignments.map((assignment) => { const contact = contacts.find((row) => String(row.team_key || row.teamKey) === assignment.teamKey) || {}; return <Panel key={assignment.id} className="p-5"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Users size={21} /></span><div><h2 className="text-lg font-black">{assignment.teamName}</h2><div className="mt-0.5 text-xs font-bold capitalize text-slate-500">Your role: {assignment.staffRole}</div></div></div><div className="mt-5 space-y-3"><ContactRow label="Primary contact" name={contact.coach_name || contact.coachName} email={contact.coach_email || contact.coachEmail} phone={contact.coach_phone || contact.coachPhone} /><ContactRow label="Assistant" name={contact.assistant_name || contact.assistantName} email={contact.assistant_email || contact.assistantEmail} phone={contact.assistant_phone || contact.assistantPhone} /></div><div className="mt-5 flex flex-wrap gap-2"><Permission enabled={assignment.canRequestTraining}>Training requests</Permission><Permission enabled={assignment.canRequestFriendlies}>Friendly requests</Permission><Permission enabled={assignment.canRequestChanges}>Booking changes</Permission></div></Panel>; })}</div></>;
}

function ContactRow({ label, name, email, phone }) { if (!name && !email && !phone) return null; return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div><div className="mt-1 text-sm font-black">{name || "Contact"}</div>{email ? <a href={`mailto:${email}`} className="mt-1 block text-xs font-bold text-sky-700">{email}</a> : null}{phone ? <a href={`tel:${phone}`} className="mt-1 block text-xs font-bold text-slate-600">{phone}</a> : null}</div>; }
function Permission({ enabled, children }) { return <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"}`}>{children}</span>; }

function ProfileTab({ clubId, person, authSession, subscription, onSaved, onSignOut }) {
  const [form, setForm] = useState({ displayName: person.displayName, mobile: person.mobile, preferredChannel: person.preferredChannel || "email" });
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm({ displayName: person.displayName, mobile: person.mobile, preferredChannel: person.preferredChannel || "email" }), [person]);
  const save = async () => { setBusy(true); try { await DB.updateMyCoachHubProfile(clubId, { display_name: form.displayName, mobile: form.mobile, preferred_channel: form.preferredChannel }); await onSaved?.(); toast.success("Coach profile updated", { description: "The connected team contact and communications record has been refreshed." }); } catch (error) { toast.error("Profile could not be updated", { description: error?.message }); } finally { setBusy(false); } };
  const verify = async () => { setBusy(true); try { await DB.verifyMyCoachHubContact(clubId); await onSaved?.(); toast.success("Contact details verified", { description: "The club now knows this contact record is current." }); } catch (error) { toast.error("Contact verification failed", { description: error?.message }); } finally { setBusy(false); } };
  const verified = person.verificationStatus === "verified" || Boolean(person.lastVerifiedAt);
  return <><section className="rounded-[30px] bg-slate-950 p-6 text-white shadow-xl sm:p-8"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">My profile</div><h1 className="mt-2 text-3xl font-black">One contact record across Daxora</h1><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">Changes update Coach Hub and the club communications contact used for your teams.</p></section><Panel className="p-5 sm:p-6"><div className={`mb-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${verified ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div><div className={`text-sm font-black ${verified ? "text-emerald-950" : "text-amber-950"}`}>{verified ? "Contact details verified" : "Please confirm your contact details"}</div><div className={`mt-1 text-xs font-semibold ${verified ? "text-emerald-800" : "text-amber-800"}`}>{person.lastVerifiedAt ? `Last checked ${formatDate(person.lastVerifiedAt, { day: "numeric", month: "short", year: "numeric" })}` : "Verification keeps Communications and emergency contact lists reliable."}</div></div><button disabled={busy} type="button" onClick={verify} className="h-10 rounded-xl bg-white px-4 text-xs font-black shadow-sm">{verified ? "Verify again" : "Confirm details"}</button></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} className="input" /></Field><Field label="Mobile"><input value={form.mobile} onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))} className="input" /></Field><Field label="Sign-in email"><input readOnly value={person.email || authSession?.user?.email || ""} className="input bg-slate-50 text-slate-500" /><div className="mt-1 text-[11px] font-semibold text-slate-400">Account email changes require a new secure invitation.</div></Field><Field label="Preferred updates"><select value={form.preferredChannel} onChange={(event) => setForm((current) => ({ ...current, preferredChannel: event.target.value }))} className="input"><option value="email">Email</option><option value="in_app">Coach Hub only</option><option value="sms">SMS when enabled</option><option value="whatsapp">WhatsApp when enabled</option></select></Field></div><div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs font-semibold text-slate-500"><span className="font-black text-slate-800">{subscription?.planName || "Club plan"}</span> · Coach Hub included with Annual Planner</div><div className="flex gap-2"><button type="button" onClick={onSignOut} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700">Sign out</button><button disabled={busy} type="button" onClick={save} className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white">{busy ? "Saving…" : "Save profile"}</button></div></div></Panel></>;
}

function RequestDialog({ draft, setDraft, assignments, bookings, busy, onSubmit }) {
  const assignment = assignments.find((row) => row.id === draft.assignmentId) || assignments[0] || {};
  const options = requestTypeOptions(assignment);
  const isExistingBookingRequest = ["change", "cancellation"].includes(draft.requestType);
  const eligibleBookings = (Array.isArray(bookings) ? bookings : [])
    .filter((row) => row.teamKey === assignment.teamKey && !["cancelled", "rejected"].includes(row.status))
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const selectBooking = (bookingId) => {
    const booking = eligibleBookings.find((row) => row.id === bookingId);
    if (!booking) {
      set("targetBookingId", "");
      return;
    }
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
      recurrenceUntil: booking.startDate || current.recurrenceUntil,
    }));
  };

  const changeRequestType = (requestType) => {
    setDraft((current) => ({
      ...current,
      requestType,
      targetBookingId: ["change", "cancellation"].includes(requestType) ? current.targetBookingId : "",
      title: assignment.teamName ? `${assignment.teamName} ${requestType}` : `${requestType} request`,
      recurrence: requestType === "cancellation" ? "none" : current.recurrence,
    }));
  };

  const submit = async () => {
    if (!draft.assignmentId || !draft.date || !draft.startTime || !draft.endTime) {
      toast.error("Complete the team, date and time fields");
      return;
    }
    if (isExistingBookingRequest && !draft.targetBookingId) {
      toast.error("Choose the booking you want to change or cancel");
      return;
    }
    if (draft.endTime <= draft.startTime) {
      toast.error("Finish time must be after the start time");
      return;
    }
    try {
      await onSubmit(draft);
    } catch {
      // The submit handler presents the grounded error and keeps the dialog open.
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}>
      <section className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Coach request</div>
            <h2 className="mt-1 text-xl font-black">Request a team booking</h2>
          </div>
          <button type="button" onClick={() => setDraft(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200" aria-label="Close request"><X size={18} /></button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Team">
            <select
              value={draft.assignmentId}
              onChange={(event) => {
                const next = assignments.find((row) => row.id === event.target.value);
                setDraft((current) => ({
                  ...current,
                  assignmentId: event.target.value,
                  targetBookingId: "",
                  title: next?.teamName ? `${next.teamName} ${current.requestType}` : current.title,
                }));
              }}
              className="input"
            >
              {assignments.map((row) => <option key={row.id} value={row.id}>{row.teamName} · {row.staffRole}</option>)}
            </select>
          </Field>
          <Field label="Request type">
            <select value={draft.requestType} onChange={(event) => changeRequestType(event.target.value)} className="input">
              {options.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </select>
          </Field>

          {isExistingBookingRequest ? (
            <Field label={draft.requestType === "cancellation" ? "Booking to cancel" : "Booking to change"} wide>
              <select value={draft.targetBookingId || ""} onChange={(event) => selectBooking(event.target.value)} className="input">
                <option value="">Choose an active team booking…</option>
                {eligibleBookings.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {formatDate(booking.startAt, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {booking.startTime} · {booking.pitchName || booking.venueName || booking.title}
                  </option>
                ))}
              </select>
              {!eligibleBookings.length ? <div className="mt-2 text-xs font-semibold text-amber-700">There are no active Annual Planner bookings for this team.</div> : null}
            </Field>
          ) : null}

          <Field label="Title" wide><input value={draft.title} onChange={(event) => set("title", event.target.value)} className="input" /></Field>
          {draft.requestType === "friendly" ? <><Field label="Opponent"><input value={draft.opponentName} onChange={(event) => set("opponentName", event.target.value)} className="input" /></Field><Field label="Format"><input value={draft.format} onChange={(event) => set("format", event.target.value)} placeholder="11v11, 9v9…" className="input" /></Field></> : null}

          <Field label={draft.requestType === "change" ? "Requested date" : "Date"}><input type="date" value={draft.date} onChange={(event) => set("date", event.target.value)} className="input" /></Field>
          <Field label="Starts"><input type="time" step="900" value={draft.startTime} onChange={(event) => set("startTime", event.target.value)} className="input" /></Field>
          <Field label="Finishes"><input type="time" step="900" value={draft.endTime} onChange={(event) => set("endTime", event.target.value)} className="input" /></Field>
          <Field label="Preferred pitch"><input value={draft.pitchName} onChange={(event) => set("pitchName", event.target.value)} placeholder="Pitch or venue preference" className="input" /></Field>

          {!isExistingBookingRequest ? (
            <>
              <Field label="Repeats"><select value={draft.recurrence} onChange={(event) => set("recurrence", event.target.value)} className="input"><option value="none">One-off</option><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option></select></Field>
              {draft.recurrence !== "none" ? <>
                <Field label="Repeat until"><input type="date" min={draft.date} value={draft.recurrenceUntil} onChange={(event) => set("recurrenceUntil", event.target.value)} className="input" /></Field>
                <Field label="School holidays"><select value={draft.holidayPolicy || "include"} onChange={(event) => set("holidayPolicy", event.target.value)} className="input"><option value="include">Keep every scheduled date</option><option value="exclude">Exclude school-holiday dates supplied below</option><option value="custom">Use a custom exception list</option></select></Field>
                <Field label="Dates to skip" wide><textarea rows="3" value={draft.exceptionDatesText || ""} onChange={(event) => set("exceptionDatesText", event.target.value)} className="input min-h-[88px] py-3" placeholder="2026-10-26, 2026-11-02 — comma, space or new line separated" /><div className="mt-2 text-[11px] font-semibold leading-5 text-slate-500">Skipped dates are checked before the request is submitted and are carried into the approved booking series.</div></Field>
              </> : null}
            </>
          ) : null}

          <Field label="Estimated attendance"><input type="number" min="0" value={draft.estimatedAttendance} onChange={(event) => set("estimatedAttendance", event.target.value)} className="input" /></Field>
          {draft.requestType === "friendly" ? <div className="flex flex-wrap items-center gap-4 sm:col-span-2"><label className="inline-flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={draft.refereeRequired} onChange={(event) => set("refereeRequired", event.target.checked)} /> Referee required</label><label className="inline-flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={draft.changingRoomsRequired} onChange={(event) => set("changingRoomsRequired", event.target.checked)} /> Changing rooms required</label></div> : null}
          <Field label="Notes for the club" wide><textarea rows="4" value={draft.notes} onChange={(event) => set("notes", event.target.value)} className="input min-h-[110px] py-3" placeholder="Alternative dates, opponent contact, access needs or anything the scheduler should know." /></Field>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 p-5 backdrop-blur sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setDraft(null)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black">Cancel</button>
          <button disabled={busy || (isExistingBookingRequest && !eligibleBookings.length)} type="button" onClick={submit} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Send size={16} /> {busy ? "Sending…" : "Send request"}</button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children, wide = false }) { return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>{children}</label>; }
function CoachHubLoading() { return <div className="space-y-4"><div className="h-52 animate-pulse rounded-[30px] bg-slate-200" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}</div><div className="h-72 animate-pulse rounded-[26px] bg-slate-200" /></div>; }
