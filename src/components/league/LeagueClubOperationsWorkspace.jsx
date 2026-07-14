import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileDiff,
  FileSpreadsheet,
  History,
  Mail,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import { useDaxoraConfirm, useDaxoraPrompt } from "../../contexts/DaxoraInteractionContext.jsx";
import {
  buildFullTimeFixtureCsv,
  compareLeaguePublications,
  normaliseLeagueClubOperationsData,
  publicationStatusLabel,
  reconcileFullTimeFixtureCsv,
} from "../../lib/league/leagueClubOperations.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500";

const VIEWS = [
  ["publication", "Publication", Send],
  ["access", "Club access", Users],
  ["requests", "Change requests", FileDiff],
  ["communications", "Communications", Mail],
  ["calendars", "Calendar feeds", CalendarPlus],
  ["fulltime", "Full-Time fixtures", FileSpreadsheet],
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

function Field({ label, children, className = "" }) {
  return <label className={className}><span className={LABEL}>{label}</span>{children}</label>;
}

function dateLabel(value) {
  if (!value) return "Not dated";
  try { return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(value); }
}

function downloadText(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function publicationTone(status) {
  if (status === "published") return "green";
  if (status === "withdrawn") return "rose";
  if (status === "superseded") return "slate";
  return "amber";
}

function requestTone(status) {
  if (status === "approved") return "green";
  if (status === "rejected") return "rose";
  if (status === "under_review") return "blue";
  return "amber";
}

export default function LeagueClubOperationsWorkspace({ leagueId, workspace, canManage, canOperate, operations = {}, initialView = "publication", focusToken = 0 }) {
  const daxoraConfirm = useDaxoraConfirm();
  const daxoraPrompt = useDaxoraPrompt();
  const [view, setView] = useState(initialView);
  const [data, setData] = useState(() => normaliseLeagueClubOperationsData({}));
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [publishForm, setPublishForm] = useState({ scopeType: "league", scopeId: "", title: "", notes: "" });
  const [inviteForm, setInviteForm] = useState({ parentClubId: "", email: "", role: "club_secretary" });
  const [lastInviteLink, setLastInviteLink] = useState("");
  const [communication, setCommunication] = useState({ recipientType: "all_clubs", recipientId: "", subject: "", body: "", requiresAcknowledgement: false, status: "draft" });
  const [calendarForm, setCalendarForm] = useState({ scopeType: "league", scopeId: "", label: "" });
  const [lastCalendarUrl, setLastCalendarUrl] = useState("");
  const [reconciliation, setReconciliation] = useState(null);
  const fullTimeInputRef = useRef(null);

  const load = useCallback(async () => {
    if (!leagueId) return;
    setLoading(true);
    try {
      const [operationsPayload, versionRows] = await Promise.all([
        DB.getLeagueClubOperationsData(leagueId),
        DB.listLeagueScheduleVersions(leagueId),
      ]);
      const next = normaliseLeagueClubOperationsData(operationsPayload);
      const nextVersions = (Array.isArray(versionRows) ? versionRows : []).map((row) => ({
        ...row,
        id: row.id || "",
        name: row.name || `Version ${row.version_number || row.versionNumber || ""}`,
        status: row.status || "draft",
        versionNumber: Number(row.version_number ?? row.versionNumber ?? 0),
      }));
      setData(next);
      setVersions(nextVersions);
      const preferred = nextVersions.find((row) => row.status === "published") || nextVersions[0];
      setSelectedVersionId((current) => nextVersions.some((row) => row.id === current) ? current : (preferred?.id || ""));
    } catch (error) {
      toast.error("Club operations could not be loaded", { description: error?.message });
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { if (VIEWS.some(([key]) => key === initialView)) setView(initialView); }, [initialView, focusToken]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedVersionId) { setSelectedVersion(null); return undefined; }
    DB.getLeagueScheduleVersion(leagueId, selectedVersionId)
      .then((payload) => { if (!cancelled) setSelectedVersion(payload); })
      .catch((error) => { if (!cancelled) toast.error("Schedule preview could not be loaded", { description: error?.message }); });
    return () => { cancelled = true; };
  }, [leagueId, selectedVersionId]);

  const activePublications = useMemo(() => data.publications.filter((row) => row.status === "published"), [data.publications]);
  const currentPublication = useMemo(() => {
    const exact = activePublications.find((row) => row.scopeType === publishForm.scopeType && (publishForm.scopeType === "league" || row.scopeId === publishForm.scopeId));
    return exact || null;
  }, [activePublications, publishForm.scopeId, publishForm.scopeType]);
  const previousRows = useMemo(() => currentPublication ? data.publicationFixtures.filter((row) => row.publicationId === currentPublication.id) : [], [currentPublication, data.publicationFixtures]);
  const previewRows = useMemo(() => {
    const leagueEntries = (Array.isArray(selectedVersion?.entries) ? selectedVersion.entries : [])
      .map((row) => ({
        targetType: "schedule_entry",
        targetId: row.id,
        snapshot: {
          ...row,
          scheduled_date: row.scheduled_date || row.scheduledDate,
          kick_off: row.kick_off || row.kickOff,
          venue_id: row.venue_id || row.venueId,
          home_team_id: row.home_team_id || row.homeTeamId,
          away_team_id: row.away_team_id || row.awayTeamId,
          division_id: row.division_id || row.divisionId,
          competition_type: "league",
          competition_id: row.division_id || row.divisionId,
        },
      }))
      .filter((row) => row.snapshot.scheduled_date)
      .filter(() => publishForm.scopeType !== "cup")
      .filter((row) => publishForm.scopeType !== "division" || row.snapshot.division_id === publishForm.scopeId);

    const cupEntries = (Array.isArray(workspace.cupTies) ? workspace.cupTies : [])
      .filter((row) => row.scheduledDate && !["cancelled", "void", "bye"].includes(row.status))
      .filter(() => publishForm.scopeType !== "division")
      .filter((row) => publishForm.scopeType !== "cup" || row.cupId === publishForm.scopeId)
      .map((row) => ({
        targetType: "cup_tie",
        targetId: row.id,
        snapshot: {
          ...row,
          scheduled_date: row.scheduledDate,
          kick_off: row.kickOff,
          venue_id: row.venueId,
          home_team_id: row.homeTeamId,
          away_team_id: row.awayTeamId,
          competition_type: "cup",
          competition_id: row.cupId,
        },
      }));

    return [...leagueEntries, ...cupEntries];
  }, [publishForm.scopeId, publishForm.scopeType, selectedVersion, workspace.cupTies]);
  const diff = useMemo(() => compareLeaguePublications(previewRows, previousRows), [previewRows, previousRows]);

  const publish = async () => {
    if (!selectedVersionId) return;
    if (publishForm.scopeType !== "league" && !publishForm.scopeId) { toast.error("Select the division or cup to publish"); return; }
    setBusy(true);
    try {
      const result = await DB.publishLeagueFixtureRelease(leagueId, {
        scheduleVersionId: selectedVersionId,
        scopeType: publishForm.scopeType,
        scopeId: publishForm.scopeId || null,
        title: publishForm.title,
        notes: publishForm.notes,
      });
      await load();
      toast.success("Fixture release published", { description: `${result?.fixtures || 0} fixtures are now available to ${result?.clubs || 0} clubs.` });
    } catch (error) {
      toast.error("Fixture release could not be published", { description: error?.message });
    } finally { setBusy(false); }
  };

  const createInvite = async () => {
    if (!inviteForm.parentClubId || !inviteForm.email.includes("@")) return;
    setBusy(true);
    try {
      const result = await DB.createLeagueClubInvitation(leagueId, inviteForm);
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set("league_club_invite", result.token);
      setLastInviteLink(url.toString());
      setInviteForm((current) => ({ ...current, email: "" }));
      await load();
      toast.success("Club portal invitation created");
    } catch (error) { toast.error("Club invitation could not be created", { description: error?.message }); }
    finally { setBusy(false); }
  };

  const saveCommunication = async (status = communication.status) => {
    const club = workspace.clubs.find((row) => row.id === communication.recipientId);
    if (!communication.subject.trim() || !communication.body.trim()) { toast.error("Add a subject and message"); return; }
    setBusy(true);
    try {
      await DB.saveLeagueCommunication(leagueId, {
        ...communication,
        status,
        recipientLabel: communication.recipientType === "all_clubs" ? "All clubs" : (club?.name || "Club recipient"),
      });
      setCommunication({ recipientType: "all_clubs", recipientId: "", subject: "", body: "", requiresAcknowledgement: false, status: "draft" });
      await load();
      toast.success(status === "sent" ? "Communication marked as sent" : "Communication saved");
    } catch (error) { toast.error("Communication could not be saved", { description: error?.message }); }
    finally { setBusy(false); }
  };

  const createCalendar = async () => {
    if (calendarForm.scopeType !== "league" && !calendarForm.scopeId) { toast.error("Select the calendar scope"); return; }
    setBusy(true);
    try {
      const result = await DB.createLeagueCalendarFeed(leagueId, calendarForm);
      const url = `${window.location.origin}/api/league/calendar?token=${encodeURIComponent(result.token)}`;
      setLastCalendarUrl(url);
      await load();
      toast.success("Calendar subscription created");
    } catch (error) { toast.error("Calendar feed could not be created", { description: error?.message }); }
    finally { setBusy(false); }
  };

  const publicationRows = useMemo(() => {
    const published = new Map(data.publications
      .filter((row) => row.status === "published")
      .map((row) => [row.id, row]));
    const selected = new Map();
    data.publicationFixtures
      .filter((row) => published.has(row.publicationId))
      .sort((left, right) => {
        const leftDate = published.get(left.publicationId)?.publishedAt || "";
        const rightDate = published.get(right.publicationId)?.publishedAt || "";
        return rightDate.localeCompare(leftDate);
      })
      .forEach((row) => {
        const key = `${row.targetType}:${row.targetId}`;
        if (!selected.has(key)) selected.set(key, row);
      });
    return [...selected.values()];
  }, [data.publicationFixtures, data.publications]);

  const handleFullTimeFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const result = reconcileFullTimeFixtureCsv(text, publicationRows, workspace);
    setReconciliation(result);
    if (result.errors.length) toast.error("Full-Time file could not be compared", { description: result.errors[0] });
    else toast.success("Full-Time comparison completed");
    if (fullTimeInputRef.current) fullTimeInputRef.current.value = "";
  };

  if (loading) return <Panel className="p-8 text-center"><RefreshCw className="mx-auto animate-spin text-emerald-600" /><div className="mt-3 text-sm font-black text-slate-800">Loading club operations…</div></Panel>;

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <div className="grid gap-5 bg-slate-950 px-6 py-6 text-white lg:grid-cols-[1fr_auto] lg:items-center">
          <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">League Operations v3.3</div><h2 className="mt-2 text-2xl font-black">Club portal, publication and communications</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Release validated fixtures deliberately, collect club responses, control change requests and keep Full-Time aligned with the official programme.</p></div>
          <button type="button" onClick={load} className={`${BUTTON} border border-white/15 bg-white/10 text-white`}><RefreshCw size={15} /> Refresh</button>
        </div>
      </Panel>

      <nav className="grid grid-cols-2 gap-2 rounded-[22px] border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-3 xl:grid-cols-6">
        {VIEWS.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setView(key)} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-xs font-black ${view === key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={15} className={view === key ? "text-emerald-300" : "text-slate-400"} />{label}</button>)}
      </nav>

      {view === "publication" ? <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel className="p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Send size={20} /></span><div><h3 className="text-xl font-black text-slate-950">Publish fixture release</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Schedule publication and club release are separate controls. Only a validated, published schedule version can be released.</p></div></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Published schedule version"><select className={INPUT} value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}><option value="">Select version</option>{versions.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.status}</option>)}</select></Field>
            <Field label="Release scope"><select className={INPUT} value={publishForm.scopeType} onChange={(event) => setPublishForm((current) => ({ ...current, scopeType: event.target.value, scopeId: "" }))}><option value="league">Whole league</option><option value="division">One division</option><option value="cup">One cup</option></select></Field>
            {publishForm.scopeType === "division" ? <Field label="Division"><select className={INPUT} value={publishForm.scopeId} onChange={(event) => setPublishForm((current) => ({ ...current, scopeId: event.target.value }))}><option value="">Select division</option>{workspace.divisions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field> : null}
            {publishForm.scopeType === "cup" ? <Field label="Cup"><select className={INPUT} value={publishForm.scopeId} onChange={(event) => setPublishForm((current) => ({ ...current, scopeId: event.target.value }))}><option value="">Select cup</option>{workspace.cups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field> : null}
            <Field label="Release title" className={publishForm.scopeType === "league" ? "sm:col-span-2" : ""}><input className={INPUT} value={publishForm.title} onChange={(event) => setPublishForm((current) => ({ ...current, title: event.target.value }))} placeholder="2026/27 fixture programme" /></Field>
            <Field label="Release notes" className="sm:col-span-2"><textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={publishForm.notes} onChange={(event) => setPublishForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Message shown in the audit trail and club release." /></Field>
          </div>
          <button type="button" disabled={!canOperate || busy || !selectedVersionId || versions.find((row) => row.id === selectedVersionId)?.status !== "published"} onClick={publish} className={`${BUTTON} mt-5 bg-emerald-600 text-white`}><ShieldCheck size={15} /> Publish to clubs</button>
          {selectedVersionId && versions.find((row) => row.id === selectedVersionId)?.status !== "published" ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-900">This version is still a draft. Validate and publish it in Schedule Builder before releasing it to clubs.</div> : null}
        </Panel>
        <Panel className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Release preview</div><h3 className="mt-1 text-lg font-black text-slate-950">Changes since the active release</h3></div><Badge tone={currentPublication ? "blue" : "slate"}>{currentPublication ? "Compared" : "First release"}</Badge></div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Added', diff.counts.added, 'green'], ['Changed', diff.counts.changed, 'amber'], ['Removed', diff.counts.removed, 'rose'], ['Unchanged', diff.counts.unchanged, 'slate']].map(([label, value, tone]) => <div key={label} className="rounded-2xl border border-slate-200 p-4"><Badge tone={tone}>{label}</Badge><div className="mt-3 text-2xl font-black text-slate-950">{value}</div></div>)}
          </div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600"><strong className="text-slate-950">{previewRows.length} fixtures</strong> are in the selected release scope. Publishing creates one acknowledgement task per affected club and prepares communication drafts without silently sending anything.</div>
        </Panel>
        <Panel className="p-5 sm:p-6 xl:col-span-2">
          <div className="flex items-center gap-3"><History size={20} className="text-slate-500" /><div><h3 className="text-lg font-black text-slate-950">Publication history</h3><p className="text-sm font-semibold text-slate-500">Restore a previous release or withdraw the active one without deleting evidence.</p></div></div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">{data.publications.length ? data.publications.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.scopeType}{row.publishedAt ? ` · ${new Date(row.publishedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}` : ""}</div></div><Badge tone={publicationTone(row.status)}>{publicationStatusLabel(row.status)}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><span className="text-xs font-bold text-slate-500">{Number(row.summary?.fixtures || 0)} fixtures · {Number(row.summary?.clubs || 0)} clubs</span><div className="ml-auto flex gap-2">{row.status === "published" ? <button type="button" disabled={!canOperate || busy} onClick={async () => { if (!(await daxoraConfirm({ title: "Withdraw club publication?", description: "Clubs will lose access to this release. The underlying league schedule will remain published.", confirmLabel: "Withdraw publication", tone: "danger" }))) return; setBusy(true); try { await DB.withdrawLeaguePublication(leagueId, row.id, "Withdrawn by league operator"); await load(); toast.success("Publication withdrawn"); } catch (error) { toast.error("Publication could not be withdrawn", { description: error?.message }); } finally { setBusy(false); } }} className="text-xs font-black text-rose-700">Withdraw</button> : null}{row.status !== "published" && row.scheduleVersionId ? <button type="button" disabled={!canOperate || busy} onClick={async () => { if (!(await daxoraConfirm({ title: "Restore previous publication?", description: "This schedule will become the active programme shown to clubs.", confirmLabel: "Restore and publish", tone: "warning" }))) return; setBusy(true); try { await DB.restoreLeaguePublication(leagueId, row.id); await load(); toast.success("Previous publication restored"); } catch (error) { toast.error("Publication could not be restored", { description: error?.message }); } finally { setBusy(false); } }} className="inline-flex items-center gap-1 text-xs font-black text-sky-700"><RotateCcw size={13} /> Restore</button> : null}</div></div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500 lg:col-span-2">No club fixture releases have been published yet.</div>}</div>
        </Panel>
      </div> : null}

      {view === "access" ? <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5 sm:p-6"><div className="flex items-center gap-3"><UserPlus className="text-emerald-600" /><div><h3 className="text-xl font-black text-slate-950">Invite a club user</h3><p className="text-sm font-semibold text-slate-500">Club users see only their own teams, venues, publications and requests.</p></div></div><div className="mt-5 space-y-4"><Field label="Parent club"><select className={INPUT} value={inviteForm.parentClubId} onChange={(event) => setInviteForm((current) => ({ ...current, parentClubId: event.target.value }))}><option value="">Select club</option>{workspace.clubs.filter((row) => row.status !== "withdrawn").map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Email"><input type="email" className={INPUT} value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="secretary@club.org" /></Field><Field label="Role"><select className={INPUT} value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}><option value="club_secretary">Club secretary</option><option value="team_contact">Team contact</option><option value="club_viewer">Read-only viewer</option></select></Field><button type="button" disabled={!canManage || busy || !inviteForm.parentClubId || !inviteForm.email.includes("@")} onClick={createInvite} className={`${BUTTON} bg-emerald-600 text-white`}><UserPlus size={15} /> Create invitation</button></div>{lastInviteLink ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-black text-emerald-900">Secure club portal link</div><div className="mt-2 flex gap-2"><input readOnly className={INPUT} value={lastInviteLink} /><button type="button" onClick={async () => { await navigator.clipboard.writeText(lastInviteLink); toast.success("Invitation copied"); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><ClipboardCopy size={15} /></button></div></div> : null}</Panel>
        <Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Club portal access</h3><div className="mt-5 space-y-3">{data.clubMemberships.length ? data.clubMemberships.map((row) => <div key={`${row.parentClubId}:${row.user_id || row.userId}`} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-black text-slate-950">{row.displayName || row.email || "Club user"}</div><div className="mt-1 text-xs font-semibold text-slate-500">{workspace.clubs.find((club) => club.id === row.parentClubId)?.name || "Club"} · {row.role.replaceAll("_", " ")}</div></div>{canManage ? <button type="button" disabled={busy} onClick={async () => { if (!(await daxoraConfirm({ title: "Remove club portal user?", description: "This person will immediately lose access to the club portal.", confirmLabel: "Remove access", tone: "danger" }))) return; setBusy(true); try { await DB.removeLeagueClubMember(leagueId, row.parentClubId, row.user_id || row.userId); await load(); toast.success("Club user removed"); } catch (error) { toast.error("Club user could not be removed", { description: error?.message }); } finally { setBusy(false); } }} className="text-xs font-black text-rose-700">Remove</button> : null}</div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">No active club portal users.</div>}</div>{data.clubInvitations.length ? <div className="mt-6 border-t border-slate-200 pt-5"><div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Invitation history</div><div className="mt-3 space-y-2">{data.clubInvitations.slice(0, 12).map((row) => <div key={row.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-xs"><div><div className="font-black text-slate-900">{row.email}</div><div className="mt-1 font-semibold text-slate-500">{workspace.clubs.find((club) => club.id === row.parentClubId)?.name || "Club"} · {row.status}</div></div>{row.status === "pending" && canManage ? <button type="button" onClick={async () => { setBusy(true); try { await DB.revokeLeagueClubInvitation(leagueId, row.id); await load(); toast.success("Invitation revoked"); } catch (error) { toast.error("Invitation could not be revoked", { description: error?.message }); } finally { setBusy(false); } }} className="font-black text-rose-700">Revoke</button> : null}</div>)}</div></div> : null}</Panel>
      </div> : null}

      {view === "requests" ? <Panel className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xl font-black text-slate-950">Fixture-change command queue</h3><p className="mt-1 text-sm font-semibold text-slate-500">Approved league-fixture changes create a new draft schedule version for validation and publication.</p></div><Badge tone="amber">{data.changeRequests.filter((row) => ["submitted", "under_review"].includes(row.status)).length} open</Badge></div><div className="mt-5 space-y-3">{data.changeRequests.length ? data.changeRequests.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><div className="text-sm font-black text-slate-950">{row.requestType.replaceAll("_", " ")}</div><Badge tone={requestTone(row.status)}>{row.status.replaceAll("_", " ")}</Badge></div><div className="mt-2 text-xs font-semibold text-slate-500">{workspace.clubs.find((club) => club.id === row.parentClubId)?.name || "Club"} · submitted {row.createdAt ? new Date(row.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : ""}</div><p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{row.reason}</p><div className="mt-2 text-xs font-bold text-slate-500">Requested: {row.requestedDate || "date unchanged"}{row.requestedKickOff ? ` at ${String(row.requestedKickOff).slice(0, 5)}` : ""}{row.requestedVenueId ? ` · ${workspace.venues.find((venue) => venue.id === row.requestedVenueId)?.name || "new venue"}` : ""}</div>{row.league_response || row.leagueResponse ? <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">League response: {row.league_response || row.leagueResponse}</div> : null}</div>{["submitted", "under_review"].includes(row.status) && canOperate ? <div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await DB.resolveLeagueFixtureChangeRequest(leagueId, row.id, "under_review", "Under review by the league"); await load(); toast.success("Request marked under review"); } catch (error) { toast.error("Request could not be updated", { description: error?.message }); } finally { setBusy(false); } }} className={`${BUTTON} border border-sky-200 bg-sky-50 text-sky-700`}>Review</button>{row.requestType !== "team_withdrawal" ? <button type="button" disabled={busy} onClick={async () => { const notes = await daxoraPrompt({ title: "Approve fixture-change request", description: "Add the response the club will see. The resulting draft schedule will still require validation.", label: "Approval note", defaultValue: "Approved subject to schedule validation", confirmLabel: "Approve request", required: false, multiline: true }); if (notes === null) return; setBusy(true); try { const result = await DB.resolveLeagueFixtureChangeRequest(leagueId, row.id, "approved", notes); await load(); toast.success("Request approved", { description: result?.resolution_version_id ? "A new draft schedule version has been created." : "The cup fixture has been updated." }); } catch (error) { toast.error("Request could not be approved", { description: error?.message }); } finally { setBusy(false); } }} className={`${BUTTON} bg-emerald-600 text-white`}><CheckCircle2 size={14} /> Approve</button> : <Badge tone="amber">Dedicated withdrawal review</Badge>}<button type="button" disabled={busy} onClick={async () => { const notes = await daxoraPrompt({ title: "Reject fixture-change request", description: "Explain why the request cannot be approved.", label: "Rejection reason", confirmLabel: "Reject request", required: true, minLength: 3, multiline: true }); if (notes === null || !notes.trim()) return; setBusy(true); try { await DB.resolveLeagueFixtureChangeRequest(leagueId, row.id, "rejected", notes); await load(); toast.success("Request rejected"); } catch (error) { toast.error("Request could not be rejected", { description: error?.message }); } finally { setBusy(false); } }} className={`${BUTTON} border border-rose-200 bg-rose-50 text-rose-700`}><XCircle size={14} /> Reject</button></div> : null}</div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">No fixture-change requests.</div>}</div></Panel> : null}

      {view === "communications" ? <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"><Panel className="p-5 sm:p-6"><div className="flex items-center gap-3"><MessageSquareText className="text-emerald-600" /><div><h3 className="text-xl font-black text-slate-950">Compose league communication</h3><p className="text-sm font-semibold text-slate-500">Draft, queue or record messages without pretending that an email provider sent them.</p></div></div><div className="mt-5 space-y-4"><Field label="Audience"><select className={INPUT} value={communication.recipientType} onChange={(event) => setCommunication((current) => ({ ...current, recipientType: event.target.value, recipientId: "" }))}><option value="all_clubs">All clubs</option><option value="club">One club</option></select></Field>{communication.recipientType === "club" ? <Field label="Club"><select className={INPUT} value={communication.recipientId} onChange={(event) => setCommunication((current) => ({ ...current, recipientId: event.target.value }))}><option value="">Select club</option>{workspace.clubs.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field> : null}<Field label="Subject"><input className={INPUT} value={communication.subject} onChange={(event) => setCommunication((current) => ({ ...current, subject: event.target.value }))} /></Field><Field label="Message"><textarea className="min-h-40 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={communication.body} onChange={(event) => setCommunication((current) => ({ ...current, body: event.target.value }))} /></Field><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={communication.requiresAcknowledgement} onChange={(event) => setCommunication((current) => ({ ...current, requiresAcknowledgement: event.target.checked }))} /> Require acknowledgement</label><div className="flex flex-wrap gap-2"><button type="button" disabled={!canOperate || busy} onClick={() => saveCommunication("draft")} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}>Save draft</button><button type="button" disabled={!canOperate || busy || (communication.recipientType === "club" && !communication.recipientId)} onClick={() => saveCommunication("queued")} className={`${BUTTON} bg-emerald-600 text-white`}><Send size={14} /> Queue for delivery</button><button type="button" disabled={!canOperate || busy} onClick={() => saveCommunication("sent")} className={`${BUTTON} bg-slate-950 text-white`}>Record as sent</button></div></div></Panel><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Communication register</h3><div className="mt-5 space-y-3">{data.communications.length ? data.communications.slice(0, 30).map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.subject}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.recipientLabel} · {row.channel}</div></div><Badge tone={row.status === "sent" ? "green" : row.status === "failed" ? "rose" : row.status === "queued" ? "blue" : "slate"}>{row.status}</Badge></div><p className="mt-3 line-clamp-3 text-xs font-semibold leading-5 text-slate-600">{row.body}</p></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">No communications recorded.</div>}</div></Panel></div> : null}

      {view === "calendars" ? <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Create calendar subscription</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Create a private ICS feed for the league, a division, club, team, venue, cup or official.</p><div className="mt-5 space-y-4"><Field label="Calendar type"><select className={INPUT} value={calendarForm.scopeType} onChange={(event) => setCalendarForm((current) => ({ ...current, scopeType: event.target.value, scopeId: "" }))}>{["league", "division", "club", "team", "venue", "cup", "official"].map((scope) => <option key={scope} value={scope}>{scope.replaceAll("_", " ")}</option>)}</select></Field>{calendarForm.scopeType !== "league" ? <Field label="Record"><select className={INPUT} value={calendarForm.scopeId} onChange={(event) => setCalendarForm((current) => ({ ...current, scopeId: event.target.value }))}><option value="">Select</option>{(calendarForm.scopeType === "division" ? workspace.divisions : calendarForm.scopeType === "club" ? workspace.clubs : calendarForm.scopeType === "team" ? workspace.teams : calendarForm.scopeType === "venue" ? workspace.venues : calendarForm.scopeType === "cup" ? workspace.cups : calendarForm.scopeType === "official" ? (operations.officials || []) : []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field> : null}<Field label="Feed label"><input className={INPUT} value={calendarForm.label} onChange={(event) => setCalendarForm((current) => ({ ...current, label: event.target.value }))} placeholder="Premier Division calendar" /></Field><button type="button" disabled={!canOperate || busy || (calendarForm.scopeType !== "league" && !calendarForm.scopeId)} onClick={createCalendar} className={`${BUTTON} bg-emerald-600 text-white`}><CalendarPlus size={15} /> Create subscription</button></div>{lastCalendarUrl ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-black text-emerald-900">Private calendar URL</div><div className="mt-2 flex gap-2"><input readOnly className={INPUT} value={lastCalendarUrl} /><button type="button" onClick={async () => { await navigator.clipboard.writeText(lastCalendarUrl); toast.success("Calendar URL copied"); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><ClipboardCopy size={15} /></button></div><p className="mt-2 text-[11px] font-semibold leading-5 text-emerald-800">Treat this URL like a password. Anyone with it can view the feed.</p></div> : null}</Panel><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Calendar register</h3><div className="mt-5 space-y-3">{data.calendarFeeds.length ? data.calendarFeeds.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"><div><div className="text-sm font-black text-slate-950">{row.feedLabel || `${row.feedType} calendar`}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.feedType} · created {row.createdAt ? dateLabel(row.createdAt) : ""}</div></div><button type="button" disabled={!canManage || busy || row.revoked_at || row.revokedAt} onClick={async () => { if (!(await daxoraConfirm({ title: "Revoke calendar subscription?", description: "The private calendar URL will stop updating for every existing subscriber.", confirmLabel: "Revoke calendar", tone: "danger" }))) return; setBusy(true); try { await DB.revokeLeagueCalendarFeed(leagueId, row.id); await load(); toast.success("Calendar feed revoked"); } catch (error) { toast.error("Calendar feed could not be revoked", { description: error?.message }); } finally { setBusy(false); } }} className="text-xs font-black text-rose-700">Revoke</button></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">No calendar subscriptions created.</div>}</div></Panel></div> : null}

      {view === "fulltime" ? <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"><Panel className="p-5 sm:p-6"><div className="flex items-center gap-3"><FileSpreadsheet className="text-emerald-600" /><div><h3 className="text-xl font-black text-slate-950">Full-Time export and reconciliation</h3><p className="text-sm font-semibold text-slate-500">Keep the published Daxora programme and the league's Full-Time file aligned.</p></div></div><div className="mt-5 space-y-3"><button type="button" disabled={!publicationRows.length} onClick={() => downloadText("daxora-full-time-fixture-export.csv", buildFullTimeFixtureCsv(publicationRows, workspace))} className={`${BUTTON} bg-slate-950 text-white`}><Download size={15} /> Export published fixtures</button><button type="button" onClick={() => fullTimeInputRef.current?.click()} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}><FileDiff size={15} /> Compare Full-Time CSV</button><input ref={fullTimeInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => handleFullTimeFile(event.target.files?.[0])} /></div><div className="mt-5 rounded-2xl bg-sky-50 p-4 text-xs font-semibold leading-5 text-sky-900">The first integration remains controlled CSV import/export. It does not claim a live Full-Time API connection that has not been agreed or documented.</div></Panel><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Reconciliation result</h3>{reconciliation ? <div className="mt-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Matched", reconciliation.matched.length, "green"], ["Differences", reconciliation.differences.length, "amber"], ["Missing", reconciliation.missing.length, "rose"], ["Extra", reconciliation.extras.length, "blue"]].map(([label, value, tone]) => <div key={label} className="rounded-2xl border border-slate-200 p-4"><Badge tone={tone}>{label}</Badge><div className="mt-3 text-2xl font-black text-slate-950">{value}</div></div>)}</div>{reconciliation.differences.length ? <div className="mt-5 space-y-2"><div className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">Differences requiring review</div>{reconciliation.differences.slice(0, 20).map((row, index) => <div key={`${row.imported.row}:${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Row {row.imported.row}: {row.imported.home} v {row.imported.away} differs in {row.fields.join(", ")}.</div>)}</div> : null}</div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">Upload a Full-Time fixture CSV to compare it against the active Daxora publication.</div>}</Panel></div> : null}
    </div>
  );
}
