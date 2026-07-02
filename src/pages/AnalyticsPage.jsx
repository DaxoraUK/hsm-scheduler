import React, { useState } from "react";
import { BarChart3, FileCheck2 } from "lucide-react";
import AnalyticsVisualDashboard from "../components/analytics/AnalyticsVisualDashboard.jsx";
import GrantImpactDashboard from "../components/analytics/GrantImpactDashboard.jsx";

const VIEWS = [
  {
    id: "performance",
    label: "Performance analytics",
    icon: BarChart3,
  },
  {
    id: "funding",
    label: "Funding evidence",
    icon: FileCheck2,
  },
];

export default function AnalyticsPage(props) {
  const [view, setView] = useState("performance");

  return (
    <>
      <div className="mx-auto mb-6 w-full max-w-7xl">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${
                  active
                    ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={17} className={active ? "text-emerald-300" : "text-slate-400"} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {view === "performance" ? (
        <AnalyticsVisualDashboard {...props} />
      ) : (
        <GrantImpactDashboard {...props} />
      )}
    </>
  );
}
