import { Clock3 } from "lucide-react";
import { buildHalfHourTimeOptions } from "../../lib/planning/trainingPolicyEngine.js";

export default function HalfHourTimeSelector({
  value = [],
  earliestStartTime = "17:00",
  latestEndTime = "21:00",
  durationMinutes = 60,
  disabled = false,
  onChange,
  compact = false,
}) {
  const options = buildHalfHourTimeOptions({ earliestStartTime, latestEndTime, durationMinutes });
  const selected = new Set(Array.isArray(value) ? value : []);

  function toggle(time) {
    if (disabled) return;
    const next = selected.has(time)
      ? options.filter((option) => selected.has(option) && option !== time)
      : options.filter((option) => selected.has(option) || option === time);
    onChange?.(next);
  }

  return <div className={`rounded-2xl border border-slate-200 bg-slate-50 ${compact ? "p-3" : "p-4"}`}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-xs font-black text-slate-800"><Clock3 size={15} /> Select preferred start times</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">30-minute intervals</div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((time) => {
        const active = selected.has(time);
        return <button
          key={time}
          type="button"
          disabled={disabled}
          aria-pressed={active}
          onClick={() => toggle(time)}
          className={`h-9 min-w-[72px] rounded-xl border px-3 text-xs font-black transition ${active ? "border-violet-300 bg-violet-100 text-violet-900 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100"} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {time}
        </button>;
      })}
    </div>
    <div className="mt-3 text-[11px] font-semibold text-slate-500">
      Available starts respect the permitted window and the selected session duration. Choose at least one preferred time.
    </div>
  </div>;
}
