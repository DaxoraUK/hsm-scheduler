import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
import { toast } from "../lib/notifications/daxoraNotifications.js";
import PageContainer from "../ui/PageContainer.jsx";
import PageHeader from "../ui/PageHeader.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import StatusChip from "../ui/StatusChip.jsx";
import Card from "../ui/Card.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { buildCommunicationsModel } from "../lib/communications/communicationsEngine.js";
import { maskContactDestination } from "../lib/communications/contactModel.js";
import { communicationPrivacyGaps, normaliseCommunicationPrivacy } from "../lib/communications/privacyModel.js";
import { coachAudienceSummary, filterCommunicationRowsByAudience } from "../lib/communications/coachAudience.js";
import { DB } from "../lib/supabase.js";
import {
  buildDeliveryMessages,
  describeCommunicationDispatchFailure,
  dispatchCommunicationBatch,
  EMPTY_DELIVERY_CAPABILITIES,
  loadDeliveryCapabilities,
} from "../lib/communications/deliveryService.js";
import { buildCommunicationApprovalKey, communicationRowSignature, findStaleCommunicationRows } from "../lib/communications/queueSafety.js";
import { buildCommunicationApprovalSnapshot } from "../lib/elite/eliteApprovalSnapshots.js";
import { ENTITLEMENTS, hasEntitlement } from "../lib/subscriptions/entitlements.js";
import {
  ELITE_APPROVAL_TYPES,
  createEliteApprovalRequest,
  loadEliteApprovalState,
  loadEliteCommunicationTemplates,
} from "../lib/elite/eliteGovernanceService.js";

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
    coach_hub_published: "Published to Coach Hub",
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

function QueueModal({ rows, selected, setSelected, privacy, capabilities, sending, onClose, onCopySelected, onOpenChannel, onSendWeb, onPublishCoachHub }) {
  if (typeof document === "undefined") return null;

  const gaps = communicationPrivacyGaps(privacy);
  const selectedRows = rows.filter((row) => selected[row.id]);
  const webEligibleRows = selectedRows.filter((row) => Boolean(row.contact?.privacyNoticeProvidedAt));
  const noticeMissingRows = selectedRows.filter((row) => !row.contact?.privacyNoticeProvidedAt);
  const webPlan = buildDeliveryMessages(webEligibleRows, capabilities);
  const emailPilot = Boolean(capabilities.channels?.email?.pilotMode);
  const pilotMaxBatch = Number(capabilities.channels?.email?.maxBatch) || 5;
  const pilotBatchTooLarge = emailPilot && webPlan.messages.length > pilotMaxBatch;
  const canCopy = !gaps.length && selectedRows.length > 0;
  const canSendWeb = !gaps.length && webPlan.messages.length > 0 && !pilotBatchTooLarge && !sending;
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;

  const selectAll = () => setSelected(Object.fromEntries(rows.map((row) => [row.id, true])));
  const clearAll = () => setSelected({});

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/65 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Coach message queue">
      <div className="flex min-h-full items-stretch justify-center sm:items-center sm:p-6">
        <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:max-w-6xl sm:rounded-[30px] sm:border sm:border-white/20">
          <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-7 sm:py-5">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Matchweek communications</div>
                <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950">Send coach messages</h2>
                <p className="mt-1.5 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                  Check recipients and fixture details before continuing. Provider acceptance, sending and delivery are recorded as separate events.
                </p>
              </div>
              <button type="button" onClick={onClose} disabled={sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40" aria-label="Close queue"><X size={18} /></button>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-black text-slate-800">
                {selectedRows.length} of {rows.length} message{rows.length === 1 ? "" : "s"} selected
                <span className="ml-2 font-semibold text-slate-500">· {webPlan.messages.length} provider recipient{webPlan.messages.length === 1 ? "" : "s"}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} disabled={allSelected || sending} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-40">Select all</button>
                <button type="button" onClick={clearAll} disabled={!selectedRows.length || sending} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-40">Clear</button>
              </div>
            </div>
          </header>

          {gaps.length ? (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-950 sm:px-7">
              <strong>Privacy setup required:</strong> complete {gaps.join(" · ")} in Settings → Privacy & contacts before copying or sending this queue.
            </div>
          ) : null}

          <div className={`shrink-0 border-b px-5 py-3 sm:px-7 ${capabilities.webSendingEnabled ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <RadioTower size={18} className={`mt-0.5 shrink-0 ${capabilities.webSendingEnabled ? "text-emerald-700" : "text-slate-500"}`} />
                <div className="min-w-0">
                  <div className={`text-sm font-black ${capabilities.webSendingEnabled ? "text-emerald-950" : "text-slate-800"}`}>
                    {emailPilot ? "Staging email pilot is active" : capabilities.webSendingEnabled ? "Secure web sending available" : "Web sending not configured"}
                  </div>
                  <div className={`mt-0.5 text-xs font-semibold leading-5 ${capabilities.webSendingEnabled ? "text-emerald-800" : "text-slate-500"}`}>
                    {emailPilot
                      ? `All provider emails will be redirected to ${capabilities.channels.email.pilotRecipientHint}. No coach will receive these messages. Maximum ${pilotMaxBatch} recipients.${pilotBatchTooLarge ? " Reduce the selection to continue." : ""}`
                      : capabilities.webSendingEnabled
                        ? `${webPlan.messages.length} selected recipient${webPlan.messages.length === 1 ? "" : "s"} can use a configured provider.${webPlan.unavailable.length ? ` ${webPlan.unavailable.length} will remain external-channel only.` : ""}${noticeMissingRows.length ? ` ${noticeMissingRows.length} excluded until the privacy notice is recorded.` : ""}`
                        : "Copy the selected messages or configure a server-side provider before sending from Ground Control."}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {["email", "sms", "whatsapp"].map((channel) => {
                  const item = capabilities.channels?.[channel];
                  const label = channel === "email" && item?.pilotMode ? "Pilot" : item?.enabled ? "Ready" : "Off";
                  return <StatusChip key={channel} status={item?.enabled ? "success" : "neutral"} size="sm">{channel} · {label}</StatusChip>;
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-4 py-4 sm:px-7 sm:py-5">
            <div className="grid gap-3 xl:grid-cols-2">
              {rows.map((row) => {
                const checked = Boolean(selected[row.id]);
                return (
                  <article key={row.id} className={`rounded-[22px] border bg-white p-4 shadow-sm transition ${checked ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={checked} onChange={(event) => setSelected((current) => ({ ...current, [row.id]: event.target.checked }))} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-emerald-600" aria-label={`Select ${row.teamName}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="font-black text-slate-950">{row.teamName}</h3>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{row.dateLabel} · {row.ko} · {row.pitch}</p>
                          </div>
                          <StatusChip status="success" size="sm">{row.recipients.length} recipient{row.recipients.length === 1 ? "" : "s"}</StatusChip>
                        </div>

                        <div className="mt-3 space-y-2">
                          {row.recipients.map((recipient) => (
                            <button key={`${row.id}-${recipient.type}`} type="button" onClick={() => onOpenChannel(row, recipient)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50">
                              <span className="min-w-0 text-xs font-black text-slate-700"><span className="block truncate">{recipient.name}</span><span className="font-semibold text-slate-500">{recipient.channel} · {maskContactDestination(recipient.destination)}</span></span>
                              <ExternalLink size={14} className="shrink-0 text-slate-400" />
                            </button>
                          ))}
                        </div>

                        <details className="mt-3 rounded-xl border border-slate-200 bg-white">
                          <summary className="cursor-pointer px-3 py-2 text-xs font-black text-slate-600">Preview message</summary>
                          <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap border-t border-slate-100 px-3 py-3 font-sans text-xs font-semibold leading-5 text-slate-600">{row.message}</pre>
                        </details>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-xs font-bold leading-5 text-slate-500">
                Copying or opening WhatsApp, SMS or email does not prove the message was sent or delivered.
                {noticeMissingRows.length ? ` ${noticeMissingRows.length} selected message${noticeMissingRows.length === 1 ? " is" : "s are"} missing a recorded privacy notice.` : ""}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose} disabled={sending} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">Cancel</button>
                <button type="button" onClick={() => onCopySelected(selectedRows)} disabled={!canCopy || sending} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><Copy size={17} /> Copy selected messages</button>
                <button type="button" onClick={() => onPublishCoachHub(selectedRows)} disabled={!selectedRows.length || sending} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"><MessageSquareText size={17} /> Publish to Coach Hub</button>
                <button type="button" onClick={() => onSendWeb(webEligibleRows)} disabled={!canSendWeb} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                  {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                  {sending ? "Sending securely…" : emailPilot ? "Send staging email test" : capabilities.webSendingEnabled ? "Send selected via web" : "Web sending unavailable"}
                </button>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </div>,
    document.body,
  );
}

export default function CommunicationsPage(props) {
  const eliteCommunicationGovernance = hasEntitlement(props.subscription, ENTITLEMENTS.COMMUNICATION_GOVERNANCE);
  const [governedTemplates, setGovernedTemplates] = useState([]);
  const [liveTeamContacts, setLiveTeamContacts] = useState(() => Array.isArray(props.teamContacts) ? props.teamContacts : []);
  const model = useMemo(() => buildCommunicationsModel({ ...props, teamContacts: liveTeamContacts, governedTemplates }), [props, liveTeamContacts, governedTemplates]);
  const privacy = useMemo(() => normaliseCommunicationPrivacy(props.communicationPrivacy), [props.communicationPrivacy]);
  const [day, setDay] = useState("all");
  const [filter, setFilter] = useState("all");
  const [queueOpen, setQueueOpen] = useState(false);
  const [selected, setSelected] = useState({});
  const [queueSnapshot, setQueueSnapshot] = useState({});
  const [events, setEvents] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deliveryCapabilities, setDeliveryCapabilities] = useState(EMPTY_DELIVERY_CAPABILITIES);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendConfirmation, setSendConfirmation] = useState(null);
  const [sendFailure, setSendFailure] = useState(null);
  const [coachHubConfirmation, setCoachHubConfirmation] = useState(null);
  const [coachHubDeliveries, setCoachHubDeliveries] = useState([]);
  const canCommunicate = Boolean(props.workspaceAccess?.canCommunicate && !props.workspaceAccess?.isReadOnly);
  const auditAvailable = Boolean(props.activeClubId && props.communicationSchemaReady && canCommunicate);

  useEffect(() => {
    setLiveTeamContacts(Array.isArray(props.teamContacts) ? props.teamContacts : []);
  }, [props.teamContacts]);

  useEffect(() => {
    let cancelled = false;
    if (!props.activeClubId || !canCommunicate) return undefined;
    DB.loadTeamContacts(props.activeClubId)
      .then((rows) => {
        if (!cancelled && Array.isArray(rows)) setLiveTeamContacts(rows);
      })
      .catch(() => {
        // Existing in-memory contacts remain available if the protected directory is temporarily unavailable.
      });
    return () => { cancelled = true; };
  }, [props.activeClubId, canCommunicate]);

  const audienceRecipients = Array.isArray(props.audience?.recipients) ? props.audience.recipients.filter((row) => row.ready) : [];
  const audienceRows = filterCommunicationRowsByAudience(model.rows, props.audience);
  const rows = audienceRows.filter((row) => {
    if (day !== "all" && row.day !== day) return false;
    if (filter !== "all" && row.readyState !== filter) return false;
    return true;
  });
  const readyRows = rows.filter((row) => row.readyState === "ready" && row.recipients.length && row.contact.receiveMatchdayMessages);

  const copyAudienceContacts = async () => {
    const contacts = audienceRecipients.map((row) => [row.name, row.teamName, row.email || row.mobile].filter(Boolean).join(" · ")).join("\n");
    if (!contacts) {
      toast.warning("No contact-ready coaches found", { description: "Synchronise team contacts and complete missing email or mobile details." });
      return;
    }
    await navigator.clipboard.writeText(contacts);
    toast.success("Affected coach contacts copied", { description: `${audienceRecipients.length} contact${audienceRecipients.length === 1 ? "" : "s"} ready for the update.` });
  };

  const loadEvents = useCallback(async () => {
    if (!auditAvailable) {
      setEvents([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const [eventRows, deliveryRows] = await Promise.all([
        DB.listCommunicationEvents(props.activeClubId, 50),
        DB.listCoachHubMatchweekDeliveryStatus(props.activeClubId, 30),
      ]);
      setEvents(eventRows);
      setCoachHubDeliveries(deliveryRows);
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

  useEffect(() => {
    let active = true;
    if (!eliteCommunicationGovernance || !props.activeClubId) {
      setGovernedTemplates([]);
      return () => { active = false; };
    }
    loadEliteCommunicationTemplates(props.activeClubId)
      .then((templates) => {
        if (active) setGovernedTemplates(templates);
      })
      .catch((error) => {
        if (active) {
          setGovernedTemplates([]);
          toast.warning("Elite communication templates could not be loaded", { description: error?.message });
        }
      });
    return () => { active = false; };
  }, [eliteCommunicationGovernance, props.activeClubId]);

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

  const openQueueWithRows = async (queueRows, detail = {}) => {
    const nextRows = Array.isArray(queueRows) ? queueRows : [];
    setSelected(Object.fromEntries(nextRows.map((row) => [row.id, true])));
    setQueueSnapshot(Object.fromEntries(nextRows.map((row) => [row.id, communicationRowSignature(row)])));
    setQueueOpen(true);
    await record(null, "queue_opened", null, { readyMessages: nextRows.length, totalMessages: model.counts.total, ...detail });
  };

  const openQueue = async () => {
    await openQueueWithRows(readyRows);
  };

  const reopenFailedMessage = async (event) => {
    const row = model.rows.find((item) => item.id === event.message_key && item.readyState === "ready" && item.recipients.length);
    if (!row) {
      toast.error("The message cannot be retried", { description: "The fixture is no longer ready or the coach contact is unavailable. Rebuild and review the current queue." });
      return;
    }
    setDay("all");
    setFilter("all");
    await openQueueWithRows([row], { retryOfEventId: event.id, contentChanged: event.message_hash !== row.messageHash });
    toast.info(event.message_hash === row.messageHash ? "Failed message ready to retry" : "Fixture details changed", { description: event.message_hash === row.messageHash ? "Review the recipient and send the message again." : "Ground Control opened the latest message version rather than retrying obsolete content." });
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
    const staleRows = findStaleCommunicationRows(selectedRows, model.rows, queueSnapshot);
    if (staleRows.length) {
      toast.error("The message queue changed", { description: "Fixture or contact details changed after the queue was opened. Close and reopen the queue before sending." });
      return;
    }
    const webEligibleRows = selectedRows.filter((row) => Boolean(row.contact?.privacyNoticeProvidedAt));
    const plan = buildDeliveryMessages(webEligibleRows, deliveryCapabilities);
    if (!plan.messages.length) {
      toast.error("No configured web recipients", { description: "Enable an email, SMS or WhatsApp provider in Vercel first." });
      return;
    }
    const emailPilot = Boolean(deliveryCapabilities.channels?.email?.pilotMode);
    const pilotMaxBatch = Number(deliveryCapabilities.channels?.email?.maxBatch) || 5;
    if (emailPilot && plan.messages.length > pilotMaxBatch) {
      toast.error("Staging pilot batch limit exceeded", { description: `Select no more than ${pilotMaxBatch} email recipients.` });
      return;
    }

    const approvalSnapshot = buildCommunicationApprovalSnapshot(webEligibleRows, plan);
    const requestKey = buildCommunicationApprovalKey(webEligibleRows, plan);
    const eliteGovernance = eliteCommunicationGovernance;
    if (eliteGovernance) {
      try {
        const approvalState = await loadEliteApprovalState(props.activeClubId, ELITE_APPROVAL_TYPES.COMMUNICATIONS, requestKey);
        const approvalRequired = approvalState.policy.communicationsApprovalRequired || approvalSnapshot.approvalRequired;
        if (approvalRequired && !approvalState.approved) {
          if (!approvalState.pending) {
            await createEliteApprovalRequest(props.activeClubId, {
              approvalType: ELITE_APPROVAL_TYPES.COMMUNICATIONS,
              entityKey: requestKey,
              title: `Coach message batch · ${plan.messages.length} recipient${plan.messages.length === 1 ? "" : "s"}`,
              summary: "Exact recipient, fixture, template and message content snapshot prepared from the current matchweek queue.",
              snapshot: approvalSnapshot,
            });
          }
          const failure = {
            title: "Elite approval required",
            description: approvalState.pending
              ? "This exact coach-message batch is already waiting for a separate reviewer in Organisation Command."
              : "An approval request has been created in Organisation Command. A separate reviewer must approve this exact batch before it can be sent.",
            code: "ELITE_COMMUNICATION_APPROVAL_REQUIRED",
          };
          setSendFailure(failure);
          toast.info(failure.title, { description: failure.description });
          return;
        }
      } catch (error) {
        const failure = {
          title: "Elite approval check failed",
          description: error?.message || "The secure approval state could not be checked.",
          code: error?.code || "ELITE_APPROVAL_CHECK_FAILED",
        };
        setSendFailure(failure);
        toast.error(failure.title, { description: failure.description });
        return;
      }
    }

    setSendFailure(null);
    setSendConfirmation({
      rows: webEligibleRows,
      recipientCount: plan.messages.length,
      unavailableCount: plan.unavailable.length,
      emailPilot,
      requestKey,
      signatures: Object.fromEntries(webEligibleRows.map((row) => [row.id, communicationRowSignature(row)])),
    });
  };

  const prepareCoachHubPublish = (selectedRows) => {
    const staleRows = findStaleCommunicationRows(selectedRows, model.rows, queueSnapshot);
    if (staleRows.length) {
      toast.error("The message queue changed", { description: "Close and reopen the queue before publishing the latest fixture details." });
      return;
    }
    const missingTeams = selectedRows.filter((row) => !row.contact?.teamKey);
    if (missingTeams.length) {
      toast.error("Coach Hub team link missing", { description: `${missingTeams.map((row) => row.teamName).join(", ")} must be linked to a configured team contact first.` });
      return;
    }
    setCoachHubConfirmation({ rows: selectedRows });
  };

  const confirmCoachHubPublish = async () => {
    const selectedRows = coachHubConfirmation?.rows || [];
    if (!selectedRows.length || sending) return;
    const staleRows = findStaleCommunicationRows(selectedRows, model.rows, queueSnapshot);
    if (staleRows.length) {
      toast.error("The message queue is out of date", { description: "Reopen it and review the latest fixture details." });
      return;
    }

    const prepared = {
      messages: selectedRows.map((row) => ({ channel: "coach_hub", message: row.message })),
      unavailable: [],
    };
    const approvalSnapshot = buildCommunicationApprovalSnapshot(selectedRows, prepared);
    const requestKey = buildCommunicationApprovalKey(selectedRows, prepared);
    if (eliteCommunicationGovernance) {
      try {
        const approvalState = await loadEliteApprovalState(props.activeClubId, ELITE_APPROVAL_TYPES.COMMUNICATIONS, requestKey);
        const approvalRequired = approvalState.policy.communicationsApprovalRequired || approvalSnapshot.approvalRequired;
        if (approvalRequired && !approvalState.approved) {
          if (!approvalState.pending) {
            await createEliteApprovalRequest(props.activeClubId, {
              approvalType: ELITE_APPROVAL_TYPES.COMMUNICATIONS,
              entityKey: requestKey,
              title: `Coach Hub batch · ${selectedRows.length} team${selectedRows.length === 1 ? "" : "s"}`,
              summary: "Exact team, fixture, template and message content prepared for Coach Hub.",
              snapshot: approvalSnapshot,
            });
          }
          toast.info("Elite approval required", { description: "A separate reviewer must approve this exact Coach Hub batch in Club Command." });
          return;
        }
      } catch (error) {
        toast.error("Elite approval check failed", { description: error?.message });
        return;
      }
    }

    setSending(true);
    try {
      const result = await DB.publishCoachHubMatchweekMessages(props.activeClubId, selectedRows.map((row) => ({
        team_key: row.contact.teamKey,
        title: row.subject || `${row.teamName} matchweek update`,
        body: row.message,
        message_identity: `${row.id}:${row.messageHash}`,
        requires_acknowledgement: true,
      })));
      await Promise.all(selectedRows.map((row) => record(row, "coach_hub_published", null, { teamKey: row.contact.teamKey }, false)));
      await loadEvents();
      setCoachHubConfirmation(null);
      setQueueOpen(false);
      if (result?.published) toast.success(`${result.published} Coach Hub update${result.published === 1 ? "" : "s"} published`, { description: "Coaches will see the update for their assigned teams and can acknowledge it in Coach Hub." });
      if (result?.reused) toast.info(`${result.reused} unchanged update${result.reused === 1 ? " was" : "s were"} already published`);
    } catch (error) {
      toast.error("Coach Hub publish failed", { description: error?.message });
    } finally {
      setSending(false);
    }
  };

  const confirmWebSend = async () => {
    if (!sendConfirmation?.rows?.length || sending) return;
    const confirmation = sendConfirmation;
    const staleRows = findStaleCommunicationRows(confirmation.rows, model.rows, confirmation.signatures || {});
    if (staleRows.length) {
      const failure = { title: "The message queue is out of date", description: "Fixture or coach-contact details changed before confirmation. Go back, reopen the queue and review the latest version.", code: "STALE_COMMUNICATION_QUEUE" };
      setSendFailure(failure);
      toast.error(failure.title, { description: failure.description });
      return;
    }
    setSending(true);
    try {
      const requestKey = confirmation.requestKey || buildCommunicationApprovalKey(confirmation.rows);
      const result = await dispatchCommunicationBatch({
        clubId: props.activeClubId,
        rows: confirmation.rows,
        capabilities: deliveryCapabilities,
        requestKey,
      });
      await loadEvents();
      if (result.failed && !result.accepted) {
        const failure = describeCommunicationDispatchFailure(result);
        setSendFailure(failure);
        toast.error(failure.title, { description: failure.description });
        return;
      }
      if (result.failed) {
        const failure = describeCommunicationDispatchFailure(result);
        toast.warning(`${result.accepted} accepted, ${result.failed} failed`, { description: failure.description });
      } else if (result.accepted) {
        toast.success(`${result.accepted} message${result.accepted === 1 ? "" : "s"} accepted by provider`, { description: confirmation.emailPilot ? "The internal staging inbox will receive the redirected test. Delivery remains a separate provider status." : "Delivery status will update only when the provider confirms it." });
      } else if (result.reused) {
        toast.info("Message not resent", { description: "The same recipient and message were already processed recently, so Ground Control did not create another provider request." });
      } else {
        toast.info("No new provider request was created", { description: "Review the communication history before trying again." });
      }
      if (result.reused && result.accepted) {
        toast.info(`${result.reused} recent duplicate${result.reused === 1 ? " was" : "s were"} not resent`, { description: "Only newly accepted provider requests were counted as sent in this batch." });
      }
      if (result.unavailable?.length) {
        toast.info(`${result.unavailable.length} recipient${result.unavailable.length === 1 ? "" : "s"} not sent`, { description: "Their preferred channel is not configured for web sending." });
      }
      setSendFailure(null);
      setSendConfirmation(null);
      setQueueOpen(false);
    } catch (error) {
      const failure = describeCommunicationDispatchFailure(error?.detail || {
        error: error?.message,
        code: error?.code,
      });
      setSendFailure(failure);
      toast.error(failure.title, { description: failure.description });
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
          <button type="button" onClick={openQueue} disabled={!props.communicationSchemaReady || !canCommunicate} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
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

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-950">
        <UsersRound size={19} className="mt-0.5 shrink-0 text-sky-700" />
        <span><strong>Shared team contacts.</strong> The same adult contact record powers Communications, Coach Hub invitations, booking requests, calendar updates and acknowledgements. Update it once in Settings → Teams.</span>
      </div>

      {props.audience?.teamKeys?.length ? (
        <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold leading-6 text-violet-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><UsersRound size={19} className="mt-0.5 shrink-0 text-violet-700" /><span><strong>Automatic Annual Planner audience.</strong> {coachAudienceSummary(props.audience)}. {audienceRecipients.length} connected coach contact{audienceRecipients.length === 1 ? " is" : "s are"} ready; matching matchweek messages are filtered below.</span></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={copyAudienceContacts} className="h-10 rounded-xl border border-violet-200 bg-white px-3 text-xs font-black text-violet-800"><Copy size={14} className="mr-2 inline" />Copy contacts</button><button type="button" onClick={props.onClearAudience} className="h-10 rounded-xl border border-violet-200 bg-white px-3 text-xs font-black text-violet-800">Clear audience</button></div></div>
          {audienceRecipients.length ? <div className="mt-3 flex flex-wrap gap-2">{audienceRecipients.slice(0, 12).map((recipient) => <span key={`${recipient.personId}-${recipient.teamKey}`} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-violet-800 shadow-sm">{recipient.teamName} · {recipient.name}</span>)}{audienceRecipients.length > 12 ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-800">+{audienceRecipients.length - 12} more</span> : null}</div> : null}
        </div>
      ) : null}

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
                      <button type="button" onClick={() => markReviewed(row)} disabled={!canCommunicate} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ClipboardCheck size={15} /> Record review</button>
                    ) : null}
                    <button type="button" onClick={() => copyMessage(row)} disabled={!canCommunicate || row.readyState === "blocked"} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><Copy size={15} /> Copy individually</button>
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
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {["failed", "undelivered"].includes(event.action) ? (
                    <button type="button" onClick={() => reopenFailedMessage(event)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 transition hover:bg-rose-50">
                      <Send size={14} /> {model.rows.find((row) => row.id === event.message_key)?.messageHash === event.message_hash ? "Retry" : "Review latest"}
                    </button>
                  ) : null}
                  <div className="text-xs font-bold text-slate-400">{new Date(event.occurred_at).toLocaleString("en-GB")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card eyebrow="Coach Hub delivery" title="Reads and acknowledgements" subtitle="Team-scoped Coach Hub updates use the same approved matchweek message and return first-party engagement evidence.">
        {!coachHubDeliveries.length ? (
          <EmptyState icon={MessageSquareText} title="No Coach Hub updates published" description="Open the coach-message queue and publish a ready batch to Coach Hub." />
        ) : (
          <div className="divide-y divide-slate-100">
            {coachHubDeliveries.slice(0, 20).map((delivery) => {
              const expected = Number(delivery.expected_recipients) || 0;
              const read = Number(delivery.read_count) || 0;
              const acknowledged = Number(delivery.acknowledged_count) || 0;
              return <div key={delivery.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-black text-slate-950">{delivery.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{delivery.team_key} · {new Date(delivery.created_at).toLocaleString("en-GB")}</div></div><div className="flex flex-wrap gap-2"><StatusChip status={read >= expected && expected ? "success" : "info"} size="sm">Read {read}/{expected}</StatusChip><StatusChip status={acknowledged >= expected && expected ? "success" : "warning"} size="sm">Acknowledged {acknowledged}/{expected}</StatusChip></div></div>;
            })}
          </div>
        )}
      </Card>

      {queueOpen ? (
        <QueueModal rows={readyRows} selected={selected} setSelected={setSelected} privacy={privacy} capabilities={deliveryCapabilities} sending={sending} onClose={() => !sending && setQueueOpen(false)} onCopySelected={copySelected} onOpenChannel={openChannel} onSendWeb={sendSelectedViaWeb} onPublishCoachHub={prepareCoachHubPublish} />
      ) : null}

      <ConfirmDialog
        open={Boolean(coachHubConfirmation)}
        eyebrow="First-party Coach Hub delivery"
        title={`Publish ${coachHubConfirmation?.rows?.length || 0} team update${coachHubConfirmation?.rows?.length === 1 ? "" : "s"}?`}
        description="Each update will appear only to active Coach Hub users assigned to that team. Coaches will be asked to acknowledge receipt."
        confirmLabel="Publish to Coach Hub"
        cancelLabel="Go back"
        tone="warning"
        busy={sending}
        initialFocus="cancel"
        onCancel={() => !sending && setCoachHubConfirmation(null)}
        onConfirm={confirmCoachHubPublish}
      />

      <ConfirmDialog
        open={Boolean(sendConfirmation)}
        eyebrow={sendConfirmation?.emailPilot ? "Internal staging test" : "Secure web delivery"}
        title={sendConfirmation?.emailPilot
          ? `Send ${sendConfirmation?.recipientCount || 0} internal test email${sendConfirmation?.recipientCount === 1 ? "" : "s"}?`
          : `Send ${sendConfirmation?.recipientCount || 0} coach message${sendConfirmation?.recipientCount === 1 ? "" : "s"}?`}
        description={sendConfirmation?.emailPilot
          ? "The provider request will be redirected to the internal staging inbox. Saved coach and assistant addresses will not receive this test."
          : "Ground Control will submit the selected messages to the configured providers. Acceptance does not prove delivery."}
        confirmLabel={sendConfirmation?.emailPilot ? "Send staging email test" : "Send messages"}
        cancelLabel="Go back"
        tone={sendConfirmation?.emailPilot ? "info" : "warning"}
        busy={sending}
        initialFocus="cancel"
        onCancel={() => {
          if (sending) return;
          setSendFailure(null);
          setSendConfirmation(null);
        }}
        onConfirm={confirmWebSend}
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Delivery summary</div>
          <div className="mt-2 text-sm font-black text-slate-900">{sendConfirmation?.recipientCount || 0} provider recipient{sendConfirmation?.recipientCount === 1 ? "" : "s"}</div>
          {sendConfirmation?.emailPilot ? (
            <div className="mt-2 text-sm font-semibold leading-6 text-slate-600">Redirect inbox: <strong className="text-slate-900">{deliveryCapabilities.channels?.email?.pilotRecipientHint}</strong><br />No coach will receive the test.</div>
          ) : null}
          {sendConfirmation?.unavailableCount ? (
            <div className="mt-2 text-xs font-bold text-amber-700">{sendConfirmation.unavailableCount} recipient{sendConfirmation.unavailableCount === 1 ? "" : "s"} use an unavailable channel and will be skipped.</div>
          ) : null}
          {sendFailure ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left">
              <div className="flex items-start gap-3">
                <ShieldAlert size={18} className="mt-0.5 shrink-0 text-rose-700" />
                <div className="min-w-0">
                  <div className="text-sm font-black text-rose-950">{sendFailure.title}</div>
                  <div className="mt-1 text-sm font-semibold leading-6 text-rose-900">{sendFailure.description}</div>
                  <div className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-rose-600">Reference: {sendFailure.code}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </ConfirmDialog>
    </PageContainer>
  );
}
