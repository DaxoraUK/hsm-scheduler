import { expect, test } from 'vitest';
import { presentList, nextListSort } from '../../src/lib/lists/listPresentation.js';

const columns = [
  { key: 'name', type: 'text', value: row => row.name },
  { key: 'hours', type: 'number', value: row => row.hours },
  { key: 'date', type: 'date', value: row => row.date },
];
test('natural display ordering never changes input array order', () => {
  const rows = [{ id: 'b', name: 'Pitch 10' }, { id: 'a', name: 'pitch 2' }];
  expect(presentList(rows, { columns, sort: { key: 'name', direction: 'asc' } }).rows.map(row => row.id)).toEqual(['a', 'b']);
  expect(rows.map(row => row.id)).toEqual(['b', 'a']);
});
test.each(['asc', 'desc'])('missing numeric values remain last for %s', direction => {
  const rows = [2, null, 10, '', undefined, 'invalid'].map((hours, id) => ({ id, hours }));
  const result = presentList(rows, { columns, sort: { key: 'hours', direction } });
  expect(result.rows.map(row => row.id)).toEqual(direction === 'asc' ? [0, 2, 1, 3, 4, 5] : [2, 0, 1, 3, 4, 5]);
});
test('dates compare chronologically with missing and invalid dates last', () => {
  const rows = [{ id: 'a', date: '2026-10-11' }, { id: 'b', date: '2026-09-01' }, { id: 'c', date: 'invalid' }];
  expect(presentList(rows, { columns, sort: { key: 'date', direction: 'asc' } }).rows.map(row => row.id)).toEqual(['b', 'a', 'c']);
});
test('search combines with domain filters and reports accurate counts', () => {
  const rows = [{ name: 'U10 Avengers', status: 'home' }, { name: 'U10 Bears', status: 'away' }, { name: 'U17 Lisbon', status: 'home' }];
  const result = presentList(rows, { columns, filters: { status: 'home' }, query: 'u10', searchText: row => row.name, matchesFilters: (row, filters) => row.status === filters.status });
  expect(result.rows.map(row => row.name)).toEqual(['U10 Avengers']);
  expect([result.resultCount, result.totalCount]).toEqual([1, 3]);
});
test('equal labels use IDs then original order when IDs are missing', () => {
  const rows = [{ id: 'z', name: 'Alpha' }, { id: 'a', name: 'Alpha' }];
  expect(presentList(rows, { columns, sort: { key: 'name', direction: 'desc' } }).rows.map(row => row.id)).toEqual(['a', 'z']);
  const anonymous = [{ name: 'same', marker: 2 }, { name: 'same', marker: 1 }];
  expect(presentList(anonymous, { columns, sort: { key: 'name', direction: 'asc' } }).rows.map(row => row.marker)).toEqual([2, 1]);
});
test('unknown sort column retains source order; header changes reset direction', () => {
  expect(presentList([3, 1], { columns, sort: { key: 'missing', direction: 'asc' } }).rows).toEqual([3, 1]);
  expect(nextListSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'desc' });
  expect(nextListSort({ key: 'name', direction: 'desc' }, 'hours')).toEqual({ key: 'hours', direction: 'asc' });
});
