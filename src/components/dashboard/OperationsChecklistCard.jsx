import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
} from "lucide-react";
import Card from "../ui/Card.jsx";

export default function OperationsChecklistCard({ items = [], onOpenItem }) {
  const complete = items.filter((item) => item.state === "done").length;
  const total = items.length || 1;
  const nextItem = items.find((item) => item.state !== "done") || items[items.length - 1];

  return (
    <Card
      eyebrow="Today’s Operations"
      title="Weekend checklist"
      subtitle="A cleaner operational workflow instead of scattered dashboard warnings."
      action={
        <div className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white">
          {complete}/{total}
        </div>
      }
    >
      {nextItem && (
        <button
          type="button"
          onClick={() => onOpenItem?.(nextItem)}
          className="mb-5 flex w-full items-center justify-between gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">
              Next action
            </div>
            <div className="mt-1 text-xl font-black text-slate-950">{nextItem.title}</div>
            <div className="mt-1 text-sm font-bold text-slate-600">{nextItem.description}</div>
          </div>
          <ChevronRight className="shrink-0 text-amber-700" size={22} />
        </button>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <ChecklistItem
            key={item.key}
            item={item}
            number={index + 1}
            onClick={() => onOpenItem?.(item)}
          />
        ))}
      </div>
    </Card>
  );
}

function ChecklistItem({ item, number, onClick }) {
  const isDone = item.state === "done";
  const isIssue = item.state === "issue";
  const Icon = isDone ? CheckCircle2 : isIssue ? AlertTriangle : Circle;

  const iconStyles = isDone
    ? "bg-emerald-100 text-emerald-700"
    : isIssue
    ? "bg-amber-100 text-amber-700"
    : "bg-slate-100 text-slate-500";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/40 hover:shadow-sm"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconStyles}`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              {number.toString().padStart(2, "0")}
            </span>
            {item.required && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                Required
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm font-black text-slate-950">{item.title}</div>
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 text-right text-sm font-bold text-slate-500 md:block">
        {item.description}
      </div>

      <ChevronRight className="shrink-0 text-slate-400" size={18} />
    </button>
  );
}
