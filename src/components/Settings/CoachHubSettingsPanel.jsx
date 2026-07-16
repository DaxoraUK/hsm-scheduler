import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  MailPlus,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { alignTeamContacts, getTeamContactKey } from "../../lib/communications/contactModel.js";
import { Auth, DB } from "../../lib/supabase.js";
import {
  coachInvitationUrl,
  invitationStatusForPerson,
  normaliseCoachRequest,
  requestStatusLabel,
} from "../../lib/coach/coachHubEngine.js";
import CoachRequestReviewDialog from "../coach/CoachRequestReviewDialog.jsx";
import CoachRequestConversation from "../coach/CoachRequestConversation.jsx";
import { buildCoachEngagementMetrics } from "../../lib/coach/coachHubPilotEngine.js";
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

function statusTone(status) {
  if (status === "accepted") return "bg-emerald-100 text-emerald-800";
  if (status === "pending") return "bg-blue-100 text-blue-800";
  if (status === "delivery_failed") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function personAssignments(personId, assignments = []) {
  return assignments.filter((row) => text(row.person_id || row.personId) === text(personId));
}

const ROLE_OPTIONS = [
  ["manager", "Manager"],
  ["lead_coach", "Lead coach"],
  ["coach", "Coach"],
  ["assistant", "Assistant coach"],
  ["team_secretary", "Team secretary"],
  ["welfare", "Welfare contact"],
  ["emergency_contact", "Emergency contact"],
];

function blankPerson(person = {}) {
  return {
    id: person.id || "",
    displayName: person.display_name || person.displayName || "",
    email: person.email || "",
    mobile: person.mobile || "",
    preferredChannel: person.preferred_channel || person.preferredChannel || "email",
  };
}

function blankAssignment(person, assignment = {}) {
  return {
    id: assignment.id || "",
    personId: person?.id || assignment.person_id || assignment.personId || "",
    teamKey: assignment.team_key || assignment.teamKey || "",
    teamName: assignment.team_name || assignment.teamName || "",
    staffRole: assignment.staff_role || assignment.staffRole || "coach",
    isPrimary: Boolean(assignment.is_primary ?? assignment.isPrimary),
    canRequestTraining: assignment.can_request_training ?? assignment.canRequestTraining ?? true,
    canRequestFriendlies: assignment.can_request_friendlies ?? assignment.canRequestFriendlies ?? true,
    canRequestChanges: assignment.can_request_changes ?? assignment.canRequestChanges ?? true,
    canViewTeamContacts: assignment.can_view_team_contacts ?? assignment.canViewTeamContacts ?? true,
    canViewCosts: assignment.can_view_costs ?? assignment.canViewCosts ?? false,
  };
}

export default function CoachHubSettingsPanel({
  club = {},
  activeClubId,
  setSettingsTab,
  workspaceAccess,
  teamCfg = [],
  setTeamContacts,
}) {
  const clubId = activeClubId || club.id;
  const [workspace, setWorkspace] = useState({ people: [], assignments: [], invitations: [], requests: [], messages: [], reminders: [], metricsUnavailable: false });
  const [status, setStatus] = useState("loading");
  const [busyId, setBusyId] = useState("");
  const [review, setReview] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [replacement, setReplacement] = useState(null);
  const [personEditor, setPersonEditor] = useState(null);
  const [assignmentEditor, setAssignmentEditor] = useState(null);
  const canManage = Boolean(workspaceAccess?.canManageSettings);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!clubId) return;
    if (!quiet) setStatus("loading");
    try {
      const [payload, pilot, sharedContacts] = await Promise.all([
        DB.listCoachHubAdminWorkspace(clubId),
        DB.listCoachHubPilotMetrics(clubId),
        DB.loadTeamContacts(clubId).catch(() => null),
      ]);
      if (Array.isArray(sharedContacts)) {
        setTeamContacts?.(alignTeamContacts(teamCfg, sharedContacts));
      }
      setWorkspace({
        people: Array.isArray(payload?.people) ? payload.people : [],
        assignments: Array.isArray(payload?.assignments) ? payload.assignments : [],
        invitations: Array.isArray(payload?.invitations) ? payload.invitations : [],
        requests: Array.isArray(payload?.requests) ? payload.requests.map(normaliseCoachRequest) : [],
        messages: Array.isArray(pilot?.messages) ? pilot.messages : [],
        reminders: Array.isArray(pilot?.reminders) ? pilot.reminders : [],
        metricsUnavailable: Boolean(pilot?.unavailable),
      });
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      toast.error("Coach Hub could not be loaded", { description: error?.message });
    }
  }, [clubId, setTeamContacts, teamCfg]);

  useEffect(() => {
    load();
  }, [load]);

  const eligiblePeople = useMemo(
    () => workspace.people.filter((person) => text(person.email) && text(person.status || "active") === "active"),
    [workspace.people],
  );
  const pendingRequests = workspace.requests.filter((request) => ["submitted", "needs_information", "alternative_offered"].includes(request.status));
  const linkedCount = workspace.people.filter((person) => text(person.user_id || person.userId)).length;
  const engagement = useMemo(() => buildCoachEngagementMetrics(workspace), [workspace]);

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

  const saveReplacement = async () => {
    if (!replacement?.person?.id || !text(replacement.email)) {
      toast.error("Enter the replacement coach email address");
      return;
    }
    setBusyId(`replace-${replacement.person.id}`);
    try {
      const person = await DB.replaceCoachHubContact(clubId, replacement.person.id, {
        display_name: replacement.displayName,
        email: replacement.email,
        mobile: replacement.mobile,
      });
      setReplacement(null);
      await load({ quiet: true });
      toast.success("Coach contact replaced", { description: `${person?.display_name || replacement.displayName} can now be invited securely.` });
    } catch (error) {
      toast.error("Coach contact could not be replaced", { description: error?.message });
    } finally {
      setBusyId("");
    }
  };

  const savePerson = async () => {
    if (!text(personEditor?.displayName)) {
      toast.error("Enter the coach name");
      return;
    }
    if (!text(personEditor?.email) && !text(personEditor?.mobile)) {
      toast.error("Add an email address or mobile number");
      return;
    }
    setBusyId(`person-${personEditor?.id || "new"}`);
    try {
      const saved = await DB.upsertCoachHubPerson(clubId, {
        id: personEditor?.id || null,
        display_name: personEditor.displayName,
        email: personEditor.email,
        mobile: personEditor.mobile,
        preferred_channel: personEditor.preferredChannel,
      });
      setPersonEditor(null);
      await load({ quiet: true });
      toast.success(personEditor?.id ? "Coach contact updated" : "Coach added to the directory", { description: `${saved?.display_name || personEditor.displayName} can now be assigned to one or more teams.` });
    } catch (error) {
      toast.error("Coach contact could not be saved", { description: error?.message });
    } finally {
      setBusyId("");
    }
  };

  const saveAssignment = async () => {
    if (!assignmentEditor?.person?.id || !text(assignmentEditor.teamKey)) {
      toast.error("Choose a team for this coach");
      return;
    }
    const team = teamCfg.find((row, index) => getTeamContactKey(row, index) === text(assignmentEditor.teamKey))
      || teamCfg.find((row) => text(row.name) === text(assignmentEditor.teamName));
    setBusyId(`assignment-${assignmentEditor.id || "new"}`);
    try {
      await DB.saveCoachHubTeamAssignment(clubId, {
        id: assignmentEditor.id || null,
        person_id: assignmentEditor.person.id,
        team_key: assignmentEditor.teamKey,
        team_name: team?.name || assignmentEditor.teamName,
        staff_role: assignmentEditor.staffRole,
        is_primary: assignmentEditor.isPrimary,
        can_request_training: assignmentEditor.canRequestTraining,
        can_request_friendlies: assignmentEditor.canRequestFriendlies,
        can_request_changes: assignmentEditor.canRequestChanges,
        can_view_team_contacts: assignmentEditor.canViewTeamContacts,
        can_view_costs: assignmentEditor.canViewCosts,
      });
      const person = assignmentEditor.person;
      setAssignmentEditor({ person, ...blankAssignment(person) });
      await load({ quiet: true });
      toast.success("Team role assigned", { description: `${person.display_name || person.email} is now linked to ${team?.name || assignmentEditor.teamName}.` });
    } catch (error) {
      toast.error("Team role could not be saved", { description: error?.message });
    } finally {
      setBusyId("");
    }
  };

  const removeAssignment = async (assignment) => {
    setBusyId(`remove-${assignment.id}`);
    try {
      await DB.deleteCoachHubTeamAssignment(clubId, assignment.id);
      await load({ quiet: true });
      toast.success("Team role removed");
    } catch (error) {
      toast.error("Team role could not be removed", { description: error?.message });
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
              <PrimaryButton type="button" onClick={() => setPersonEditor(blankPerson())} disabled={!canManage}><UserRoundPlus size={16} /> Add coach</PrimaryButton>
              <SecondaryButton type="button" onClick={() => setSettingsTab?.("teams")}>Open team contacts</SecondaryButton>
              <SecondaryButton type="button" onClick={() => load()} disabled={status === "loading"}><RefreshCw size={16} /> Refresh</SecondaryButton>
            </div>
          )}
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Contact records" value={workspace.people.length} detail="Sourced from teams" />
          <Metric label="Coach Hub active" value={linkedCount} detail={`${engagement.inviteCoveragePct}% activated`} tone="green" />
          <Metric label="Verified contacts" value={`${engagement.verificationPct}%`} detail="Coach-confirmed details" tone={engagement.verificationPct < 80 ? "amber" : "green"} />
          <Metric label="Requests awaiting action" value={pendingRequests.length} detail="Training and friendlies" tone={pendingRequests.length ? "amber" : "slate"} />
          <Metric label="Acknowledged" value={`${engagement.acknowledgementPct}%`} detail="Action messages" tone="green" />
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
      {workspace.metricsUnavailable ? <Notice tone="warning">Coach engagement metrics are temporarily unavailable. Contacts, invitations, requests and booking operations remain available.</Notice> : null}

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
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${(person.verification_status || person.verificationStatus) === "verified" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{(person.verification_status || person.verificationStatus) === "verified" ? "verified" : "verification due"}</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{person.email || "Email required"}{person.mobile ? ` · ${person.mobile}` : ""}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{assignments.map((assignment) => <span key={assignment.id} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{assignment.team_name || assignment.teamName} · {assignment.staff_role || assignment.staffRole}</span>)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!canManage} onClick={() => setPersonEditor(blankPerson(person))} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-40"><Pencil size={14} /> Edit contact</button>
                  <button type="button" disabled={!canManage} onClick={() => setAssignmentEditor({ person, ...blankAssignment(person) })} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-black text-violet-800 disabled:opacity-40"><UsersRound size={14} /> Teams & roles</button>
                  <button type="button" disabled={!canManage || !person.email || busyId === person.id || invitationStatus === "accepted"} onClick={() => deliverInvitation(person)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Send size={15} /> {busyId === person.id ? "Sending…" : invitationStatus === "accepted" ? "Access active" : invitationStatus === "pending" ? "Resend invite" : "Invite coach"}</button>
                </div>
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
            <div key={request.id} className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
              <button type="button" onClick={() => setReview(request)} className="min-w-0 flex-1 text-left">
                <div className="text-sm font-black text-slate-950">{request.title}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{request.teamName} · {request.preferredDate} · {request.preferredStartTime}–{request.preferredEndTime}</div>
              </button>
              <span className="rounded-full bg-amber-100 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">{requestStatusLabel(request.status)}</span>
              <button type="button" onClick={() => setConversation(request)} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-[11px] font-black text-violet-800"><MessageSquareText size={14} /> Conversation</button>
            </div>
          )) : <EmptyState icon={CheckCircle2} title="Coach requests are clear" body="New training, friendly and booking-change requests will appear here." />}
        </div>
      </SettingsPanel>

      {review ? <CoachRequestReviewDialog request={review} busy={busyId === `request-${review.id}`} onClose={() => setReview(null)} onDecision={decideRequest} /> : null}
      {conversation ? <CoachRequestConversation clubId={clubId} request={conversation} role="club" onClose={() => setConversation(null)} /> : null}
      {replacement ? <ReplacementDialog draft={replacement} setDraft={setReplacement} busy={busyId === `replace-${replacement.person.id}`} onSave={saveReplacement} /> : null}
      {personEditor ? <PersonEditorDialog draft={personEditor} setDraft={setPersonEditor} busy={busyId === `person-${personEditor.id || "new"}`} onSave={savePerson} /> : null}
      {assignmentEditor ? <AssignmentEditorDialog draft={assignmentEditor} setDraft={setAssignmentEditor} assignments={personAssignments(assignmentEditor.person.id, workspace.assignments)} teams={teamCfg} busyId={busyId} onSave={saveAssignment} onRemove={removeAssignment} /> : null}
    </div>
  );
}

function PersonEditorDialog({ draft, setDraft, busy, onSave }) {
  return <div className="fixed inset-0 z-[260] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"><section className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-700">Coach directory</div><h3 className="mt-1 text-xl font-black">{draft.id ? "Edit coach" : "Add coach"}</h3></div><button type="button" onClick={() => setDraft(null)} className="h-10 w-10 rounded-xl border border-slate-200 text-lg">×</button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Name</span><input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold" value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} /></label><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Email</span><input type="email" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /></label><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Mobile</span><input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold" value={draft.mobile} onChange={(event) => setDraft((current) => ({ ...current, mobile: event.target.value }))} /></label><label className="sm:col-span-2"><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Preferred communication channel</span><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" value={draft.preferredChannel} onChange={(event) => setDraft((current) => ({ ...current, preferredChannel: event.target.value }))}><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="in_app">In-app only</option></select></label></div><div className="flex justify-end gap-2 border-t border-slate-200 p-5"><button type="button" onClick={() => setDraft(null)} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-black">Cancel</button><button disabled={busy} type="button" onClick={onSave} className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white">{busy ? "Saving…" : "Save coach"}</button></div></section></div>;
}

function AssignmentEditorDialog({ draft, setDraft, assignments, teams, busyId, onSave, onRemove }) {
  const teamOptions = (Array.isArray(teams) ? teams : []).map((team, index) => ({ key: getTeamContactKey(team, index), name: text(team.name || team.teamName || `Team ${index + 1}`) }));
  const selectTeam = (teamKey) => {
    const team = teamOptions.find((row) => row.key === teamKey);
    setDraft((current) => ({ ...current, teamKey, teamName: team?.name || "" }));
  };
  return <div className="fixed inset-0 z-[260] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"><section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-700">Teams and roles</div><h3 className="mt-1 text-xl font-black">{draft.person.display_name || draft.person.email}</h3></div><button type="button" onClick={() => setDraft(null)} className="h-10 w-10 rounded-xl border border-slate-200 text-lg">×</button></div><div className="space-y-5 p-5"><div><div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Current assignments</div>{assignments.length ? <div className="space-y-2">{assignments.map((assignment) => {
  const sourceManaged = ["coach", "assistant"].includes(assignment.source_slot || assignment.sourceSlot);
  return <div key={assignment.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center"><button type="button" className="min-w-0 flex-1 text-left disabled:cursor-default" disabled={sourceManaged} onClick={() => setDraft({ person: draft.person, ...blankAssignment(draft.person, assignment) })}><div className="text-sm font-black text-slate-950">{assignment.team_name || assignment.teamName}</div><div className="text-xs font-semibold text-slate-500">{ROLE_OPTIONS.find(([value]) => value === (assignment.staff_role || assignment.staffRole))?.[1] || assignment.staff_role || "Coach"}{assignment.is_primary || assignment.isPrimary ? " · Primary contact" : ""}{sourceManaged ? " · Managed in Teams" : ""}</div></button>{sourceManaged ? <span className="rounded-xl bg-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-600">Team contact</span> : <button type="button" disabled={busyId === `remove-${assignment.id}`} onClick={() => onRemove(assignment)} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700"><Trash2 size={14} /> Remove</button>}</div>;
})}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">This coach is not assigned to a team yet.</div>}</div><div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4"><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Team</span><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" value={draft.teamKey} onChange={(event) => selectTeam(event.target.value)}><option value="">Choose team</option>{teamOptions.map((team) => <option key={team.key} value={team.key}>{team.name}</option>)}</select></label><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Role</span><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" value={draft.staffRole} onChange={(event) => setDraft((current) => ({ ...current, staffRole: event.target.value }))}>{ROLE_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><PermissionCheck label="Primary team contact" checked={draft.isPrimary} onChange={(value) => setDraft((current) => ({ ...current, isPrimary: value }))} /><PermissionCheck label="Request training" checked={draft.canRequestTraining} onChange={(value) => setDraft((current) => ({ ...current, canRequestTraining: value }))} /><PermissionCheck label="Request friendlies" checked={draft.canRequestFriendlies} onChange={(value) => setDraft((current) => ({ ...current, canRequestFriendlies: value }))} /><PermissionCheck label="Request changes/cancellations" checked={draft.canRequestChanges} onChange={(value) => setDraft((current) => ({ ...current, canRequestChanges: value }))} /><PermissionCheck label="View team contacts" checked={draft.canViewTeamContacts} onChange={(value) => setDraft((current) => ({ ...current, canViewTeamContacts: value }))} /><PermissionCheck label="View booking costs" checked={draft.canViewCosts} onChange={(value) => setDraft((current) => ({ ...current, canViewCosts: value }))} /></div><div className="mt-4 flex justify-end"><button disabled={!draft.teamKey || Boolean(busyId)} type="button" onClick={onSave} className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-40">{busyId?.startsWith("assignment-") ? "Saving…" : draft.id ? "Update role" : "Add team role"}</button></div></div></div></section></div>;
}

function PermissionCheck({ label, checked, onChange }) {
  return <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/80 bg-white px-3 text-xs font-black text-slate-700"><input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-violet-600" /> {label}</label>;
}

function ReplacementDialog({ draft, setDraft, busy, onSave }) {
  return <div className="fixed inset-0 z-[260] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"><section className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-700">Coach replacement</div><h3 className="mt-1 text-xl font-black">Update the team contact</h3></div><button type="button" onClick={() => setDraft(null)} className="h-10 w-10 rounded-xl border border-slate-200 text-lg">×</button></div><div className="space-y-4 p-5"><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Name</span><input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold" value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} /></label><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Email</span><input type="email" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /></label><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Mobile</span><input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold" value={draft.mobile} onChange={(event) => setDraft((current) => ({ ...current, mobile: event.target.value }))} /></label><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-900">Existing Coach Hub access and private calendar feeds are revoked. Send the replacement coach a fresh invitation after saving.</div></div><div className="flex justify-end gap-2 border-t border-slate-200 p-5"><button type="button" onClick={() => setDraft(null)} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-black">Cancel</button><button disabled={busy} type="button" onClick={onSave} className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white">{busy ? "Replacing…" : "Replace contact"}</button></div></section></div>;
}

function Metric({ label, value, detail, tone = "slate" }) {
  const tones = { slate: "border-slate-200 bg-slate-50", green: "border-emerald-200 bg-emerald-50", amber: "border-amber-200 bg-amber-50" };
  return <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}><div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div><div className="mt-1 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs font-bold text-slate-500">{detail}</div></div>;
}

function EmptyState({ icon: Icon, title, body }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><Icon size={22} className="mx-auto text-slate-400" /><div className="mt-3 text-sm font-black text-slate-800">{title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{body}</div></div>;
}
