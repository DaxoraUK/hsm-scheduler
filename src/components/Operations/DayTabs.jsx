import React from "react";

export default function DayTabs({ dayTab, setDayTab, midweekEnabled = true }) {
  const tabs = [
    ["centre", "Operations Centre", "Cross-day readiness and exceptions"],
    ["saturday", "Saturday", "Saturday fixtures and resources"],
    ["sunday", "Sunday", "Sunday fixtures and resources"],
    ...(midweekEnabled ? [["midweek", "Midweek", "Weekday fixtures and evening windows"]] : []),
    ["timeline", "Timeline", "Combined matchweek sequence"],
  ];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
      <div
        className={`grid gap-2 md:grid-cols-2 ${
          tabs.length === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4"
        }`}
      >
        {tabs.map(([key, label, description]) => {
          const active = dayTab === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setDayTab(key)}
              className={`rounded-2xl px-5 py-3 text-left transition ${
                active
                  ? "bg-slate-950 text-white shadow-md"
                  : "bg-transparent text-slate-500 hover:bg-slate-50"
              }`}
            >
              <div className="text-sm font-black">{label}</div>
              <div
                className={`mt-0.5 text-xs font-medium ${
                  active ? "text-slate-300" : "text-slate-400"
                }`}
              >
                {description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
