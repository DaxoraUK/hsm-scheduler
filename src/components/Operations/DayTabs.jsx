import React from "react";

export default function DayTabs({
  dayTab,
  setDayTab,
  midweekEnabled = true,
  advancedOperationsEnabled = false,
}) {
  const tabs = [
    ...(advancedOperationsEnabled
      ? [["centre", "Overview", "Cross-day readiness and priority actions"]]
      : []),
    ["saturday", "Saturday", "Saturday fixtures and resources"],
    ["sunday", "Sunday", "Sunday fixtures and resources"],
    ...(midweekEnabled ? [["midweek", "Midweek", "Weekday fixtures and evening windows"]] : []),
    ...(advancedOperationsEnabled
      ? [["timeline", "Matchweek Timeline", "Combined operational sequence"]]
      : []),
  ];

  const columnClass = tabs.length >= 5
    ? "xl:grid-cols-5"
    : tabs.length === 4
      ? "xl:grid-cols-4"
      : "xl:grid-cols-3";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className={`grid gap-2 md:grid-cols-2 ${columnClass}`}>
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
              <div className={`mt-0.5 text-xs font-medium ${active ? "text-slate-300" : "text-slate-400"}`}>
                {description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
