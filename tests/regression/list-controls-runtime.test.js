/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, test, expect } from 'vitest';
import useListPresentation from '../../src/hooks/useListPresentation.js';
import ListToolbar from '../../src/components/lists/ListToolbar.jsx';
import SortableTableHeader from '../../src/components/lists/SortableTableHeader.jsx';
const columns = [{ key: 'name', label: 'Name', type: 'text', value: row => row.name }, { key: 'hours', label: 'Hours', type: 'number', value: row => row.hours }];
const records = [{ id: 'a', name: 'Alpha', hours: 10, status: 'home' }, { id: 'z', name: 'Zulu', hours: 2, status: 'away' }];
const defaultSort = { key: 'name', direction: 'asc' };
let host, root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
function Harness({ contextKey = 'one', rows = records }) {
  const list = useListPresentation({ rows, columns, defaultSort, contextKey, searchText: row => row.name, matchesFilters: (row, filters) => !filters.status || row.status === filters.status });
  return React.createElement(React.Fragment, null,
    React.createElement(ListToolbar, { label: 'Fixtures', columns, sort: list.sort, onSortChange: list.setSort, resultCount: list.resultCount, totalCount: list.totalCount, activeFilterCount: Number(Boolean(list.filters.status || list.query)), filtersOpen: list.filtersOpen, onFiltersOpenChange: list.setFiltersOpen, onClearFilters: list.clearFilters, onResetView: list.resetView },
      React.createElement('input', { 'aria-label': 'Search records', value: list.query, onChange: event => list.setQuery(event.target.value) }),
      React.createElement('button', { onClick: () => list.setFilters({ status: 'home' }) }, 'Home only'),
      list.filters.status && React.createElement('span', null, `Selected: ${list.filters.status}`)),
    React.createElement('button', { onClick: () => list.setPage(3) }, 'Next page'),
    React.createElement('output', null, `page ${list.page}`),
    React.createElement('table', null, React.createElement('thead', null, React.createElement('tr', null, columns.map(column => React.createElement(SortableTableHeader, { key: column.key, columnKey: column.key, label: column.label, sort: list.sort, onSort: list.toggleSort })))), React.createElement('tbody', null, list.rows.map(row => React.createElement('tr', { key: row.id }, React.createElement('td', null, row.name))))));
}
const button = label => [...host.querySelectorAll('button')].find(row => row.textContent === label);
const names = () => [...host.querySelectorAll('tbody td')].map(row => row.textContent);
test('header toggles and dropdown shares state', async () => {
  await act(async () => root.render(React.createElement(Harness)));
  expect(names()).toEqual(['Alpha', 'Zulu']);
  await act(async () => button('Name').click());
  expect(host.querySelector('th').getAttribute('aria-sort')).toBe('descending');
  expect(names()).toEqual(['Zulu', 'Alpha']);
  await act(async () => button('Hours').click());
  expect(names()).toEqual(['Zulu', 'Alpha']);
  expect(host.querySelector('select[aria-label="Sort by"]').value).toBe('hours');
  expect(host.querySelectorAll('th')[1].getAttribute('aria-sort')).toBe('ascending');
  expect(button('Hours').tagName).toBe('BUTTON');
});
test('filters clear without losing sort; reset restores default and pagination', async () => {
  await act(async () => root.render(React.createElement(Harness)));
  await act(async () => button('Name').click());
  await act(async () => button('Filter').click());
  await act(async () => button('Next page').click());
  await act(async () => button('Home only').click());
  expect(names()).toEqual(['Alpha']);
  expect(host.textContent).toContain('1 of 2');
  expect(host.textContent).toContain('page 0');
  await act(async () => button('Clear filters').click());
  expect(names()).toEqual(['Zulu', 'Alpha']);
  await act(async () => button('Reset view').click());
  expect(names()).toEqual(['Alpha', 'Zulu']);
});
test('context changes reset filters immediately and stale filter remains clearable', async () => {
  await act(async () => root.render(React.createElement(Harness)));
  await act(async () => button('Filter').click());
  await act(async () => button('Home only').click());
  await act(async () => root.render(React.createElement(Harness, { rows: [records[1]] })));
  expect(names()).toEqual([]);
  expect(host.textContent).toContain('Selected: home');
  expect(button('Clear filters')).toBeDefined();
  await act(async () => root.render(React.createElement(Harness, { contextKey: 'two', rows: [records[1]] })));
  expect(names()).toEqual(['Zulu']);
  expect(host.textContent).not.toContain('Selected: home');
});
