import React from 'react';
import useListPresentation from '../../hooks/useListPresentation.js';
import ListToolbar from './ListToolbar.jsx';

const fieldClass = 'min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700';
const optionsCollator = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' });

export default function RecordCollection({ label, rows = [], columns, filterFields = [], defaultSort, contextKey, totalCount, search = true, searchText, externalActiveFilterCount = 0, onClearExternal, onResetExternal, interactive = true, children }) {
  const list = useListPresentation({
    rows, columns, defaultSort: defaultSort || { key: columns[0]?.key, direction: 'asc' }, contextKey,
    searchText: searchText || (row => columns.map(column => {
      const value = column.value(row);
      return column.type === 'team' ? value?.name || value?.teamName || '' : value;
    }).join(' ')),
    matchesFilters: (row, filters) => filterFields.every(field => !filters[field.key] || String(field.value(row) ?? '') === filters[field.key]),
  });
  if (!interactive) return children(rows, list);
  const activeFilterCount = Object.values(list.filters).filter(Boolean).length + Number(Boolean(list.query)) + externalActiveFilterCount;
  const clear = () => { list.clearFilters(); onClearExternal?.(); };
  return <>
    <ListToolbar label={label} columns={columns} sort={list.sort} onSortChange={list.setSort} resultCount={list.resultCount} totalCount={totalCount ?? list.totalCount} activeFilterCount={activeFilterCount} filtersOpen={list.filtersOpen} onFiltersOpenChange={list.setFiltersOpen} onClearFilters={clear} onResetView={() => { list.resetView(); onResetExternal?.(); }}>
      {search || filterFields.length ? <>
        {search ? <label className="min-w-40 flex-1 text-xs font-bold text-slate-600">Search<input className={`${fieldClass} mt-1`} aria-label={`Search ${label}`} value={list.query} onChange={event => list.setQuery(event.target.value)} /></label> : null}
        {filterFields.map(field => {
          const options = [...new Set([...rows.map(row => String(field.value(row) ?? '')), list.filters[field.key] || ''])].filter(Boolean).sort(optionsCollator.compare);
          return <label key={field.key} className="min-w-32 flex-1 text-xs font-bold text-slate-600">{field.label}<select className={`${fieldClass} mt-1`} aria-label={`Filter by ${field.label}`} value={list.filters[field.key] || ''} onChange={event => list.setFilters(current => ({ ...current, [field.key]: event.target.value }))}><option value="">All</option>{options.map(value => <option key={value} value={value}>{field.labelForValue?.(value) || value}</option>)}</select></label>;
        })}
      </> : null}
    </ListToolbar>
    {!list.resultCount ? <div className="my-3 rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No records match these filters. <button type="button" className="font-bold text-emerald-700 underline" onClick={clear}>Clear filters</button></div> : null}
    {children(list.rows, list)}
  </>;
}
