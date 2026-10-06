import React from 'react';
import { WEEKDAYS } from '../../lib/scheduling/pitchResourceModel.js';
import { inputClass, selectClass, SecondaryButton } from './SettingsPrimitives.jsx';

const title = value => value[0].toUpperCase() + value.slice(1);

export default function PitchSchedulingFields({ pitch, pitches, onPitchPatch, onAddPlayingArea, onRemovePlayingArea, errors = [] }) {
  const parent = pitches.find(p => p.id === pitch.innerOf);
  const areas = Array.isArray(pitch.playingAreas) ? pitch.playingAreas : [];
  const availability = pitch.availabilityByDay || {};
  const setDay = (day, windows) => {
    const next = { ...availability };
    if (windows === undefined) delete next[day]; else next[day] = windows;
    onPitchPatch({ availabilityByDay: next });
  };
  return <section className="col-span-full space-y-4 rounded-2xl border border-emerald-200 bg-white p-4" aria-label="Match scheduling settings">
    <div>
      <h3 className="text-sm font-black text-slate-950">Playing areas</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">Physical match areas are separate from training capacity. Disjoint mapped areas may play together; using the whole parent occupies every area.</p>
    </div>
    {!pitch.innerOf ? <>
      {areas.map((area, index) => <div key={area?.id || index} className="flex gap-2">
        <input className={inputClass} aria-label={`Playing area name ${index + 1}`} value={area?.label || ''} onChange={event => onPitchPatch({ playingAreas: areas.map((row, i) => i === index ? { ...row, label: event.target.value } : row) })} />
        <button type="button" className="shrink-0 text-xs font-bold text-rose-700" onClick={() => onRemovePlayingArea(area?.id)} aria-label={`Remove playing area ${area?.label || index + 1}`}>Remove area</button>
      </div>)}
      <SecondaryButton onClick={onAddPlayingArea}>Add playing area</SecondaryButton>
      <p className="text-xs text-slate-500">Each new area creates a mapped child pitch within your pitch allowance. Remove its child layout first if you need to remove a referenced area.</p>
    </> : <div className="space-y-2">
      <p className="text-xs text-slate-600">Select the physical areas this layout occupies. Unmapped legacy layouts conservatively occupy the whole parent.</p>
      {(parent?.playingAreas || []).map(area => <label key={area.id} className="flex items-center gap-2 text-sm">
        <input type="checkbox" aria-label={`Uses playing area ${area.label || area.id}`} checked={Boolean(pitch.playingAreaIds?.includes(area.id))} onChange={event => onPitchPatch({ playingAreaIds: event.target.checked ? [...(pitch.playingAreaIds || []), area.id] : (pitch.playingAreaIds || []).filter(id => id !== area.id) })} />
        {area.label || area.id}
      </label>)}
      {!parent?.playingAreas?.length ? <p className="text-xs text-amber-800">Configure playing areas on the parent first to allow separate concurrent layouts.</p> : null}
    </div>}
    <div>
      <h3 className="text-sm font-black text-slate-950">Day-specific availability</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">Inherit uses the parent and club timing limits. Explicit windows are available-from to clear-by: the full match and turnaround must finish inside the window. Latest kick-off remains a separate club rule.</p>
    </div>
    {WEEKDAYS.map(day => {
      const windows = availability[day];
      const mode = windows == null ? 'inherit' : Array.isArray(windows) && windows.length === 0 ? 'closed' : 'custom';
      const name = title(day);
      return <div key={day} className="rounded-xl border border-slate-200 p-3">
        <label className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">{name}
          <select className={`${selectClass} max-w-48`} aria-label={`${name} availability`} value={mode} onChange={event => setDay(day, event.target.value === 'inherit' ? undefined : event.target.value === 'closed' ? [] : [{ from: '09:00', to: '17:00' }])}>
            <option value="inherit">Inherit</option><option value="closed">Unavailable</option><option value="custom">Custom windows</option>
          </select>
        </label>
        {mode === 'custom' ? <div className="mt-3 space-y-2">
          {(Array.isArray(windows) ? windows : []).map((window, index) => <div key={index} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
            {['from', 'to'].map(field => <label key={field} className="text-xs text-slate-600">{field === 'from' ? 'Available from' : 'Available until'}
              <input type="time" className={inputClass} aria-label={`${name} available ${field === 'from' ? 'from' : 'until'} ${index + 1}`} value={window?.[field] || ''} onChange={event => setDay(day, windows.map((row, i) => i === index ? { ...row, [field]: event.target.value } : row))} />
            </label>)}
            <button type="button" className="text-xs font-bold text-rose-700" onClick={() => setDay(day, windows.filter((_, i) => i !== index))} aria-label={`Remove ${name} window ${index + 1}`}>Remove</button>
          </div>)}
          <SecondaryButton onClick={() => setDay(day, [...(Array.isArray(windows) ? windows : []), { from: '', to: '' }])}>Add {name} window</SecondaryButton>
        </div> : null}
      </div>;
    })}
    {errors.length ? <p role="alert" className="text-xs font-bold text-rose-700">{errors.join(' ')}</p> : null}
  </section>;
}
