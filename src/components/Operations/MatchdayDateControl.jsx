import React from "react";
import { CalendarDays, RotateCcw } from "lucide-react";

export default function MatchdayDateControl({
  day,
  date,
  dateLabel,
  pairedDateLabel,
  onDateChange,
  onUseCurrentWeekend,
}) {
  const isSaturday = String(day).toLowerCase() === "saturday";
  const pairedDay = isSaturday ? "Sunday" : "Saturday";

  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <CalendarDays size={19} strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">
              Matchweek calendar
            </div>
            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
              {dateLabel || `${day} fixture date`}
            </h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
              Choose the {String(day).toLowerCase()} being scheduled. Changing the date clears the built weekend schedule so old assignments cannot be published against the wrong matchweek.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:shrink-0">
          <label className="min-w-0 flex-1 sm:min-w-[210px]">
            <span className="sr-only">Select {day} fixture date</span>
            <input
              type="date"
              value={date || ""}
              onChange={(event) => onDateChange?.(event.target.value)}
              aria-label={`Select ${day} fixture date`}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="button"
            onClick={onUseCurrentWeekend}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-white"
          >
            <RotateCcw size={16} /> Current weekend
          </button>
        </div>
      </div>

      {pairedDateLabel ? (
        <div className="mt-4 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500">
          Paired {pairedDay}: <span className="text-slate-800">{pairedDateLabel}</span>
        </div>
      ) : null}
    </section>
  );
}
