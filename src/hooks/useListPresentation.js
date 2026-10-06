import { useState } from 'react';
import { nextListSort, presentList } from '../lib/lists/listPresentation.js';

export default function useListPresentation({ rows, columns, defaultSort, contextKey, initialFilters = {}, emptyFilters = {}, searchText, matchesFilters, getId }) {
  const initialState = () => ({ contextKey, sort: defaultSort, filters: initialFilters, query: '', page: 0, filtersOpen: false });
  const [state, setState] = useState(initialState);
  const current = state.contextKey === contextKey ? state : initialState();
  if (state.contextKey !== contextKey) setState(current);
  const update = patch => setState(previous => ({ ...previous, ...patch }));
  const validSort = columns.some(column => column.key === current.sort?.key) ? current.sort : defaultSort;
  return {
    ...current,
    sort: validSort,
    ...presentList(rows, { columns, sort: validSort, filters: current.filters, query: current.query, searchText, matchesFilters, getId }),
    setSort: sort => { if (columns.some(column => column.key === sort?.key)) update({ sort: { key: sort.key, direction: sort.direction === 'desc' ? 'desc' : 'asc' } }); },
    toggleSort: key => { if (columns.some(column => column.key === key)) update({ sort: nextListSort(validSort, key) }); },
    setFilters: filters => setState(previous => ({ ...previous, filters: typeof filters === 'function' ? filters(previous.filters) : filters, page: 0 })),
    setQuery: query => update({ query, page: 0 }),
    clearFilters: () => update({ filters: emptyFilters, query: '', page: 0 }),
    resetView: () => setState(initialState()),
    setPage: page => update({ page }),
    setFiltersOpen: filtersOpen => update({ filtersOpen }),
  };
}
