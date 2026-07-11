import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Mail,
  MessageSquareText,
  Phone,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import PageContainer from "../ui/PageContainer.jsx";
import PageHeader from "../ui/PageHeader.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import StatusChip from "../ui/StatusChip.jsx";
import Card from "../ui/Card.jsx";
import { buildCommunicationsModel } from "../lib/communications/communicationsEngine.js";
import { tenantGetJson, tenantSetJson } from "../lib/storage/tenantStorage.js";

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
  if (row.readyState === "ready") return { tone: "success", label: "Ready to copy" };
  if (row.readyState === "review") return { tone: "warning", label: "Review first" };
  return { tone: "danger", label: "Blocked" };
}

function statusLabel(status) {
  if (status === "postponed") return "Postponement update";
  if (status === "cancelled") return "Cancellation update";
  if (status === "unresolved") return "Holding update";
  return "Match details";
}

export default function CommunicationsPage(props) {
  const model = useMemo(() => buildCommunicationsModel(props), [props]);
  const [day, setDay] = useState("all");
  const [filter, setFilter] = useState("all");
  const [reviewState, setReviewState] = useState(() => tenantGetJson("communicationsReview", {}));

  useEffect(() => {
    tenantSetJson("communicationsReview", reviewState);
  }, [reviewState]);

  const rows = model.rows.filter((row) => {
    if (day !== "all" && row.day !== day) return false;
    if (filter !== "all" && row.readyState !== filter) return false;
    return true;
  });

  const copyMessage = async (row) => {
    if (row.readyState === "blocked") {
      toast.error("Message is blocked", { description: row.issues.join(" · ") || "Resolve the fixture allocation first." });
      return;
    }
    try {
      await navigator.clipboard.writeText(row.message);
      setReviewState((current) => ({
        ...current,
        [row.id]: { messageHash: row.messageHash, reviewedAt: new Date().toISOString(), copiedAt: new Date().toISOString() },
      }));
      toast.success("Message copied", { description: `${row.teamName} · external delivery is not tracked.` });
    } catch {
      toast.error("Copy failed", { description: "Select the message text and copy it manually." });
    }
  };

  const markReviewed = (row) => {
    setReviewState((current) => ({
      ...current,
      [row.id]: { ...current[row.id], messageHash: row.messageHash, reviewedAt: new Date().toISOString() },
    }));
  };

  const copyAllReady = async () => {
    const readyRows = rows.filter((row) => row.readyState === "ready");
    if (!readyRows.length) {
      toast.info("No ready messages in this view");
      return;
    }
    try {
      await navigator.clipboard.writeText(readyRows.map((row) => `${row.teamName}\n${row.message}`).join("\n\n--------------------\n\n"));
      const now = new Date().toISOString();
      setReviewState((current) => ({
        ...current,
        ...Object.fromEntries(readyRows.map((row) => [row.id, { messageHash: row.messageHash, reviewedAt: now, copiedAt: now }])),
      }));
      toast.success(`${readyRows.length} messages copied`, { description: "Paste and send each message through the club's chosen channel." });
    } catch {
      toast.error("Bulk copy failed");
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Matchweek communications"
        title="Communications"
        subtitle="Prepare accurate manager updates from the current schedule, review anything incomplete and copy messages into the club's chosen channel."
        action={model.counts.ready ? (
          <button type="button" onClick={copyAllReady} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
            <Copy size={17} /> Copy ready messages
          </button>
        ) : null}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={MessageSquareText} label="Prepared" value={model.counts.total} detail="Current matchweek messages" />
        <SummaryCard icon={CheckCircle2} label="Ready" value={model.counts.ready} detail="Complete and contact-linked" tone="green" />
        <SummaryCard icon={AlertTriangle} label="Needs review" value={model.counts.review} detail="Can be copied after a check" tone="amber" />
        <SummaryCard icon={ShieldAlert} label="Blocked" value={model.counts.blocked} detail="Allocation must be resolved" tone="rose" />
      </div>

      <Card
        eyebrow="Review queue"
        title="Manager messages"
        subtitle={model.disclaimer}
      >
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
          <EmptyState title="No communications are ready" message="Build a Saturday, Sunday or Midweek schedule to prepare manager messages." />
        ) : !rows.length ? (
          <EmptyState title="No messages match this view" message="Change the day or review filter." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {rows.map((row) => {
              const state = readiness(row);
              const audit = reviewState[row.id];
              const currentReview = audit?.messageHash === row.messageHash ? audit : null;
              return (
                <article key={row.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip status={state.tone} size="sm">{state.label}</StatusChip>
                        <StatusChip status={row.status === "scheduled" ? "neutral" : row.status === "cancelled" ? "danger" : "warning"} size="sm">{statusLabel(row.status)}</StatusChip>
                        {currentReview?.copiedAt ? <StatusChip status="info" size="sm">Copied on this device</StatusChip> : currentReview?.reviewedAt ? <StatusChip status="info" size="sm">Reviewed</StatusChip> : null}
                      </div>
                      <h3 className="mt-3 text-xl font-black text-slate-950">{row.teamName}</h3>
                      <div className="mt-1 text-sm font-semibold text-slate-500">{row.dateLabel} · {row.ko} · {row.pitch}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right ring-1 ring-slate-200">
                      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Manager contact</div>
                      <div className="mt-1 text-sm font-black text-slate-900">{row.contact.name || "Not recorded"}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                    {row.contact.phone ? <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5"><Phone size={13} />{row.contact.phone}</span> : null}
                    {row.contact.email ? <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5"><Mail size={13} />{row.contact.email}</span> : null}
                    {!row.contact.phone && !row.contact.email ? <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-amber-800"><UsersRound size={13} />Add contact in Team settings</span> : null}
                  </div>

                  {row.issues.length ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Review before copy</div>
                      <div className="mt-2 text-sm font-bold leading-6 text-amber-950">{row.issues.join(" · ")}</div>
                    </div>
                  ) : null}

                  <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 font-sans text-sm font-semibold leading-6 text-slate-700">{row.message}</pre>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {!currentReview?.reviewedAt && row.readyState !== "blocked" ? (
                      <button type="button" onClick={() => markReviewed(row)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
                        <ClipboardCheck size={15} /> Mark reviewed
                      </button>
                    ) : null}
                    <button type="button" onClick={() => copyMessage(row)} disabled={row.readyState === "blocked"} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                      <Copy size={15} /> Copy message
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
