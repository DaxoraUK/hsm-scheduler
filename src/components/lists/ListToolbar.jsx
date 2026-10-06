import React, { useId } from 'react';
import { ArrowDown, ArrowUp, Filter, RotateCcw } from 'lucide-react';

const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500';

export default function ListToolbar({ label, columns, sort, onSortChange, resultCount, totalCount, activeFilterCount = 0, filtersOpen, onFiltersOpenChange, onClearFilters, onResetView, children, resultScopeLabel = '' }) {
  const panelId = useId();
  const Direction = sort?.direction === 'desc' ? ArrowDown : ArrowUp;
  return <div className="col-span-full min-w-0 space-y-3 print:hidden" role="group" aria-label={`${label} sort and filter`}>
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white pl-3 text-xs font-bold text-slate-700">
        Sort<select aria-label="Sort by" value={sort?.key || ''} onChange={event => onSortChange({ key: event.target.value, direction: 'asc' })} className="min-h-10 max-w-[180px] rounded-xl bg-transparent pr-2 focus-visible:outline-2 focus-visible:outline-emerald-500">
          {columns.map(column => <option key={column.key} value={column.key}>{column.label}</option>)}
        </select>
      </label>
      <button type="button" className={buttonClass} aria-label={sort?.direction === 'desc' ? 'Sort ascending' : 'Sort descending'} onClick={() => onSortChange({ ...sort, direction: sort?.direction === 'desc' ? 'asc' : 'desc' })}><Direction size={15} aria-hidden="true" /></button>
      {children ? <button type="button" className={buttonClass} aria-expanded={Boolean(filtersOpen)} aria-controls={panelId} onClick={() => onFiltersOpenChange(!filtersOpen)}><Filter size={14} aria-hidden="true" />Filter{activeFilterCount ? <span className="rounded-full bg-emerald-100 px-1.5 text-emerald-800">{activeFilterCount}</span> : null}</button> : null}
      {!children && activeFilterCount > 0 ? <span className="text-xs font-semibold text-emerald-700">{activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}</span> : null}
      {activeFilterCount > 0 || resultCount === 0 ? <button type="button" onClick={onClearFilters} className={buttonClass}>Clear filters</button> : null}
      <button type="button" onClick={onResetView} className={buttonClass}><RotateCcw size={13} aria-hidden="true" />Reset view</button>
      <span className="ml-auto text-xs font-semibold text-slate-500" role="status">{resultCount} of {totalCount}{resultScopeLabel ? ` · ${resultScopeLabel}` : ''}</span>
    </div>
    {children && filtersOpen ? <div id={panelId} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">{children}</div> : null}
  </div>;
}
