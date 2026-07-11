import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  History,
  Loader2,
  Mail,
  MessageSquareText,
  RadioTower,
  Phone,
  Send,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import PageContainer from "../ui/PageContainer.jsx";
import PageHeader from "../ui/PageHeader.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import StatusChip from "../ui/StatusChip.jsx";
import Card from "../ui/Card.jsx";
import { buildCommunicationsModel } from "../lib/communications/communicationsEngine.js";
import { maskContactDestination } from "../lib/communications/contactModel.js";
import { communicationPrivacyGaps, normaliseCommunicationPrivacy } from "../lib/communications/privacyModel.js";
import { DB } from "../lib/supabase.js";
import {
  buildDeliveryMessages,
  dispatchCommunicationBatch,
  EMPTY_DELIVERY_CAPABILITIES,
  loadDeliveryCapabilities,
} from "../lib/communications/deliveryService.js";

const FILTERS = [
  ["all", "All"],
  ["ready", "Ready"],
  ["review", "Needs review"],
  ["blocked", "Blocked"],
];

function SummaryCard({ icon: Icon, label, value, detail, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
  };
  return (
    <div className={`rounded-[22px] border p-4 ${tones[tone] || tones.slate}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] opacity-60">{label}</div>
          <div className="mt-2 text-2xl font-black">{value}</div>
          <div className="mt-1 text-xs font-semibold opacity-70">{detail}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-black/5"><Icon size={19} /></div>
      </div>
    </div>
  );
}

function readiness(row) {
  if (row.readyState === "ready") return { tone: "success", label: "Ready" };
  if (row.readyState === "review") return { tone: "warning", label: "Review first" };
  return { tone: "danger", label: "Blocked" };
}

function statusLabel(status) {
  if (status === "postponed") return "Postponement update";
  if (status === "cancelled") return "Cancellation update";
  if (status === "unresolved") return "Holding update";
  return "Match details";
}

function eventLabel(action) {
  return {
    queue_opened: "Queue opened",
    reviewed: "Reviewed",
    copied: "Copied",
    channel_opened: "External channel opened",
    queued: "Queued for provider",
    send_attempted: "Provider attempt",
    provider_accepted: "Accepted by provider",
    sent: "Provider confirmed sent",
    delivered: "Provider confirmed delivered",
    read: "Provider confirmed read",
    undelivered: "Undelivered",
    failed: "Failed",
    cancelled: "Cancelled",
  }[action] || action;
}

function communicationLink(recipient, message, teamName) {
  if (!recipient?.destination) return "";
  const body = encodeURIComponent(message);
  if (recipient.channel === "email") {
    return `mailto:${recipient.destination}?subject=${encodeURIComponent(`${teamName} matchday details`)}&body=${body}`;
  }
  if (recipient.channel === "sms") return `sms:${recipient.destination}?body=${body}`;
  const digits = String(recipient.destination).replace(/\D/g, "").replace(/^0/, "44");
  return digits ? `https://wa.me/${digits}?text=${body}` : "";
}

function QueueModal({ rows, selected, setSelected, privacy, capabilities, sending, onClose, onCopySelected, onOpenChannel, onSendWeb }) {
  const gaps = communicationPrivacyGaps(privacy);
  const selectedRows = rows.filter((row) => selected[row.id]);
  const webEligibleRows = selectedRows.filter((row) => Boolean(row.contact?.privacyNoticeProvidedAt));
  const noticeMissingRows = selectedRows.filter((row) => !row.contact?.privacyNoticeProvidedAt);
  const webPlan = buildDeliveryMessages(webEligibleRows, capabilities);
  const emailPilot = Boolean(capabilities.channels?.email?.pilotMode);
  const pilotMaxBatch = Number(capabilities.channels?.email?.maxBatch) || 5;
  const pilotBatchTooLarge = emailPilot && webPlan.messages.length > pilotMaxBatch;
  const canCopy = !gaps.length && selectedRows.length;
  const canSendWeb = !gaps.length && webPlan.messages.length > 0 && !pilotBatchTooLarge && !sending;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Coach message queue">
      <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Coach message queue</div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Review messages before using an external channel</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">Ground Control prepares and audits the queue. Copying or opening WhatsApp, SMS or email does not prove the message was sent or delivered.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Close queue"><X size={18} /></button>
        </div>

        {gaps.length ? (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-950 sm:px-6">
            <strong>Privacy setup required:</strong> complete {gaps.join(" · ")} in Settings → Privacy & contacts before copying or sending the bulk queue.
          </div>
        ) : null}

        <div className={`border-b px-5 py-4 sm:px-6 ${capabilities.webSendingEnabled ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <RadioTower size={18} className={`mt-0.5 shrink-0 ${capabilities.webSendingEnabled ? "text-emerald-700" : "text-slate-500"}`} />
              <div>
                <div className={`text-sm font-black ${capabilities.webSendingEnabled ? "text-emerald-950" : "text-slate-800"}`}>
                  {emailPilot ? "Staging email pilot is active" : capabilities.webSendingEnabled ? "Secure web sending is available" : "Web sending is prepared but not switched on"}
                </div>
                <div className={`mt-1 text-xs font-semibold ${capabilities.webSendingEnabled ? "text-emerald-800" : "text-slate-500"}`}>
                  {emailPilot
                    ? `Every provider email is redirected to ${capabilities.channels.email.pilotRecipientHint}. Coaches will not receive these test emails. The pilot limit is ${pilotMaxBatch} recipients per batch.${pilotBatchTooLarge ? " Reduce the selection before continuing." : ""}`
                    : capabilities.webSendingEnabled
                      ? `${webPlan.messages.length} selected recipient${webPlan.messages.length === 1 ? "" : "s"} can be sent through configured providers.${webPlan.unavailable.length ? ` ${webPlan.unavailable.length} will remain external-channel only.` : ""}${noticeMissingRows.length ? ` ${noticeMissingRows.length} team${noticeMissingRows.length === 1 ? " is" : "s are"} excluded until the privacy notice is recorded.` : ""}`
                      : "Add server-side provider credentials and channel flags in Vercel before live delivery can occur."}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {["email", "sms", "whatsapp"].map((channel) => {
                const item = capabilities.channels?.[channel];
                const label = channel === "email" && item?.pilotMode ? "Pilot ready" : item?.enabled ? "Ready" : "Not configured";
                return <StatusChip key={channel} status={item?.enabled ? "success" : "neutral"} size="sm">{channel} · {label}</StatusChip>;
              })}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="space-y-3">
            {rows.map((row) => {
              const checked = Boolean(selected[row.id]);
              return (
                <article key={row.id} className={`rounded-2xl border p-4 ${checked ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
                  <div className="flex flex-wrap items-start gap-4">
                    <input type="checkbox" checked={checked} onChange={(event) => setSelected((current) => ({ ...current, [row.id]: event.target.checked }))} className="mt-1 h-4 w-4 rounded border-slate-300 accent-emerald-600" aria-label={`Select ${row.teamName}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-slate-950">{row.teamName}</h3>
                        <StatusChip status="success" size="sm">{row.recipients.length} recipient{row.recipients.length === 1 ? "" : "s"}</StatusChip>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{row.dateLabel} · {row.ko} · {row.pitch}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.recipients.map((recipient) => (
                          <button key={`${row.id}-${recipient.type}`} type="button" onClick={() => onOpenChannel(row, recipient)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:border-emerald-300 hover:text-emerald-800">
                            <ExternalLink size={14} /> {recipient.name} · {recipient.channel} · {maskContactDestination(recipient.destination)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="text-sm font-bold text-slate-600">{selectedRows.length} message{selectedRows.length === 1 ? "" : "s"} selected · {webPlan.messages.length} web recipient{webPlan.messages.length === 1 ? "" : "s"}{noticeMissingRows.length ? ` · ${noticeMissingRows.length} privacy notice missing` : ""}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClose} disabled={sending} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40">Close</button>
            <button type="button" onClick={() => onCopySelected(selectedRows)} disabled={!canCopy || sending} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><Copy size={17} /> Copy selected messages</button>
            <button type="button" onClick={() => onSendWeb(webEligibleRows)} disabled={!canSendWeb} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
              {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              {sending ? "Sending securely…" : emailPilot ? "Send staging email test" : capabilities.webSendingEnabled ? "Send selected via web" : "Web sending not configured"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function CommunicationsPage(props) {
  const model = useMemo(() => buildCommunicationsModel(props), [props]);
  const privacy = useMemo(() => normaliseCommunicationPrivacy(props.communicationPrivacy), [props.communicationPrivacy]);
  const [day, setDay] = useState("all");
  const [filter, setFilter] = useState("all");
  const [queueOpen, setQueueOpen] = useState(false);
  const [selected, setSelected] = useState({});
  const [events, setEvents] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deliveryCapabilities, setDeliveryCapabilities] = useState(EMPTY_DELIVERY_CAPABILITIES);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const auditAvailable = Boolean(props.activeClubId && props.communicationSchemaReady && props.workspaceAccess?.canOperate);

  const rows = model.rows.filter((row) => {
    if (day !== "all" && row.day !== day) return false;
    if (filter !== "all" && row.readyState !== filter) return false;
    return true;
  });
  const readyRows = rows.filter((row) => row.readyState === "ready" && row.recipients.length && row.contact.receiveMatchdayMessages);

  const loadEvents = useCallback(async () => {
    if (!auditAvailable) {
      setEvents([]);
      return;
    }
    setHistoryLoading(true);
    try {
      setEvents(await DB.listCommunicationEvents(props.activeClubId, 50));
    } catch (error) {
      toast.error("Communication history could not be loaded", { description: error?.message });
    } finally {
      setHistoryLoading(false);
    }
  }, [auditAvailable, props.activeClubId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    let active = true;
    setCapabilitiesLoading(true);
    loadDeliveryCapabilities()
      .then((value) => {
        if (active) setDeliveryCapabilities(value);
      })
      .finally(() => {
        if (active) setCapabilitiesLoading(false);
      });
    return () => { active = false; };
  }, []);

  const record = async (row, action, recipient = null, detail = {}, refresh = true) => {
    if (!auditAvailable) return null;
    try {
      const event = {
        messageKey: row?.id || `queue:${new Date().toISOString().slice(0, 10)}`,
        messageHash: row?.messageHash || "",
        fixtureId: row?.raw?.id || row?.raw?.fixtureId || null,
        teamKey: row?.contact?.teamKey || null,
        teamName: row?.teamName || "Matchweek queue",
        action,
        channel: recipient?.channel || (action === "copied" ? "copy" : "other"),
        recipientType: recipient?.type || (row?.recipients?.length > 1 ? "multiple" : row?.recipients?.[0]?.type || null),
        recipientLabel: recipient?.name || row?.recipients?.map((item) => item.name).join(", ") || "",
        recipientHint: recipient ? maskContactDestination(recipient.destination) : row?.recipients?.map((item) => maskContactDestination(item.destination)).join(", ") || "",
        detail,
      };
      await DB.recordCommunicationEvent(props.activeClubId, event);
      if (refresh) await loadEvents();
      return true;
    } catch (error) {
      toast.warning("Action completed, but the shared audit trail was not updated", { description: error?.message });
      return false;
    }
  };

  const openQueue = async () => {
    setSelected(Object.fromEntries(readyRows.map((row) => [row.id, true])));
    setQueueOpen(true);
    await record(null, "queue_opened", null, { readyMessages: readyRows.length, totalMessages: model.counts.total });
  };

  const copyMessage = async (row) => {
    if (row.readyState === "blocked") {
      toast.error("Message is blocked", { description: row.issues.join(" · ") || "Resolve the fixture allocation first." });
      return;
    }
    try {
      await navigator.clipboard.writeText(row.message);
      await record(row, "copied");
      toast.success("Message copied", { description: `${row.teamName} · external delivery is not tracked.` });
    } catch {
      toast.error("Copy failed", { description: "Select the message text and copy it manually." });
    }
  };

  const markReviewed = async (row) => {
    await record(row, "reviewed");
    toast.success("Review recorded", { description: row.teamName });
  };

  const copySelected = async (selectedRows) => {
    if (!selectedRows.length) return;
    try {
      const preparedCopies = selectedRows.flatMap((row) => row.recipients.map((recipient) => `${row.teamName}\nRecipient: ${recipient.name} (${recipient.channel})\n\n${recipient.message || row.message}`));
      await navigator.clipboard.writeText(preparedCopies.join("\n\n--------------------\n\n"));
      await Promise.all(selectedRows.map((row) => record(row, "copied", null, { bulk: true }, false)));
      await loadEvents();
      toast.success(`${selectedRows.length} messages copied`, { description: "Use the queue to open each chosen external channel. Delivery is not tracked." });
      setQueueOpen(false);
    } catch {
      toast.error("Bulk copy failed");
    }
  };

  const openChannel = async (row, recipient) => {
    const link = communicationLink(recipient, recipient.message || row.message, row.teamName);
    if (!link) {
      toast.error("Contact destination is incomplete");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
    await record(row, "channel_opened", recipient);
  };

  const sendSelectedViaWeb = async (selectedRows) => {
    const webEligibleRows = selectedRows.filter((row) => Boolean(row.contact?.privacyNoticeProvidedAt));
    const plan = buildDeliveryMessages(webEligibleRows, deliveryCapabilities);
    if (!plan.messages.length) {
      toast.error("No configured web recipients", { description: "Enable an email, SMS or WhatsApp provider in Vercel first." });
      return;
    }
    const warning = plan.unavailable.length
      ? ` ${plan.unavailable.length} recipient${plan.unavailable.length === 1 ? "" : "s"} use a channel that is not configured and will not be sent.`
      : "";
    const emailPilot = Boolean(deliveryCapabilities.channels?.email?.pilotMode);
    const pilotMaxBatch = Number(deliveryCapabilities.channels?.email?.maxBatch) || 5;
    if (emailPilot && plan.messages.length > pilotMaxBatch) {
      toast.error("Staging pilot batch limit exceeded", { description: `Select no more than ${pilotMaxBatch} email recipients.` });
      return;
    }
    const confirmation = emailPilot
      ? `Send ${plan.messages.length} staging test email${plan.messages.length === 1 ? "" : "s"}? Every email will be redirected to ${deliveryCapabilities.channels.email.pilotRecipientHint}. No coach will receive these messages.${warning}`
      : `Send ${plan.messages.length} real coach message${plan.messages.length === 1 ? "" : "s"} through the configured provider?${warning}`;
    const confirmed = window.confirm(confirmation);
    if (!confirmed) return;

    setSending(true);
    try {
      const requestKey = globalThis.crypto?.randomUUID?.() || `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await dispatchCommunicationBatch({
        clubId: props.activeClubId,
        rows: webEligibleRows,
        capabilities: deliveryCapabilities,
        requestKey,
      });
      await loadEvents();
      if (result.failed) {
        toast.warning(`${result.accepted} accepted, ${result.failed} failed`, { description: "Open the audit trail before retrying failed recipients." });
      } else {
        toast.success(`${result.accepted} message${result.accepted === 1 ? "" : "s"} accepted by provider`, { description: emailPilot ? "The staging inbox will receive redirected test emails. Provider delivery status remains separate." : "Delivery status will update only when the provider confirms it." });
      }
      if (result.unavailable?.length) {
        toast.info(`${result.unavailable.length} recipient${result.unavailable.length === 1 ? "" : "s"} not sent`, { description: "Their preferred channel is not configured for web sending." });
      }
      setQueueOpen(false);
    } catch (error) {
      toast.error("Coach messages were not sent", { description: error?.message || "The provider request failed." });
    } finally {
      setSending(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Matchweek communications"
        title="Communications"
        subtitle="Prepare one coach-message queue, send through configured web providers or use the audited copy-out fallback, and track only provider-confirmed delivery states."
        action={model.counts.total ? (
          <button type="button" onClick={openQueue} disabled={!props.communicationSchemaReady} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
            <Send size={17} /> Send coach messages
          </button>
        ) : null}
      />

      {!props.communicationSchemaReady ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950"><strong>Secure communications migration required.</strong> Apply the included Supabase migration before coach contacts or shared communication history are used.</div>
      ) : !privacy.configured ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950"><strong>Privacy setup is incomplete.</strong> Open Settings → Privacy & contacts before copying a bulk message queue.</div>
      ) : (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-950"><ShieldCheck size={19} className="mt-0.5 shrink-0" /><span>Coach contact access is restricted and communication events are retained for {privacy.retentionDays} days under the club's recorded privacy setup.</span></div>
      )}

      <div className={`mb-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${deliveryCapabilities.webSendingEnabled ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
        <div className="flex items-start gap-3">
          {capabilitiesLoading ? <Loader2 size={19} className="mt-0.5 shrink-0 animate-spin text-slate-500" /> : <RadioTower size={19} className={`mt-0.5 shrink-0 ${deliveryCapabilities.webSendingEnabled ? "text-emerald-700" : "text-slate-500"}`} />}
          <div>
            <div className={`text-sm font-black ${deliveryCapabilities.webSendingEnabled ? "text-emerald-950" : "text-slate-800"}`}>
              {capabilitiesLoading ? "Checking web-delivery providers…" : deliveryCapabilities.channels?.email?.pilotMode ? "Staging email pilot ready" : deliveryCapabilities.webSendingEnabled ? "Web delivery ready" : "Web delivery foundation installed"}
            </div>
            <div className={`mt-1 text-xs font-semibold leading-5 ${deliveryCapabilities.webSendingEnabled ? "text-emerald-800" : "text-slate-500"}`}>
              {deliveryCapabilities.channels?.email?.pilotMode
                ? `Email is enabled only for the staging pilot. Every provider email is redirected to ${deliveryCapabilities.channels.email.pilotRecipientHint}; saved coach contacts will not receive it.`
                : deliveryCapabilities.webSendingEnabled
                  ? "Only enabled server-side channels can send. Provider acceptance, delivery and failure callbacks are recorded separately."
                  : "No provider is enabled, so Ground Control cannot send anything automatically. Existing copy, WhatsApp, SMS and email hand-off actions remain available."}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["email", "sms", "whatsapp"].map((channel) => {
            const item = deliveryCapabilities.channels?.[channel];
            const label = channel === "email" && item?.pilotMode ? "Pilot" : item?.enabled ? "Ready" : "Off";
            return <StatusChip key={channel} status={item?.enabled ? "success" : "neutral"} size="sm">{channel} · {label}</StatusChip>;
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={MessageSquareText} label="Prepared" value={model.counts.total} detail={`${model.counts.recipients} adult recipient records`} />
        <SummaryCard icon={CheckCircle2} label="Ready" value={model.counts.ready} detail="Complete and contact-linked" tone="green" />
        <SummaryCard icon={AlertTriangle} label="Needs review" value={model.counts.review} detail="Check before including" tone="amber" />
        <SummaryCard icon={ShieldAlert} label="Blocked" value={model.counts.blocked} detail="Allocation must be resolved" tone="rose" />
      </div>

      <Card eyebrow="Review queue" title="Coach messages" subtitle={model.disclaimer}>
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {model.days.map((item) => (
              <button key={item.value} type="button" onClick={() => setDay(item.value)} className={`rounded-xl px-3 py-2 text-xs font-black transition ${day === item.value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {item.label} <span className="opacity-60">{item.count}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-xl border px-3 py-2 text-xs font-black transition ${filter === value ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {!model.rows.length ? (
          <EmptyState title="No communications are ready" description="Build a Saturday, Sunday or Midweek schedule to prepare coach messages." />
        ) : !rows.length ? (
          <EmptyState title="No messages match this view" description="Change the day or review filter." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {rows.map((row) => {
              const state = readiness(row);
              const latest = events.find((event) => event.message_key === row.id && event.message_hash === row.messageHash);
              return (
                <article key={row.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip status={state.tone} size="sm">{state.label}</StatusChip>
                        <StatusChip status={row.status === "scheduled" ? "neutral" : row.status === "cancelled" ? "danger" : "warning"} size="sm">{statusLabel(row.status)}</StatusChip>
                        {latest ? <StatusChip status="info" size="sm">{eventLabel(latest.action)}</StatusChip> : null}
                      </div>
                      <h3 className="mt-3 text-xl font-black text-slate-950">{row.teamName}</h3>
                      <div className="mt-1 text-sm font-semibold text-slate-500">{row.dateLabel} · {row.ko} · {row.pitch}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right ring-1 ring-slate-200">
                      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Recipients</div>
                      <div className="mt-1 text-sm font-black text-slate-900">{row.recipients.length || "None"}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                    {row.recipients.map((recipient) => (
                      <span key={recipient.type} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
                        {recipient.channel === "email" ? <Mail size={13} /> : <Phone size={13} />}
                        {recipient.name} · {maskContactDestination(recipient.destination)}
                      </span>
                    ))}
                    {!row.recipients.length ? <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-amber-800"><UsersRound size={13} />Add contact in Team settings</span> : null}
                  </div>

                  {row.issues.length ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Review before queueing</div>
                      <div className="mt-2 text-sm font-bold leading-6 text-amber-950">{row.issues.join(" · ")}</div>
                    </div>
                  ) : null}

                  <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 font-sans text-sm font-semibold leading-6 text-slate-700">{row.message}</pre>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {row.readyState !== "blocked" ? (
                      <button type="button" onClick={() => markReviewed(row)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><ClipboardCheck size={15} /> Record review</button>
                    ) : null}
                    <button type="button" onClick={() => copyMessage(row)} disabled={row.readyState === "blocked"} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><Copy size={15} /> Copy individually</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Card eyebrow="Shared audit trail" title="Recent communication activity" subtitle="Records queue, copy-out and provider activity. Sent, delivered or read states appear only after a configured provider returns that status.">
        {historyLoading ? (
          <div className="py-8 text-center text-sm font-bold text-slate-500">Loading communication history…</div>
        ) : !events.length ? (
          <EmptyState icon={History} title="No communication activity recorded" description="Open the coach-message queue, review or copy a message to create the first shared audit event." />
        ) : (
          <div className="divide-y divide-slate-100">
            {events.slice(0, 20).map((event) => (
              <div key={event.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-slate-950">{event.team_name || "Matchweek queue"}</span><StatusChip status={["sent", "delivered", "read"].includes(event.action) ? "success" : ["failed", "undelivered"].includes(event.action) ? "danger" : event.action === "provider_accepted" ? "info" : "neutral"} size="sm">{eventLabel(event.action)}</StatusChip></div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{event.recipient_label || "No recipient stored"}{event.recipient_hint ? ` · ${event.recipient_hint}` : ""} · {event.actor_label || "Club operator"}</div>
                </div>
                <div className="text-xs font-bold text-slate-400">{new Date(event.occurred_at).toLocaleString("en-GB")}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {queueOpen ? (
        <QueueModal rows={readyRows} selected={selected} setSelected={setSelected} privacy={privacy} capabilities={deliveryCapabilities} sending={sending} onClose={() => setQueueOpen(false)} onCopySelected={copySelected} onOpenChannel={openChannel} onSendWeb={sendSelectedViaWeb} />
      ) : null}
    </PageContainer>
  );
}
