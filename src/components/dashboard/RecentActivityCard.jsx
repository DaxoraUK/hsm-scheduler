import React from "react";
import Card from "../ui/Card.jsx";
import StatusChip from "../ui/StatusChip.jsx";

export default function RecentActivityCard({ history = [] }) {
  const recent = history.slice(0, 5);

  return (
    <Card
      eyebrow="Activity"
      title="Recent Activity"
      subtitle="Latest saved weekends and operational updates."
      action={<StatusChip variant="neutral">{recent.length} items</StatusChip>}
    >
      {recent.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
          No recent activity yet. Save a weekend to begin building the activity log.
        </div>
      ) : (
        <div className="space-y-4">
          {recent.map((item, index) => (
            <div
              key={item.id || index}
              className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-slate-800">
                  Weekend saved
                </div>

                <div className="mt-1 truncate text-sm font-medium text-slate-500">
                  {item.dateLabel || "Saved schedule"} ·{" "}
                  {(item.scheduled?.length || 0) +
                    (item.sunScheduled?.length || 0)}{" "}
                  fixtures
                </div>
              </div>

              <div className="shrink-0 text-xs font-bold text-slate-400">
                {formatDate(item.savedAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "—";
  }
}