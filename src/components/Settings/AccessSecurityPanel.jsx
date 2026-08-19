import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  Clipboard,
  Clock3,
  Crown,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import {
  canAssignRole,
  createWorkspaceAccess,
  getRoleDescription,
  getRoleLabel,
  MANAGEABLE_MEMBER_ROLES,
} from "../../lib/security/permissions.js";
import { useWorkspaceSecurity } from "../../hooks/useWorkspaceSecurity.js";
import { useDaxoraPrompt } from "../../contexts/DaxoraInteractionContext.jsx";
import ConfirmDialog from "@/ui/ConfirmDialog.jsx";

const ROLE_TONES = {
  owner: "border-amber-200 bg-amber-50 text-amber-800",
  admin: "border-violet-200 bg-violet-50 text-violet-800",
  scheduler: "border-sky-200 bg-sky-50 text-sky-800",
  viewer: "border-slate-200 bg-slate-50 text-slate-700",
  support: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const ACTION_LABELS = {
  "workspace.bootstrap": "Workspace secured",
  "onboarding.start": "Customer onboarding started",
  "onboarding.restart": "Customer onboarding restarted",
  "onboarding.complete": "Customer onboarding completed",
  "membership.invitation.create": "Member invitation created",
  "membership.invitation.revoke": "Member invitation revoked",
  "membership.invitation.accept": "Member invitation accepted",
  "membership.role.update": "Member role changed",
  "membership.remove": "Member access removed",
  "membership.ownership.transfer": "Club ownership transferred",
  "support.session.grant": "Support access granted",
  "support.session.revoke": "Support access revoked",
  "support.session.end": "Support session ended",
  "support.workspace.open": "Support workspace opened",
  "settings.club_config.save": "Club configuration saved",
  "settings.collection.replace": "Club collection updated",
  "matchweek.publish": "Matchweek published",
  "history.delete": "Saved matchweek deleted",
  "test-fixtures.save": "Demonstration fixtures saved",
};

function formatDate(value, { timeOnly = false } = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", timeOnly
    ? { hour: "2-digit", minute: "2-digit" }
    : { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${ROLE_TONES[role] || ROLE_TONES.viewer}`}>
      {getRoleLabel(role)}
    </span>
  );
}

function SectionCard({ icon: Icon, eyebrow, title, description, action, children }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-emerald-300">
            <Icon size={20} strokeWidth={2.4} />
          </span>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{eyebrow}</div>
            <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function EmptyMessage({ children }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center text-sm font-bold text-slate-500">{children}</div>;
}

export default function AccessSecurityPanel({
  activeClubId,
  activeMembership,
  authSession,
  refreshClubAccess,
}) {
  const daxoraPrompt = useDaxoraPrompt();
  const access = useMemo(() => createWorkspaceAccess(activeMembership), [activeMembership]);
  const {
    members,
    invitations,
    supportSessions,
    auditEvents,
    status,
    error,
    refresh,
  } = useWorkspaceSecurity(activeClubId, access.canViewAudit);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteLink, setInviteLink] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportDuration, setSupportDuration] = useState("60");
  const [supportReason, setSupportReason] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  const currentUserId = authSession?.user?.id || "";
  const activeSupport = supportSessions.filter((session) => session.active);
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending");

  const runAction = async (key, action, successMessage, { refreshMemberships = false } = {}) => {
    if (busyAction) return false;
    setBusyAction(key);
    try {
      await action();
      await refresh();
      if (refreshMemberships) await refreshClubAccess?.();
      toast.success(successMessage);
      return true;
    } catch (actionError) {
      toast.error("Action could not be completed", {
        description: actionError?.message || "Review the access rules and try again.",
      });
      return false;
    } finally {
      setBusyAction("");
    }
  };

  const createInvitation = async (event) => {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setBusyAction("invite-create");
    try {
      const invitation = await DB.createClubInvitation(activeClubId, {
        email,
        role: inviteRole,
        expiryHours: 72,
      });
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set("club_invite", invitation.token);
      setInviteLink(url.toString());
      setInviteEmail("");
      await refresh();
      toast.success("Secure invitation created", {
        description: "Copy the link and send it directly to the invited person. It expires after 72 hours.",
      });
    } catch (actionError) {
      toast.error("Invitation could not be created", { description: actionError?.message });
    } finally {
      setBusyAction("");
    }
  };

  const copyInvitation = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Invitation link copied");
    } catch {
      await daxoraPrompt({
        title: "Copy secure invitation link",
        description: "Clipboard access is blocked. Select the full link below and copy it manually.",
        label: "Invitation link",
        defaultValue: inviteLink,
        readOnly: true,
        multiline: false,
        confirmLabel: "Done",
      });
    }
  };

  const confirmMemberAction = async () => {
    const pending = pendingConfirmation;
    if (!pending?.member) return;
    const member = pending.member;
    const isTransfer = pending.type === "transfer";
    const success = await runAction(
      `${pending.type}-${member.user_id}`,
      () => isTransfer
        ? DB.transferClubOwnership(activeClubId, member.user_id)
        : DB.removeClubMember(activeClubId, member.user_id),
      isTransfer ? "Club ownership transferred" : "Member access removed",
      { refreshMemberships: true }
    );
    if (success) setPendingConfirmation(null);
  };

  const grantSupport = async (event) => {
    event.preventDefault();
    const success = await runAction(
      "support-grant",
      () => DB.grantSupportAccess(activeClubId, {
        email: supportEmail,
        durationMinutes: Number(supportDuration),
        reason: supportReason,
      }),
      "Time-limited read-only support access granted"
    );
    if (success) {
      setSupportEmail("");
      setSupportReason("");
    }
  };

  if (!access.canViewAudit) {
    return (
      <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 text-amber-700" size={22} />
          <div>
            <h2 className="text-lg font-black text-amber-950">Administrator access required</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">Only club owners and administrators can review members and trusted audit history.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl sm:p-7">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
              <ShieldCheck size={14} /> Access control
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight">Every action keeps the real user identity.</h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
              Roles are enforced in the interface and again by Supabase. Support sessions never replace a club user: they remain visibly read-only, time-limited and attributable to the support account.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Your access</div>
            <div className="mt-2"><RoleBadge role={access.role} /></div>
            <div className="mt-3 text-xs font-bold text-slate-300">{getRoleDescription(access.role)}</div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <div className="flex gap-3"><AlertTriangle size={20} /><div className="text-sm font-bold">{error}</div></div>
          <button type="button" onClick={refresh} className="rounded-xl bg-white px-3 py-2 text-xs font-black shadow-sm">Retry</button>
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {["owner", "chair", "admin", "club_secretary", "scheduler", "fixture_officer", "operations_officer", "treasurer", "welfare_officer", "communications_officer", "coach", "team_manager", "volunteer", "viewer"].map((role) => (
          <div key={role} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <RoleBadge role={role} />
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{getRoleDescription(role)}</p>
          </div>
        ))}
      </section>

      <SectionCard
        icon={UsersRound}
        eyebrow="Club access"
        title="Members and roles"
        description="Members retain a primary membership role and can also hold multiple additional roles. Additional roles may be club-wide now and can be scoped to teams/sites as the authoritative registries are connected."
        action={(
          <button type="button" onClick={refresh} disabled={status === "loading"} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={15} className={status === "loading" ? "animate-spin" : ""} /> Refresh
          </button>
        )}
      >
        {status === "loading" && !members.length ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-slate-500"><LoaderCircle className="animate-spin" size={20} /> Loading secure access…</div>
        ) : members.length ? (
          <div className="divide-y divide-slate-100">
            {members.map((member) => {
              const isCurrent = member.user_id === currentUserId;
              const canEdit = !isCurrent
                && member.role !== "owner"
                && canAssignRole(access.role, member.role);
              return (
                <div key={member.user_id} className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-700">
                      {(member.display_name || member.email || "U").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-black text-slate-950">{member.display_name || member.email || "Club member"}</div>
                        {isCurrent ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-700">You</span> : null}
                      </div>
                      <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">{member.email || "No profile email"}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <RoleBadge role={member.role} />
                    {Array.isArray(member.roles) ? member.roles.map((assignment) => (
                      <span key={assignment.id || `${assignment.role_code}-${assignment.scope_type}-${assignment.scope_id || "club"}`} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-800">
                        {getRoleLabel(assignment.role_code)}{assignment.scope_type !== "club" ? ` · ${assignment.scope_type}` : ""}
                        {canEdit && assignment.id ? (
                          <button type="button" disabled={Boolean(busyAction)} onClick={() => runAction(`remove-role-${assignment.id}`, () => DB.removeClubMemberRole(activeClubId, member.user_id, assignment.id), "Additional role removed", { refreshMemberships: true })} className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-100" aria-label={`Remove ${getRoleLabel(assignment.role_code)} role`}>
                            <X size={11} />
                          </button>
                        ) : null}
                      </span>
                    )) : null}
                    {canEdit ? (
                      <select
                        value=""
                        disabled={Boolean(busyAction)}
                        onChange={(event) => {
                          const role = event.target.value;
                          if (!role) return;
                          runAction(`add-role-${member.user_id}-${role}`, () => DB.addClubMemberRole(activeClubId, member.user_id, role), "Additional role assigned", { refreshMemberships: true });
                        }}
                        className="h-9 rounded-xl border border-dashed border-slate-300 bg-white px-2.5 text-[11px] font-black text-slate-600 outline-none focus:border-emerald-400"
                      >
                        <option value="">+ Add role</option>
                        {MANAGEABLE_MEMBER_ROLES.filter((role) => canAssignRole(access.role, role) && role !== member.role && !(member.roles || []).some((assignment) => assignment.role_code === role)).map((role) => (
                          <option key={role} value={role}>{getRoleLabel(role)}</option>
                        ))}
                      </select>
                    ) : null}

                    {access.canTransferOwnership && !isCurrent && member.role !== "owner" ? (
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={() => setPendingConfirmation({ type: "transfer", member })}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        <Crown size={15} /> Transfer
                      </button>
                    ) : null}

                    {canEdit ? (
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={() => setPendingConfirmation({ type: "remove", member })}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        aria-label="Remove member"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyMessage>No members were returned by the secure membership service.</EmptyMessage>}
      </SectionCard>

      <SectionCard
        icon={UserPlus}
        eyebrow="Invite"
        title="Add a club user"
        description="Ground Control creates a single-use secure link. The person must sign in with the exact invited email address before access is activated."
      >
        <form onSubmit={createInvitation} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label>
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Email address</span>
            <input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="person@club.org" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-emerald-400 focus:bg-white" />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Role</span>
            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-emerald-400">
              {MANAGEABLE_MEMBER_ROLES.filter((role) => canAssignRole(access.role, role)).map((role) => <option key={role} value={role}>{getRoleLabel(role)}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busyAction === "invite-create"} className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60">
            {busyAction === "invite-create" ? <LoaderCircle className="animate-spin" size={17} /> : <KeyRound size={17} />} Create invite
          </button>
        </form>

        {inviteLink ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-black text-emerald-900"><Check size={17} /> Invitation ready</div>
                <div className="mt-1 truncate text-xs font-semibold text-emerald-700">{inviteLink}</div>
              </div>
              <button type="button" onClick={copyInvitation} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-emerald-800 shadow-sm"><Clipboard size={15} /> Copy link</button>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pending invitations</div>
          {pendingInvitations.length ? (
            <div className="grid gap-2">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-900">{invitation.email}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500"><RoleBadge role={invitation.role} /><span>Expires {formatDate(invitation.expires_at)}</span></div>
                  </div>
                  <button type="button" disabled={Boolean(busyAction)} onClick={() => runAction(`revoke-invite-${invitation.id}`, () => DB.revokeClubInvitation(activeClubId, invitation.id), "Invitation revoked")} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50"><X size={14} /> Revoke</button>
                </div>
              ))}
            </div>
          ) : <EmptyMessage>No pending invitations.</EmptyMessage>}
        </div>
      </SectionCard>

      <SectionCard
        icon={Wrench}
        eyebrow="Daxora support"
        title="Time-limited read-only support"
        description="Support cannot self-grant access. Only the club owner can approve a registered Daxora support account, for a maximum of two hours, with a visible reason and audit trail."
      >
        {access.canManageSupport ? (
          <form onSubmit={grantSupport} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_minmax(0,1.2fr)_auto]">
            <label>
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Support email</span>
              <input type="email" required value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="support@daxora.co.uk" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-emerald-400 focus:bg-white" />
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Duration</span>
              <select value={supportDuration} onChange={(event) => setSupportDuration(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-emerald-400">
                <option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">90 minutes</option><option value="120">2 hours</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Reason</span>
              <input required minLength={5} value={supportReason} onChange={(event) => setSupportReason(event.target.value)} placeholder="Investigate fixture import issue" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-emerald-400 focus:bg-white" />
            </label>
            <button type="submit" disabled={busyAction === "support-grant"} className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"><ShieldCheck size={17} /> Grant access</button>
          </form>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Only the club owner can grant or revoke support access.</div>
        )}

        <div className="mt-5 grid gap-2">
          {activeSupport.length ? activeSupport.map((session) => (
            <div key={session.id} className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2"><div className="text-sm font-black text-emerald-950">{session.support_name || session.support_email || "Daxora Support"}</div><RoleBadge role="support" /></div>
                <div className="mt-1 text-xs font-semibold text-emerald-800">{session.reason}</div>
                <div className="mt-2 flex items-center gap-2 text-xs font-black text-emerald-700"><Clock3 size={14} /> Expires {formatDate(session.expires_at)}</div>
              </div>
              {access.canManageSupport ? <button type="button" disabled={Boolean(busyAction)} onClick={() => runAction(`support-revoke-${session.id}`, () => DB.revokeSupportAccess(activeClubId, session.id), "Support access revoked")} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50"><X size={15} /> End access</button> : null}
            </div>
          )) : <EmptyMessage>No active support session.</EmptyMessage>}
        </div>
      </SectionCard>

      <SectionCard
        icon={Activity}
        eyebrow="Trusted history"
        title="Audit log"
        description="The database records the authenticated user and their role. Membership and support events are generated by protected database functions rather than browser-supplied identity fields."
      >
        {auditEvents.length ? (
          <div className="divide-y divide-slate-100">
            {auditEvents.map((event) => (
              <div key={event.id} className="grid gap-3 py-4 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-start">
                <div className="text-xs font-black text-slate-500">{formatDate(event.created_at)}</div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-950">{ACTION_LABELS[event.action] || event.action}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{event.actor_label || "Authenticated user"} · {getRoleLabel(event.actor_role)}</div>
                  {event.detail && Object.keys(event.detail).length ? <div className="mt-2 break-words rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">{JSON.stringify(event.detail)}</div> : null}
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{event.source || "app"}</span>
              </div>
            ))}
          </div>
        ) : <EmptyMessage>No audit events have been recorded yet.</EmptyMessage>}
      </SectionCard>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex gap-3"><ShieldCheck className="shrink-0 text-emerald-600" size={20} /><div><div className="text-sm font-black text-slate-950">Database enforced</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-500">Changing the interface cannot bypass role or RLS policies.</div></div></div>
          <div className="flex gap-3"><UserCog className="shrink-0 text-violet-600" size={20} /><div><div className="text-sm font-black text-slate-950">No hidden impersonation</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-500">Support uses its own user ID and never becomes the club owner.</div></div></div>
          <div className="flex gap-3"><Clock3 className="shrink-0 text-sky-600" size={20} /><div><div className="text-sm font-black text-slate-950">Automatic expiry</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-500">Support access disappears as soon as the approved window ends.</div></div></div>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(pendingConfirmation)}
        title={pendingConfirmation?.type === "transfer" ? "Transfer club ownership?" : "Remove club member?"}
        description={pendingConfirmation?.type === "transfer"
          ? `${pendingConfirmation?.member?.display_name || pendingConfirmation?.member?.email || "This member"} will become the Club Owner. Your account will become an Administrator.`
          : `${pendingConfirmation?.member?.display_name || pendingConfirmation?.member?.email || "This member"} will immediately lose access to this club workspace.`}
        confirmLabel={pendingConfirmation?.type === "transfer" ? "Transfer ownership" : "Remove member"}
        tone={pendingConfirmation?.type === "transfer" ? "warning" : "danger"}
        busy={Boolean(busyAction)}
        onCancel={() => !busyAction && setPendingConfirmation(null)}
        onConfirm={confirmMemberAction}
      />
    </div>
  );
}
