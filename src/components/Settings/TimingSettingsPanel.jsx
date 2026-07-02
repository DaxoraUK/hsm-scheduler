import React from "react";
import { CalendarClock, RotateCcw, TimerReset } from "lucide-react";
import {
  Field,
  Notice,
  SaveBar,
  SecondaryButton,
  SettingsPanel,
  SettingsSectionHeader,
  StatTile,
  inputClass,
  selectClass,
} from "./SettingsPrimitives.jsx";

const MINUTE_OPTIONS = [0, 15, 30, 45];

function formatTime(hour, minute) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export default function TimingSettingsPanel({
  club = {},
  setClub,
  startHour,
  setStartHour,
  startMin,
  setStartMin,
  endHour,
  setEndHour,
  endMin,
  setEndMin,
  bufferYouth,
  setBufferYouth,
  bufferAdult,
  setBufferAdult,
  DEFAULT_BUFFER_YOUTH,
  DEFAULT_BUFFER_ADULT,
  saveTab,
  savedTab,
}) {
  const start = formatTime(startHour, startMin);
  const end = formatTime(endHour, endMin);

  const reset = () => {
    setBufferYouth(DEFAULT_BUFFER_YOUTH);
    setBufferAdult(DEFAULT_BUFFER_ADULT);
    setStartHour(8);
    setStartMin(30);
    setEndHour(11);
    setEndMin(30);
    setClub((current) => ({ ...current, maxConcurrent: 3 }));
  };

  return (
    <div className="space-y-5">
      <SettingsPanel>
        <SettingsSectionHeader
          icon={CalendarClock}
          eyebrow="Scheduling"
          title="Weekend operating rules"
          description="These settings control Saturday and Sunday fixture placement. Midweek uses its selected evening window inside Operations."
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Earliest kick-off" value={start} tone="green" />
          <StatTile label="Latest youth kick-off" value={end} tone="blue" />
          <StatTile label="Youth turnaround" value={`${bufferYouth} min`} tone="amber" />
          <StatTile label="Adult turnaround" value={`${bufferAdult} min`} tone="violet" />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-black text-slate-950">Operating window</h3>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">The scheduler places youth fixtures between these boundaries.</p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Field label="Start hour">
                <input type="number" min={6} max={13} className={inputClass} value={startHour} onChange={(event) => setStartHour(Number(event.target.value))} />
              </Field>
              <Field label="Start minute">
                <select className={selectClass} value={startMin} onChange={(event) => setStartMin(Number(event.target.value))}>{MINUTE_OPTIONS.map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>)}</select>
              </Field>
              <Field label="End hour">
                <input type="number" min={8} max={16} className={inputClass} value={endHour} onChange={(event) => setEndHour(Number(event.target.value))} />
              </Field>
              <Field label="End minute">
                <select className={selectClass} value={endMin} onChange={(event) => setEndMin(Number(event.target.value))}>{MINUTE_OPTIONS.map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>)}</select>
              </Field>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-black text-slate-950">Pitch turnaround</h3>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">Buffers protect changeovers and reduce overlapping arrivals.</p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Field label="Youth buffer">
                <input type="number" min={0} max={45} step={5} className={inputClass} value={bufferYouth} onChange={(event) => setBufferYouth(Number(event.target.value))} />
              </Field>
              <Field label="Adult buffer">
                <input type="number" min={0} max={60} step={5} className={inputClass} value={bufferAdult} onChange={(event) => setBufferAdult(Number(event.target.value))} />
              </Field>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5">
          <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
            <Field label="Maximum concurrent games">
              <input
                type="number"
                min={1}
                max={30}
                className={inputClass}
                value={club.maxConcurrent || 3}
                onChange={(event) => setClub((current) => ({ ...current, maxConcurrent: Math.max(1, Number(event.target.value) || 1) }))}
              />
            </Field>
            <div className="text-sm font-semibold leading-6 text-slate-500">
              The total number of fixtures the site can safely support at the same time. Independent pitches do not count towards this limit.
            </div>
          </div>
        </div>

        <Notice tone="info" className="mt-5">
          Adult/open-age weekend fixtures continue to use the weekend adult rule. Midweek adult fixtures are unrestricted inside the selected Midweek operating window.
        </Notice>

        <SaveBar onSave={() => saveTab?.("timing", { club })} saved={savedTab === "timing"} label="Save scheduling rules">
          <SecondaryButton icon={RotateCcw} onClick={reset}>Restore defaults</SecondaryButton>
        </SaveBar>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSectionHeader
          icon={TimerReset}
          eyebrow="Operational guidance"
          title="Where temporary changes belong"
          description="Pitch closures, one-off timing overrides and matchweek incidents stay in Operations so the permanent club configuration remains clean."
        />
      </SettingsPanel>
    </div>
  );
}
