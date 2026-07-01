import React from "react";

export default function DefinitionList({ items = [], className = "" }) {
  return (
    <dl className={`divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white ${className}`}>
      {items.map((item, index) => (
        <div key={item.key || item.label || index} className="flex items-start justify-between gap-4 px-4 py-3">
          <dt className="text-sm font-bold text-slate-500">{item.label}</dt>
          <dd className="text-right text-sm font-black text-slate-950">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
