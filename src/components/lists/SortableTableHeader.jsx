import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export default function SortableTableHeader({ columnKey, label, sort, onSort, className = '', as: Tag = 'th' }) {
  const active = sort?.key === columnKey;
  const Icon = active ? sort.direction === 'desc' ? ArrowDown : ArrowUp : ArrowUpDown;
  return <Tag scope={Tag === "th" ? "col" : undefined} role={Tag === "th" ? undefined : "columnheader"} aria-sort={active ? sort.direction === 'desc' ? 'descending' : 'ascending' : 'none'} className={className}>
    <button type="button" onClick={() => onSort(columnKey)} className="inline-flex items-center gap-1.5 rounded text-left font-inherit hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500">
      {label}<Icon size={12} aria-hidden="true" className={active ? 'shrink-0 text-emerald-700' : 'shrink-0 opacity-40'} />
    </button>
  </Tag>;
}
