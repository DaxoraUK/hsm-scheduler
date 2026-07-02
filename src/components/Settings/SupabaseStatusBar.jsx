import React from "react";
import { CheckCircle2, CloudOff, Database, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { DB, isSupaConfigured } from "../../lib/supabase.js";

const STATUS = {
  connected: {
    label: "Cloud sync connected",
    detail: "Club configuration and operational data can sync across devices.",
    wrap: "border-emerald-200 bg-emerald-50",
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
    textClass: "text-emerald-950",
  },
  saving: {
    label: "Saving changes",
    detail: "Ground Control is updating the shared workspace.",
    wrap: "border-blue-200 bg-blue-50",
    icon: LoaderCircle,
    iconClass: "animate-spin text-blue-600",
    textClass: "text-blue-950",
  },
  loading: {
    label: "Refreshing workspace",
    detail: "Ground Control is loading the latest saved configuration.",
    wrap: "border-blue-200 bg-blue-50",
    icon: LoaderCircle,
    iconClass: "animate-spin text-blue-600",
    textClass: "text-blue-950",
  },
  connecting: {
    label: "Connecting",
    detail: "Ground Control is establishing a secure data connection.",
    wrap: "border-blue-200 bg-blue-50",
    icon: LoaderCircle,
    iconClass: "animate-spin text-blue-600",
    textClass: "text-blue-950",
  },
  error: {
    label: "Cloud sync needs attention",
    detail: "Local storage is still active. Review the database configuration before launch.",
    wrap: "border-rose-200 bg-rose-50",
    icon: TriangleAlert,
    iconClass: "text-rose-600",
    textClass: "text-rose-950",
  },
  disabled: {
    label: "Cloud sync not configured",
    detail: "This workspace is currently using local browser storage only.",
    wrap: "border-amber-200 bg-amber-50",
    icon: CloudOff,
    iconClass: "text-amber-700",
    textClass: "text-amber-950",
  },
};

export default function SupabaseStatusBar({ dbStatus = "disabled", setDbStatus, setHistory }) {
  const config = STATUS[dbStatus] || STATUS.disabled;
  const Icon = config.icon || Database;

  const refresh = async () => {
    if (!isSupaConfigured()) {
      setDbStatus?.("disabled");
      return;
    }

    setDbStatus?.("loading");
    const data = await DB.loadHistory();

    if (data) {
      setHistory?.(data);
      setDbStatus?.("connected");
    } else {
      setDbStatus?.("error");
    }
  };

  return (
    <div className={`flex flex-col gap-4 rounded-[22px] border p-4 sm:flex-row sm:items-center sm:justify-between ${config.wrap}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-black/[0.04]">
          <Icon size={21} className={config.iconClass} strokeWidth={2.4} />
        </span>
        <div className="min-w-0">
          <div className={`text-sm font-black ${config.textClass}`}>{config.label}</div>
          <div className="mt-1 text-sm font-semibold leading-5 text-slate-600">{config.detail}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={refresh}
        disabled={["loading", "saving", "connecting"].includes(dbStatus)}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/80 bg-white px-4 text-xs font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw size={15} />
        Refresh status
      </button>
    </div>
  );
}
