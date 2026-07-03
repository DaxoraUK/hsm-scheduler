import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgePoundSterling,
  ReceiptText,
  Building2,
  CheckCircle2,
  CirclePause,
  Clock3,
  Headphones,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  TicketCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import PlatformBillingLegalPanel from "../components/PlatformBillingLegalPanel.jsx";
import PlatformPilotLaunchPanel from "../components/PlatformPilotLaunchPanel.jsx";
import { DB } from "../lib/supabase.js";
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  formatCaseNumber,
  normalisePlatformClub,
  normaliseSupportCase,
  summarisePlatform,
  validateCaseDraft,
  validateSubscriptionChange,
} from "../lib/platform/adminModel.js";
import {
  PLAN_CATALOGUE,
  PLAN_CODES,
  SUBSCRIPTION_STATUSES,
} from "../lib/subscriptions/entitlements.js";

const PANEL_TABS = Object.freeze([
  ["clubs", "Clubs", Building2],
  ["cases", "Support cases", LifeBuoy],
  ["billing", "Billing & legal", ReceiptText],
  ["launch", "Pilot & launch", Rocket],
  ["activity", "Platform activity", Activity],
]);

const inputClass = "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const textAreaClass = "min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const buttonPrimary = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const buttonSecondary = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function formatDate(value, fallback = "—") {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function inputDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toneForStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["active", "internal", "complete", "resolved"].includes(value)) return "emerald";
  if (["trialing", "investigating", "in_progress"].includes(value)) return "sky";
  if (["grace", "waiting_on_club", "pending", "normal"].includes(value)) return "amber";
  if (["suspended", "cancelled", "urgent", "closed"].includes(value)) return "rose";
  return "slate";
}

function StatusPill({ children, tone = "slate" }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${tones[tone] || tones.slate}`}>{children}</span>;
}

function MetricCard({ label, value, helper, Icon, tone = "slate" }) {
  const iconTones = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconTones[tone] || iconTones.slate}`}><Icon size={19} /></div>
      <div className="mt-4 text-3xl font-black tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-sm font-black text-slate-800">{label}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{helper}</div>
    </div>
  );
}

function EmptyPanel({ title, message }) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <div className="text-base font-black text-slate-800">{title}</div>
      <div className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-slate-500">{message}</div>
    </div>
  );
}

function ClubRow({ club, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(club.id)}
      className={`w-full rounded-[24px] border p-4 text-left transition ${active ? "border-emerald-300 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-950">{club.name}</div>
          <div className="mt-1 truncate text-xs font-semibold text-slate-500">{club.ownerEmail || club.organisationName || "Owner details unavailable"}</div>
        </div>
        <StatusPill tone={toneForStatus(club.status)}>{club.status}</StatusPill>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill tone="sky">{club.planName}</StatusPill>
        <StatusPill tone={toneForStatus(club.subscriptionStatus)}>{club.subscriptionStatus.replaceAll("_", " ")}</StatusPill>
        {club.openCaseCount ? <StatusPill tone="amber">{club.openCaseCount} open case{club.openCaseCount === 1 ? "" : "s"}</StatusPill> : null}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[["Teams", club.teamCount], ["Pitches", club.pitchCount], ["Users", club.memberCount], ["History", club.historyCount]].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-100/80 px-2 py-2">
            <div className="text-sm font-black text-slate-800">{value}</div>
            <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</div>
          </div>
        ))}
      </div>
    </button>
  );
}

function CaseRow({ item, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`w-full rounded-[24px] border p-4 text-left transition ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{formatCaseNumber(item.caseNumber)}</div>
          <div className="mt-1 text-sm font-black text-slate-950">{item.subject}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">{item.clubName}</div>
        </div>
        <StatusPill tone={toneForStatus(item.priority)}>{item.priority}</StatusPill>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <StatusPill tone={toneForStatus(item.status)}>{item.status.replaceAll("_", " ")}</StatusPill>
        <span className="text-[11px] font-bold text-slate-400">{formatDate(item.updatedAt)}</span>
      </div>
    </button>
  );
}

export default function PlatformAdminPage({
  platformContext,
  platformStatus = "ready",
  platformError = "",
  onRefreshPlatformContext,
  memberships = [],
  onOpenClub,
}) {
  const [tab, setTab] = useState("clubs");
  const [clubs, setClubs] = useState([]);
  const [totalClubs, setTotalClubs] = useState(0);
  const [cases, setCases] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [clubDetail, setClubDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [caseDetail, setCaseDetail] = useState(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [statusConfirmation, setStatusConfirmation] = useState(null);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newCase, setNewCase] = useState({ clubId: "", subject: "", description: "", priority: "normal", requesterEmail: "" });
  const [caseUpdate, setCaseUpdate] = useState({ status: "investigating", priority: "normal", note: "" });
  const [subscriptionForm, setSubscriptionForm] = useState({
    planCode: PLAN_CODES.CORE,
    status: SUBSCRIPTION_STATUSES.ACTIVE,
    billingInterval: "monthly",
    billingExempt: false,
    trialEndsAt: "",
    graceEndsAt: "",
    currentPeriodEnd: "",
    cancelAtPeriodEnd: false,
    reason: "",
    entitlementOverrides: {},
    limitOverrides: {},
  });
  const [clubStatusReason, setClubStatusReason] = useState("");

  const loadPlatformData = useCallback(async () => {
    if (!platformContext?.isPlatformStaff) return;
    setLoading(true);
    setLoadError("");
    try {
      const [clubPayload, casePayload, activityPayload] = await Promise.all([
        DB.platformListClubs({ search, status: statusFilter, plan: planFilter, limit: 100 }),
        DB.platformListSupportCases({ limit: 200 }),
        DB.platformListActivity(50),
      ]);
      const nextClubs = (Array.isArray(clubPayload?.items) ? clubPayload.items : []).map(normalisePlatformClub);
      const nextCases = (Array.isArray(casePayload) ? casePayload : []).map(normaliseSupportCase);
      setClubs(nextClubs);
      setTotalClubs(Number(clubPayload?.total ?? nextClubs.length));
      setCases(nextCases);
      setActivity(Array.isArray(activityPayload) ? activityPayload : []);
      if (selectedClubId && !nextClubs.some((item) => item.id === selectedClubId)) {
        setSelectedClubId("");
        setClubDetail(null);
      }
    } catch (error) {
      setLoadError(error?.message || "The Daxora administration workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [planFilter, platformContext?.isPlatformStaff, search, selectedClubId, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(loadPlatformData, 180);
    return () => window.clearTimeout(timer);
  }, [loadPlatformData]);

  const loadClubDetail = useCallback(async (clubId) => {
    if (!clubId) return;
    setDetailLoading(true);
    try {
      const detail = await DB.platformGetClubDetail(clubId);
      setClubDetail(detail);
      const subscription = detail?.subscription || {};
      const record = detail?.subscription_record || {};
      setSubscriptionForm({
        planCode: subscription.plan_code || PLAN_CODES.CORE,
        status: subscription.status || SUBSCRIPTION_STATUSES.ACTIVE,
        billingInterval: subscription.billing_interval || "monthly",
        billingExempt: Boolean(subscription.billing_exempt),
        trialEndsAt: inputDate(subscription.trial_ends_at),
        graceEndsAt: inputDate(subscription.grace_ends_at),
        currentPeriodEnd: inputDate(subscription.current_period_end),
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        reason: "",
        entitlementOverrides: record.entitlement_overrides || {},
        limitOverrides: record.limit_overrides || {},
      });
      const existingClub = clubs.find((item) => item.id === clubId);
      setNewCase((current) => ({ ...current, clubId, requesterEmail: existingClub?.ownerEmail || current.requesterEmail }));
    } catch (error) {
      toast.error("Club details could not be loaded", { description: error?.message });
    } finally {
      setDetailLoading(false);
    }
  }, [clubs]);

  const selectClub = useCallback((clubId) => {
    setSelectedClubId(clubId);
    setClubDetail(null);
    loadClubDetail(clubId);
  }, [loadClubDetail]);

  const loadCaseDetail = useCallback(async (caseId) => {
    if (!caseId) return;
    setCaseLoading(true);
    try {
      const detail = await DB.platformGetSupportCase(caseId);
      setCaseDetail(detail);
      setCaseUpdate({
        status: detail?.case?.status || "investigating",
        priority: detail?.case?.priority || "normal",
        note: "",
      });
    } catch (error) {
      toast.error("Support case could not be loaded", { description: error?.message });
    } finally {
      setCaseLoading(false);
    }
  }, []);

  const selectCase = useCallback((caseId) => {
    setSelectedCaseId(caseId);
    setCaseDetail(null);
    loadCaseDetail(caseId);
  }, [loadCaseDetail]);

  const selectedClub = useMemo(() => clubs.find((item) => item.id === selectedClubId) || null, [clubs, selectedClubId]);
  const selectedCase = useMemo(() => cases.find((item) => item.id === selectedCaseId) || null, [cases, selectedCaseId]);
  const summary = useMemo(() => summarisePlatform(clubs, cases), [cases, clubs]);
  const accessibleMembership = useMemo(
    () => memberships.find((membership) => membership.clubId === selectedClubId) || null,
    [memberships, selectedClubId]
  );

  const refreshSelectedClub = useCallback(async () => {
    await loadPlatformData();
    if (selectedClubId) await loadClubDetail(selectedClubId);
  }, [loadClubDetail, loadPlatformData, selectedClubId]);

  const saveSubscription = async () => {
    if (!selectedClubId || !platformContext?.isPlatformAdmin) return;
    const errors = validateSubscriptionChange(subscriptionForm);
    if (errors.length) {
      toast.error("Plan change needs attention", { description: errors[0] });
      return;
    }
    setBusyAction("subscription");
    try {
      await DB.platformSetClubSubscription(selectedClubId, {
        planCode: subscriptionForm.planCode,
        status: subscriptionForm.status,
        billingInterval: subscriptionForm.billingInterval,
        trialEndsAt: toIsoOrNull(subscriptionForm.trialEndsAt),
        graceEndsAt: toIsoOrNull(subscriptionForm.graceEndsAt),
        currentPeriodEnd: toIsoOrNull(subscriptionForm.currentPeriodEnd),
        cancelAtPeriodEnd: subscriptionForm.cancelAtPeriodEnd,
        billingExempt: subscriptionForm.billingExempt,
        entitlementOverrides: subscriptionForm.entitlementOverrides,
        limitOverrides: subscriptionForm.limitOverrides,
        reason: subscriptionForm.reason,
      });
      toast.success("Subscription updated", { description: "The club entitlements were recalculated and audited." });
      await refreshSelectedClub();
    } catch (error) {
      toast.error("Subscription could not be updated", { description: error?.message });
    } finally {
      setBusyAction("");
    }
  };

  const requestClubStatusChange = () => {
    if (!selectedClub || !platformContext?.isPlatformAdmin) return;
    if (clubStatusReason.trim().length < 5) {
      toast.error("Enter a clear reason before changing club access");
      return;
    }
    const nextStatus = selectedClub.status === "suspended" ? "active" : "suspended";
    setStatusConfirmation({ nextStatus, reason: clubStatusReason.trim() });
  };

  const applyClubStatusChange = async () => {
    if (!selectedClubId || !statusConfirmation) return;
    setBusyAction("club-status");
    try {
      await DB.platformUpdateClubStatus(selectedClubId, statusConfirmation.nextStatus, statusConfirmation.reason);
      toast.success(statusConfirmation.nextStatus === "active" ? "Club reactivated" : "Club suspended", {
        description: "The platform action has been recorded in both club and Daxora audit history.",
      });
      setClubStatusReason("");
      setStatusConfirmation(null);
      await refreshSelectedClub();
    } catch (error) {
      toast.error("Club status could not be changed", { description: error?.message });
    } finally {
      setBusyAction("");
    }
  };

  const createCase = async () => {
    const errors = validateCaseDraft(newCase);
    if (errors.length) {
      toast.error("Support case needs attention", { description: errors[0] });
      return;
    }
    setBusyAction("case-create");
    try {
      const created = await DB.platformCreateSupportCase(newCase.clubId, newCase);
      toast.success(`Support case ${formatCaseNumber(created?.case_number)} created`);
      setNewCaseOpen(false);
      setNewCase({ clubId: selectedClubId || "", subject: "", description: "", priority: "normal", requesterEmail: selectedClub?.ownerEmail || "" });
      await loadPlatformData();
      if (created?.id) {
        setTab("cases");
        selectCase(created.id);
      }
    } catch (error) {
      toast.error("Support case could not be created", { description: error?.message });
    } finally {
      setBusyAction("");
    }
  };

  const updateCase = async () => {
    if (!selectedCaseId) return;
    setBusyAction("case-update");
    try {
      await DB.platformUpdateSupportCase(selectedCaseId, caseUpdate);
      toast.success("Support case updated");
      setCaseUpdate((current) => ({ ...current, note: "" }));
      await Promise.all([loadPlatformData(), loadCaseDetail(selectedCaseId)]);
    } catch (error) {
      toast.error("Support case could not be updated", { description: error?.message });
    } finally {
      setBusyAction("");
    }
  };

  const openClubWorkspace = async () => {
    if (!selectedClubId || typeof onOpenClub !== "function") return;
    setBusyAction("open-club");
    try {
      const opened = await onOpenClub(selectedClubId);
      if (!opened) {
        toast.error("Owner-approved access is required", {
          description: "Ask the club owner to grant a time-limited support session to your Daxora account.",
        });
      }
    } finally {
      setBusyAction("");
    }
  };

  if (platformStatus === "loading") {
    return <div className="flex min-h-[520px] items-center justify-center"><LoaderCircle className="animate-spin text-emerald-600" size={32} /></div>;
  }

  if (!platformContext?.isPlatformStaff) {
    return (
      <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><LockKeyhole size={26} /></div>
        <h1 className="mt-5 text-2xl font-black text-slate-950">Daxora platform access required</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">This workspace is available only to active Daxora support staff. Club roles do not grant platform administration rights.</p>
        {platformError ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{platformError}</div> : null}
        <button type="button" onClick={onRefreshPlatformContext} className={`${buttonSecondary} mt-6`}><RefreshCw size={16} /> Recheck access</button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="overflow-hidden rounded-[32px] bg-slate-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="emerald">Daxora internal</StatusPill>
              <StatusPill tone={platformContext.isPlatformAdmin ? "sky" : "slate"}>{platformContext.roleLabel}</StatusPill>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Platform operations</h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Manage commercial access and support workflows without bypassing club-level security. Operational club data remains unavailable until an owner grants a time-limited read-only support session.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm">
            <div className="font-black text-white">{platformContext.displayName}</div>
            <div className="mt-1 font-semibold text-slate-400">{platformContext.email}</div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Clubs" value={totalClubs || summary.clubs} helper={`${summary.activeClubs} active`} Icon={Building2} tone="slate" />
        <MetricCard label="Trials" value={summary.trials} helper={`${summary.grace} in grace`} Icon={Clock3} tone="sky" />
        <MetricCard label="Read only" value={summary.readOnlySubscriptions} helper="Subscription restricted" Icon={CirclePause} tone="amber" />
        <MetricCard label="Suspended" value={summary.suspendedClubs} helper="Platform-level suspension" Icon={AlertTriangle} tone="rose" />
        <MetricCard label="Open cases" value={summary.openCases} helper={`${summary.urgentCases} urgent`} Icon={LifeBuoy} tone={summary.urgentCases ? "rose" : "emerald"} />
        <MetricCard label="Support sessions" value={summary.activeSupportSessions} helper="Owner-approved and active" Icon={Headphones} tone="emerald" />
      </section>

      <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">
        {PANEL_TABS.map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black transition ${tab === key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            <Icon size={17} /> {label}
          </button>
        ))}
        <button type="button" onClick={loadPlatformData} disabled={loading} className={`${buttonSecondary} ml-auto`}><RefreshCw className={loading ? "animate-spin" : ""} size={16} /> Refresh</button>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-800">{loadError}</div>
      ) : null}

      {tab === "clubs" ? (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-black text-slate-950">Club workspaces</h2><p className="mt-1 text-xs font-semibold text-slate-500">Search account, plan and health metadata.</p></div>
              <button type="button" onClick={() => setNewCaseOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700" aria-label="Create support case"><Plus size={18} /></button>
            </div>
            <div className="mt-5 space-y-3">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search club or owner email" className={`${inputClass} pl-10`} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
                  <option value="">All club states</option><option value="active">Active</option><option value="suspended">Suspended</option>
                </select>
                <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)} className={inputClass}>
                  <option value="">All plans</option>
                  {Object.values(PLAN_CATALOGUE).map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-5 max-h-[820px] space-y-3 overflow-y-auto pr-1">
              {loading && !clubs.length ? <div className="flex justify-center py-12"><LoaderCircle className="animate-spin text-emerald-600" /></div> : null}
              {!loading && !clubs.length ? <EmptyPanel title="No clubs found" message="Change the search or filter criteria and try again." /> : null}
              {clubs.map((club) => <ClubRow key={club.id} club={club} active={selectedClubId === club.id} onSelect={selectClub} />)}
            </div>
          </section>

          <section className="min-w-0 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {!selectedClub ? <EmptyPanel title="Select a club" message="Choose a club workspace to review its account status, subscription, members, onboarding and support access." /> : detailLoading && !clubDetail ? (
              <div className="flex min-h-[500px] items-center justify-center"><LoaderCircle className="animate-spin text-emerald-600" size={30} /></div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><StatusPill tone={toneForStatus(selectedClub.status)}>{selectedClub.status}</StatusPill><StatusPill tone="sky">{selectedClub.planName}</StatusPill></div>
                    <h2 className="mt-3 text-2xl font-black text-slate-950">{selectedClub.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{selectedClub.organisationName}</p>
                  </div>
                  <button type="button" onClick={openClubWorkspace} disabled={busyAction === "open-club"} className={buttonPrimary}>
                    {busyAction === "open-club" ? <LoaderCircle className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                    {accessibleMembership?.accessMode === "support" ? "Open read-only workspace" : accessibleMembership ? "Open club workspace" : "Check support access"}
                  </button>
                </div>

                {!accessibleMembership ? (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 text-amber-700" size={20} /><div><div className="text-sm font-black text-amber-950">No operational access</div><p className="mt-1 text-xs font-semibold leading-5 text-amber-800">Platform metadata is visible, but fixtures and club settings remain protected. The club owner must grant a time-limited support session to <strong>{platformContext.email}</strong>.</p></div></div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {[["Members", clubDetail?.counts?.members ?? selectedClub.memberCount, UsersRound], ["Teams", clubDetail?.counts?.teams ?? selectedClub.teamCount, UserRound], ["Pitches", clubDetail?.counts?.pitches ?? selectedClub.pitchCount, Building2], ["Venues", clubDetail?.counts?.venues ?? selectedClub.venueCount, Building2], ["History", clubDetail?.counts?.history ?? selectedClub.historyCount, Clock3]].map(([label, value, Icon]) => (
                    <div key={label} className="rounded-2xl bg-slate-50 p-4"><Icon size={17} className="text-slate-400" /><div className="mt-3 text-2xl font-black text-slate-900">{value}</div><div className="text-xs font-bold text-slate-500">{label}</div></div>
                  ))}
                </div>

                <div className="grid gap-6 2xl:grid-cols-2">
                  <div className="rounded-[26px] border border-slate-200 p-5">
                    <div className="flex items-center gap-2"><BadgePoundSterling className="text-emerald-700" size={20} /><h3 className="text-base font-black text-slate-950">Subscription controls</h3></div>
                    {!platformContext.isPlatformAdmin ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-600">Support operators can review subscriptions but cannot change commercial access.</div> : null}
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-black text-slate-600">Plan<select disabled={!platformContext.isPlatformAdmin} value={subscriptionForm.planCode} onChange={(event) => setSubscriptionForm((current) => ({ ...current, planCode: event.target.value }))} className={`${inputClass} mt-2`}>
                        {Object.values(PLAN_CATALOGUE).map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
                      </select></label>
                      <label className="text-xs font-black text-slate-600">Status<select disabled={!platformContext.isPlatformAdmin} value={subscriptionForm.status} onChange={(event) => setSubscriptionForm((current) => ({ ...current, status: event.target.value }))} className={`${inputClass} mt-2`}>
                        {Object.values(SUBSCRIPTION_STATUSES).map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                      </select></label>
                      <label className="text-xs font-black text-slate-600">Billing interval<select disabled={!platformContext.isPlatformAdmin} value={subscriptionForm.billingInterval} onChange={(event) => setSubscriptionForm((current) => ({ ...current, billingInterval: event.target.value }))} className={`${inputClass} mt-2`}><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="manual">Manual</option></select></label>
                      <label className="flex items-end gap-3 rounded-2xl border border-slate-200 p-3 text-xs font-black text-slate-600"><input disabled={!platformContext.isPlatformAdmin} type="checkbox" checked={subscriptionForm.billingExempt} onChange={(event) => setSubscriptionForm((current) => ({ ...current, billingExempt: event.target.checked }))} className="h-5 w-5 rounded border-slate-300" /> Billing exempt</label>
                      {subscriptionForm.status === "trialing" ? <label className="text-xs font-black text-slate-600">Trial ends<input disabled={!platformContext.isPlatformAdmin} type="datetime-local" value={subscriptionForm.trialEndsAt} onChange={(event) => setSubscriptionForm((current) => ({ ...current, trialEndsAt: event.target.value }))} className={`${inputClass} mt-2`} /></label> : null}
                      {subscriptionForm.status === "grace" ? <label className="text-xs font-black text-slate-600">Grace ends<input disabled={!platformContext.isPlatformAdmin} type="datetime-local" value={subscriptionForm.graceEndsAt} onChange={(event) => setSubscriptionForm((current) => ({ ...current, graceEndsAt: event.target.value }))} className={`${inputClass} mt-2`} /></label> : null}
                      <label className="text-xs font-black text-slate-600">Current period ends<input disabled={!platformContext.isPlatformAdmin} type="datetime-local" value={subscriptionForm.currentPeriodEnd} onChange={(event) => setSubscriptionForm((current) => ({ ...current, currentPeriodEnd: event.target.value }))} className={`${inputClass} mt-2`} /></label>
                      <label className="flex items-end gap-3 rounded-2xl border border-slate-200 p-3 text-xs font-black text-slate-600"><input disabled={!platformContext.isPlatformAdmin} type="checkbox" checked={subscriptionForm.cancelAtPeriodEnd} onChange={(event) => setSubscriptionForm((current) => ({ ...current, cancelAtPeriodEnd: event.target.checked }))} className="h-5 w-5 rounded border-slate-300" /> Cancel at period end</label>
                    </div>
                    <label className="mt-4 block text-xs font-black text-slate-600">Reason for change<textarea disabled={!platformContext.isPlatformAdmin} value={subscriptionForm.reason} onChange={(event) => setSubscriptionForm((current) => ({ ...current, reason: event.target.value }))} className={`${textAreaClass} mt-2`} placeholder="Explain the commercial or support reason." /></label>
                    <button type="button" disabled={!platformContext.isPlatformAdmin || busyAction === "subscription"} onClick={saveSubscription} className={`${buttonPrimary} mt-4 w-full`}>{busyAction === "subscription" ? <LoaderCircle className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Apply and audit subscription</button>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-[26px] border border-slate-200 p-5">
                      <div className="flex items-center gap-2"><ShieldCheck className="text-sky-700" size={20} /><h3 className="text-base font-black text-slate-950">Account control</h3></div>
                      <div className="mt-4 flex flex-wrap gap-2"><StatusPill tone={toneForStatus(selectedClub.status)}>Club: {selectedClub.status}</StatusPill><StatusPill tone={toneForStatus(selectedClub.onboardingStatus)}>Onboarding: {selectedClub.onboardingStatus.replaceAll("_", " ")}</StatusPill></div>
                      <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">A platform suspension blocks the club from opening its workspace. Subscription suspension keeps the workspace readable but prevents changes. Use the correct control for the situation.</p>
                      <label className="mt-4 block text-xs font-black text-slate-600">Reason<textarea disabled={!platformContext.isPlatformAdmin} value={clubStatusReason} onChange={(event) => setClubStatusReason(event.target.value)} className={`${textAreaClass} mt-2`} placeholder="Explain why this workspace is being suspended or restored." /></label>
                      <button type="button" disabled={!platformContext.isPlatformAdmin} onClick={requestClubStatusChange} className={`${selectedClub.status === "suspended" ? buttonPrimary : "inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50"} mt-4 w-full`}>
                        {selectedClub.status === "suspended" ? <CheckCircle2 size={16} /> : <CirclePause size={16} />}{selectedClub.status === "suspended" ? "Reactivate club workspace" : "Suspend club workspace"}
                      </button>
                    </div>

                    <div className="rounded-[26px] border border-slate-200 p-5">
                      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><TicketCheck className="text-amber-700" size={20} /><h3 className="text-base font-black text-slate-950">Support cases</h3></div><button type="button" onClick={() => setNewCaseOpen(true)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">New case</button></div>
                      <div className="mt-4 space-y-2">
                        {(clubDetail?.cases || []).length ? clubDetail.cases.map((caseRow) => (
                          <button key={caseRow.id} type="button" onClick={() => { setTab("cases"); selectCase(caseRow.id); }} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-left hover:bg-slate-100">
                            <div><div className="text-xs font-black text-slate-800">{formatCaseNumber(caseRow.case_number)} · {caseRow.subject}</div><div className="mt-1 text-[11px] font-semibold text-slate-500">Updated {formatDate(caseRow.updated_at)}</div></div><StatusPill tone={toneForStatus(caseRow.status)}>{String(caseRow.status).replaceAll("_", " ")}</StatusPill>
                          </button>
                        )) : <div className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">No support cases have been recorded for this club.</div>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 2xl:grid-cols-2">
                  <div className="rounded-[26px] border border-slate-200 p-5">
                    <h3 className="text-base font-black text-slate-950">Club members</h3>
                    <div className="mt-4 space-y-2">
                      {(clubDetail?.members || []).map((member) => <div key={member.user_id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3"><div className="min-w-0"><div className="truncate text-xs font-black text-slate-800">{member.display_name || member.email}</div><div className="truncate text-[11px] font-semibold text-slate-500">{member.email}</div></div><StatusPill tone={member.role === "owner" ? "emerald" : "slate"}>{member.role}</StatusPill></div>)}
                    </div>
                  </div>
                  <div className="rounded-[26px] border border-slate-200 p-5">
                    <h3 className="text-base font-black text-slate-950">Recent club audit</h3>
                    <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                      {(clubDetail?.recent_audit || []).map((event) => <div key={event.id} className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-black text-slate-800">{event.action}</div><div className="mt-1 text-[11px] font-semibold text-slate-500">{event.actor_label || event.actor_role} · {formatDate(event.created_at)}</div></div>)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === "cases" ? (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">Support queue</h2><p className="mt-1 text-xs font-semibold text-slate-500">Internal case tracking for launch support.</p></div><button type="button" onClick={() => setNewCaseOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white"><Plus size={18} /></button></div>
            <div className="mt-5 max-h-[820px] space-y-3 overflow-y-auto pr-1">
              {!cases.length ? <EmptyPanel title="No support cases" message="Create a case when a club needs help or an issue requires follow-up." /> : cases.map((item) => <CaseRow key={item.id} item={item} active={selectedCaseId === item.id} onSelect={selectCase} />)}
            </div>
          </section>
          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {!selectedCase ? <EmptyPanel title="Select a support case" message="Choose a case to review its history, change its status and add an internal note." /> : caseLoading && !caseDetail ? <div className="flex min-h-[500px] items-center justify-center"><LoaderCircle className="animate-spin text-emerald-600" size={30} /></div> : (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-5"><div className="flex flex-wrap items-center gap-2"><StatusPill tone={toneForStatus(selectedCase.priority)}>{selectedCase.priority}</StatusPill><StatusPill tone={toneForStatus(selectedCase.status)}>{selectedCase.status.replaceAll("_", " ")}</StatusPill></div><div className="mt-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{formatCaseNumber(selectedCase.caseNumber)}</div><h2 className="mt-1 text-2xl font-black text-slate-950">{selectedCase.subject}</h2><p className="mt-2 text-sm font-semibold text-slate-500">{selectedCase.clubName}</p></div>
                <div className="rounded-[26px] bg-slate-50 p-5"><div className="text-xs font-black uppercase tracking-wide text-slate-400">Description</div><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{caseDetail?.case?.description || selectedCase.description || "No description was recorded."}</p></div>
                <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Status<select value={caseUpdate.status} onChange={(event) => setCaseUpdate((current) => ({ ...current, status: event.target.value }))} className={`${inputClass} mt-2`}>{CASE_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label><label className="text-xs font-black text-slate-600">Priority<select value={caseUpdate.priority} onChange={(event) => setCaseUpdate((current) => ({ ...current, priority: event.target.value }))} className={`${inputClass} mt-2`}>{CASE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label></div>
                <label className="block text-xs font-black text-slate-600">Internal note<textarea value={caseUpdate.note} onChange={(event) => setCaseUpdate((current) => ({ ...current, note: event.target.value }))} className={`${textAreaClass} mt-2`} placeholder="Record what was checked, agreed or completed." /></label>
                <button type="button" onClick={updateCase} disabled={busyAction === "case-update"} className={buttonPrimary}>{busyAction === "case-update" ? <LoaderCircle className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Update support case</button>
                <div><h3 className="text-base font-black text-slate-950">Case notes</h3><div className="mt-4 space-y-3">{(caseDetail?.notes || []).length ? caseDetail.notes.map((note) => <div key={note.id} className="rounded-2xl border border-slate-200 p-4"><p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{note.body}</p><div className="mt-3 text-[11px] font-bold text-slate-400">{note.created_by_name || "Daxora operator"} · {formatDate(note.created_at)}</div></div>) : <div className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">No notes have been added yet.</div>}</div></div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === "billing" ? (
        <PlatformBillingLegalPanel isPlatformAdmin={platformContext.isPlatformAdmin} />
      ) : null}

      {tab === "launch" ? (
        <PlatformPilotLaunchPanel clubs={clubs} isPlatformAdmin={platformContext.isPlatformAdmin} />
      ) : null}

      {tab === "activity" ? (
        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-black text-slate-950">Platform activity</h2><p className="mt-1 text-xs font-semibold text-slate-500">Sensitive Daxora administration and support actions are recorded separately from club activity.</p>
          <div className="mt-5 space-y-3">{activity.length ? activity.map((event) => <div key={event.id} className="flex flex-col gap-3 rounded-[22px] border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-black text-slate-900">{event.action}</div><div className="mt-1 text-xs font-semibold text-slate-500">{event.actor_name || "Daxora operator"}{event.club_name ? ` · ${event.club_name}` : ""}</div></div><div className="text-xs font-bold text-slate-400">{formatDate(event.created_at)}</div></div>) : <EmptyPanel title="No platform activity yet" message="Plan changes, club status changes and support-case actions will appear here." />}</div>
        </section>
      ) : null}

      {newCaseOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" aria-label="Close new case" className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={() => !busyAction && setNewCaseOpen(false)} />
          <section role="dialog" aria-modal="true" aria-labelledby="new-support-case-title" className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[30px] bg-white p-6 shadow-2xl">
            <button type="button" onClick={() => setNewCaseOpen(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
            <h2 id="new-support-case-title" className="text-xl font-black text-slate-950">Create support case</h2><p className="mt-2 text-sm font-semibold text-slate-500">Record the issue before opening any owner-approved support session.</p>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-black text-slate-600">Club<select value={newCase.clubId} onChange={(event) => setNewCase((current) => ({ ...current, clubId: event.target.value }))} className={`${inputClass} mt-2`}><option value="">Select club</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
              <label className="block text-xs font-black text-slate-600">Subject<input value={newCase.subject} onChange={(event) => setNewCase((current) => ({ ...current, subject: event.target.value }))} className={`${inputClass} mt-2`} /></label>
              <label className="block text-xs font-black text-slate-600">Description<textarea value={newCase.description} onChange={(event) => setNewCase((current) => ({ ...current, description: event.target.value }))} className={`${textAreaClass} mt-2`} /></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Priority<select value={newCase.priority} onChange={(event) => setNewCase((current) => ({ ...current, priority: event.target.value }))} className={`${inputClass} mt-2`}>{CASE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label><label className="text-xs font-black text-slate-600">Requester email<input type="email" value={newCase.requesterEmail} onChange={(event) => setNewCase((current) => ({ ...current, requesterEmail: event.target.value }))} className={`${inputClass} mt-2`} /></label></div>
              <button type="button" onClick={createCase} disabled={busyAction === "case-create"} className={`${buttonPrimary} w-full`}>{busyAction === "case-create" ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />} Create and assign to me</button>
            </div>
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(statusConfirmation)}
        title={statusConfirmation?.nextStatus === "active" ? "Reactivate this club?" : "Suspend this club workspace?"}
        description={statusConfirmation?.nextStatus === "active" ? "The club will be able to open Ground Control again. Subscription restrictions will still apply separately." : "All club members will be blocked from opening the workspace until a platform administrator reactivates it."}
        confirmLabel={statusConfirmation?.nextStatus === "active" ? "Reactivate club" : "Suspend club"}
        tone={statusConfirmation?.nextStatus === "active" ? "warning" : "danger"}
        busy={busyAction === "club-status"}
        onCancel={() => setStatusConfirmation(null)}
        onConfirm={applyClubStatusChange}
      />
    </div>
  );
}
