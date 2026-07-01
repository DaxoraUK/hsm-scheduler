import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export default function SaturdayFetchStatus({ satFetchStatus = [] }) {
  if (!satFetchStatus.length) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {satFetchStatus.map((status) => (
        <div
          key={status.id}
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold ${
            status.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {status.ok ? (
            <CheckCircle2 size={17} strokeWidth={2.5} />
          ) : (
            <XCircle size={17} strokeWidth={2.5} />
          )}

          <span>
            {status.name}:{" "}
            {status.ok
              ? `${status.count} fixture${status.count !== 1 ? "s" : ""}`
              : status.error || "failed"}
          </span>
        </div>
      ))}
    </div>
  );
}