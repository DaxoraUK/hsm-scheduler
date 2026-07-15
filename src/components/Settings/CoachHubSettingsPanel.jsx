import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  MailPlus,
  RefreshCw,
  Send,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Auth, DB } from "../../lib/supabase.js";
import {
  coachInvitationUrl,
  invitationStatusForPerson,
  normaliseCoachRequest,
  requestStatusLabel,
} from "../../lib/coach/coachHubEngine.js";
import CoachRequestReviewDialog from "../coach/CoachRequestReviewDialog.jsx";
import {
  Notice,
  PrimaryButton,
  SecondaryButton,
  SettingsPanel,
  SettingsSectionHeader,
} from "./SettingsPrimitives.jsx";

function text(value) {
  return String(value ?? "").trim();
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function statusTone(status) {
  if (status === "accepted") return "bg-emerald-100 text-emerald-800";
  if (status === "pending") return "bg-blue-100 text-blue-800";
  if (status === "delivery_failed") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function personAssignments(personId, assignments = []) {
  return assignments.filter((row) => text(row.person_id || row.personId) === text(personId));
}

export default function CoachHubSettingsPanel({
  club = {},
  activeClubId,
  setSettingsTab,
  workspaceAccess,
}) {
  const clubId = activeClubId || club.id;
  const [workspace, setWorkspace] = useState({ people: [], assignments: [], invitations: [], requests: [] });
  const [status, setStatus] = useState("loading");
  const [busyId, setBusyId] = useState("");
  const [review, setReview] = useState(null);
  const canManage = Boolean(workspaceAccess?.canManageSettings);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!clubId) return;
    if (!quiet) setStatus("loading");
    try {
      const payload = await DB.listCoachHubAdminWorkspace(clubId);
      setWorkspace({
        people: Array.isArray(payload?.people) ? payload.people : [],
        assignments: Array.isArray(payload?.assignments) ? payload.assignments : [],
        invitations: Array.isArray(payload?.invitations) ? payload.invitations : [],
        requests: Array.isArray(payload?.requests) ? payload.requests.map(normaliseCoachRequest) : [],
      });
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      toast.error("Coach Hub could not be loaded", { description: error?.message });
    }
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  const eligiblePeople = useMemo(
    () => workspace.people.filter((person) => text(person.email) && text(person.status || "active") === "active"),
    [workspace.people],
  );
  const pendingRequests = workspace.requests.filter((request) => ["submitted", "needs_information", "alternative_offered"].includes(request.status));
  const linkedCount = workspace.people.filter((person) => text(person.user_id || person.userId)).length;

  const syncContacts = async () => {
    setBusyId("sync");
    try {
      const count = await DB.syncCoachHubContacts(clubId);
      await load({ quiet: true });
      toast.success("Coach contacts synchronised", { description: `${Number(count) || 0} team contact records checked.` });
    } catch (error) {
      toast.error("Contacts could not be synchronised", { description: error?.message });
    } finally {
      setBusyId("");
    }
  };

  const deliverInvitation = async (person) => {
    setBusyId(person.id);
    try {
      const invitation = await DB.createCoachHubInvitation(clubId, person.id);
      const inviteUrl = coachInvitationUrl(invitation.token);
      const session = await Auth.getValidSession();
      const response = await fetch("/api/coach/invite", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clubId, invitationId: invitation.id, inviteUrl }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        await navigator.clipboard?.writeText?.(inviteUrl);
        throw new Error(`${result?.error || "Email delivery is unavailable."} The secure invitation link has been copied.`);
      }
      await load({ quiet: true });
      toast.success("Coach invitation sent", { description: `${person.display_name || person.email} can now activate Coach Hub.` });
    } catch (error) {
      toast.error("Invitation was not emailed", { description: error?.message });
    } finally {
      setBusyId("");
    }
  };

  const bulkInvite = async () => {
    const candidates = eligiblePeople.filter((person) => !text(person.user_id || person.userId));
    if (!candidates.length) {
      toast.info("No new coach invitations are required");
      return;
    }
    setBusyId("bulk");
    let delivered = 0;
    let failed = 0;
    for (const person of candidates) {
      try {
        const invitation = await DB.createCoachHubInvitation(clubId, person.id);
        const session = await Auth.getValidSession();
        const response = await fetch("/api/coach/invite", {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token || ""}`, "Content-Type": "application/json" },
          body: JSON.stringify({ clubId, invitationId: invitation.id, inviteUrl: coachInvitationUrl(invitation.token) }),
        });
        if (!response.ok) throw new Error("delivery failed");
        delivered += 1;
      } catch {
        failed += 1;
      }
    }
    await load({ quiet: true });
    setBusyId("");
    if (failed) toast.warning("Bulk invitation completed with exceptions", { description: `${delivered} sent · ${failed} need attention.` });
    else toast.success("Coach invitations sent", { description: `${delivered} coaches invited.` });
  };

  const decideRequest = async (decision, data = {}) => {
    if (!review) return;
    setBusyId(`request-${review.id}`);
    try {
      await DB.reviewCoachHubRequest(clubId, review.id, decision, data);
      setReview(null);
      await load({ quiet: true });
      toast.success(decision === "approve" ? "Coach request approved" : decision === "alternative" ? "Alternative sent to coach" : "Coach request updated");
    } catch (error) {
      toast.error("Request could not be updated", { description: error?.message });
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-5">
      <SettingsPanel>
        <SettingsSectionHeader
          eyebrow="Coach Hub"
          title="One contact record, one coach workspace"
          description="Team contacts power communications, Coach Hub access, annual booking requests, calendar feeds and notifications. Clubs do not need to enter the same person twice."
          icon={UsersRound}
          actions={(
            <div className="flex flex-wrap gap-2">
              <SecondaryButton type="button" onClick={() => setSettingsTab?.("teams")}>Open team contacts</SecondaryButton>
              <SecondaryButton type="button" onClick={() => load()} disabled={status === "loading"}><RefreshCw size={16} /> Refresh</SecondaryButton>
            </div>
          )}
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Contact records" value={workspace.people.length} detail="Sourced from teams" />
          <Metric label="Coach Hub active" value={linkedCount} detail="Individual logins" tone="green" />
          <Metric label="Requests awaiting action" value={pendingRequests.length} detail="Training and friendlies" tone={pendingRequests.length ? "amber" : "slate"} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <PrimaryButton type="button" onClick={syncContacts} disabled={!canManage || Boolean(busyId)}>
            <RefreshCw size={16} className={busyId === "sync" ? "animate-spin" : ""} /> Synchronise team contacts
          </PrimaryButton>
          <SecondaryButton type="button" onClick={bulkInvite} disabled={!canManage || Boolean(busyId)}>
            <MailPlus size={16} /> Invite all eligible coaches
          </SecondaryButton>
        </div>
      </SettingsPanel>

      {!canManage ? <Notice tone="warning">Only club owners and administrators can issue Coach Hub invitations or decide requests.</Notice> : null}

      <SettingsPanel>
        <SettingsSectionHeader
          eyebrow="People and access"
          title="Coach invitations"
          description="Email and mobile details continue to come from the team contact record used by Communications."
          icon={UserRoundPlus}
        />
        <div className="mt-4 space-y-2">
          {workspace.people.length ? workspace.people.map((person) => {
            const assignments = personAssignments(person.id, workspace.assignments);
            const invitationStatus = text(person.user_id || person.userId) ? "accepted" : invitationStatusForPerson(person.id, workspace.invitations);
            return (
              <div key={person.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-black text-slate-950">{person.display_name || person.email || "Unnamed contact"}</div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${statusTone(invitationStatus)}`}>{invitationStatus.replaceAll("_", " ")}</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{person.email || "Email required"}{person.mobile ? ` · ${person.mobile}` : ""}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{assignments.map((assignment) => <span key={assignment.id} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{assignment.team_name || assignment.teamName} · {assignment.staff_role || assignment.staffRole}</span>)}</div>
                </div>
                <button type="button" disabled={!canManage || !person.email || busyId === person.id || invitationStatus === "accepted"} onClick={() => deliverInvitation(person)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                  <Send size={15} /> {busyId === person.id ? "Sending…" : invitationStatus === "accepted" ? "Access active" : invitationStatus === "pending" ? "Resend invite" : "Invite coach"}
                </button>
              </div>
            );
          }) : <EmptyState icon={AlertTriangle} title="No team contacts found" body="Add an adult coach or manager to a team, save it, then synchronise Coach Hub." />}
        </div>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSectionHeader
          eyebrow="Annual Planner"
          title="Coach request queue"
          description="Approve a request, offer a better slot, ask for more information or decline it with a recorded reason."
          icon={CalendarCheck2}
        />
        <div className="mt-4 space-y-2">
          {pendingRequests.length ? pendingRequests.map((request) => (
            <button key={request.id} type="button" onClick={() => setReview(request)} className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:shadow-sm sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-slate-950">{request.title}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{request.teamName} · {request.preferredDate} · {request.preferredStartTime}–{request.preferredEndTime}</div>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">{requestStatusLabel(request.status)}</span>
            </button>
          )) : <EmptyState icon={CheckCircle2} title="Coach requests are clear" body="New training, friendly and booking-change requests will appear here." />}
        </div>
      </SettingsPanel>

      {review ? <CoachRequestReviewDialog request={review} busy={busyId === `request-${review.id}`} onClose={() => setReview(null)} onDecision={decideRequest} /> : null}
    </div>
  );
}

function Metric({ label, value, detail, tone = "slate" }) {
  const tones = { slate: "border-slate-200 bg-slate-50", green: "border-emerald-200 bg-emerald-50", amber: "border-amber-200 bg-amber-50" };
  return <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}><div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div><div className="mt-1 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs font-bold text-slate-500">{detail}</div></div>;
}

function EmptyState({ icon: Icon, title, body }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><Icon size={22} className="mx-auto text-slate-400" /><div className="mt-3 text-sm font-black text-slate-800">{title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{body}</div></div>;
}
