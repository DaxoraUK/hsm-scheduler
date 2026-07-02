import React from "react";
import { AlertTriangle, CalendarDays, Clock3, RotateCcw } from "lucide-react";
import MatchdayPage from "./MatchdayPage.jsx";

function MidweekDateControl({
  date,
  dateLabel,
  startTime,
  endTime,
  isWeekend,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onUseCurrentDate,
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 bg-slate-950 px-6 py-6 text-white lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.26em] text-emerald-300">
            Matchweek Calendar
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-tight">{dateLabel}</h2>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-300">
            Select any weekday fixture date and set the operating window used by the scheduling engine.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[610px]">
          <label className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <CalendarDays size={14} /> Fixture date
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => onDateChange?.(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#101a2b] px-3 text-sm font-black text-white outline-none [color-scheme:dark] focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/10"
            />
          </label>

          <label className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <Clock3 size={14} /> Window starts
            </span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => onStartTimeChange?.(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#101a2b] px-3 text-sm font-black text-white outline-none [color-scheme:dark] focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/10"
            />
          </label>

          <label className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <Clock3 size={14} /> Window ends
            </span>
            <input
              type="time"
              value={endTime}
              onChange={(event) => onEndTimeChange?.(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#101a2b] px-3 text-sm font-black text-white outline-none [color-scheme:dark] focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/10"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-900 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className={`flex items-center gap-2 text-sm font-bold ${isWeekend ? "text-amber-300" : "text-slate-300"}`}>
          {isWeekend ? <AlertTriangle size={17} /> : <CalendarDays size={17} className="text-emerald-300" />}
          {isWeekend
            ? "This date falls on a weekend. It can still be scheduled here, but Saturday/Sunday workspaces may be clearer."
            : "The selected date will be used for Full-Time import, history and analytics."}
        </div>

        <button
          type="button"
          onClick={onUseCurrentDate}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-xs font-black text-white transition hover:bg-white/[0.1]"
        >
          <RotateCcw size={15} /> Use current weekday
        </button>
      </div>
    </section>
  );
}

export default function MidweekPage(props) {
  const pageProps = {
    ...props,
    startHour: props.midweekStartHour,
    startMin: props.midweekStartMin,
    endHour: props.midweekEndHour,
    endMin: props.midweekEndMin,
  };

  return (
    <div className="space-y-6">
      <MidweekDateControl
        date={props.midweekDate}
        dateLabel={props.midweekDateLabel}
        startTime={props.midweekStartTime}
        endTime={props.midweekEndTime}
        isWeekend={props.midweekDateIsWeekend}
        onDateChange={props.setMidweekDate}
        onStartTimeChange={props.setMidweekStartTime}
        onEndTimeChange={props.setMidweekEndTime}
        onUseCurrentDate={props.useCurrentMidweekDate}
      />

      <MatchdayPage
        day="Midweek"
        fixtureDay={props.fixtureDay}
        props={pageProps}
        navigationTarget={props.navigationTarget}
        clearNavigationTarget={props.clearNavigationTarget}
        onOverride={props.midweekOv}
        hasRun={props.midweekHasRun}
        final={props.midweekFinal}
        overrides={props.midweekOverrides}
        unresolved={props.midweekUnresolved || []}
        scheduled={props.midweekScheduled || []}
        setScheduled={props.setMidweekScheduled}
        setUnresolved={props.setMidweekUnresolved}
        manualFixtures={props.midweekManual || []}
        setManualFixtures={props.setMidweekManual}
        showManual={props.showMidweekManual}
        setShowManual={props.setShowMidweekManual}
        conflicts={props.midweekConflicts || []}
        runTest={props.runMidweekTest}
        runLive={props.runMidweekLive}
        dateLabel={props.midweekDateLabel}
      />
    </div>
  );
}
