import { compareTeamsByAgeGroup } from '../teams/teamOrdering.js';

const collator = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base', ignorePunctuation: true });

export function nextListSort(current, key) {
  return { key, direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc' };
}

function normalizedValue(value, type) {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  if (type === 'number') return Number.isFinite(Number(value)) ? Number(value) : null;
  if (type === 'date') {
    const date = value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(date) ? date : null;
  }
  return value;
}

export function presentList(rows, { columns = [], sort, filters = {}, query = '', searchText = () => '', matchesFilters = () => true, getId = row => row?.id } = {}) {
  const source = Array.isArray(rows) ? rows : [];
  const search = String(query).trim().toLocaleLowerCase('en-GB');
  const column = columns.find(item => item.key === sort?.key);
  const entries = source.map((row, index) => ({ row, index })).filter(({ row }) => (
    matchesFilters(row, filters) && (!search || String(searchText(row)).toLocaleLowerCase('en-GB').includes(search))
  ));
  if (column) entries.sort((left, right) => {
    const a = normalizedValue(column.value(left.row), column.type);
    const b = normalizedValue(column.value(right.row), column.type);
    if (a == null && b != null) return 1;
    if (b == null && a != null) return -1;
    let comparison = 0;
    if (a != null && b != null) {
      comparison = column.type === 'team' ? compareTeamsByAgeGroup(a, b)
        : ['number', 'date'].includes(column.type) ? a - b : collator.compare(String(a), String(b));
    }
    if (comparison) return comparison * (sort.direction === 'desc' ? -1 : 1);
    const leftId = getId(left.row), rightId = getId(right.row);
    return leftId != null && rightId != null ? collator.compare(String(leftId), String(rightId)) || left.index - right.index : left.index - right.index;
  });
  return { rows: entries.map(entry => entry.row), totalCount: source.length, resultCount: entries.length };
}
