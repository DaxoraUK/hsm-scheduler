import { useMemo, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { buildLeagueCommandSearchIndex, searchLeagueCommandIndex } from "../../lib/league/leagueCommandSearch.js";

export default function LeagueCommandSearch({ workspace, operations, onNavigate }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef(null);
  const index = useMemo(() => buildLeagueCommandSearchIndex(workspace, operations), [operations, workspace]);
  const results = useMemo(() => searchLeagueCommandIndex(index, query), [index, query]);

  const choose = (item) => {
    setQuery("");
    setOpen(false);
    onNavigate?.(item.tab, item.child, { searchResult: item });
  };

  return (
    <div className="relative z-40">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" size={17} />
        <input
          aria-label="Search League Manager"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setQuery(""); setOpen(false); }
            if (event.key === "Enter" && results[0]) { event.preventDefault(); choose(results[0]); }
          }}
          placeholder="Search clubs, teams, grounds, fixtures or officials"
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-11 text-sm font-bold text-slate-950 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
        />
        {query ? <button type="button" aria-label="Clear League Manager search" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={15} /></button> : null}
      </div>
      {open && query.trim() ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {results.length ? <div className="max-h-[420px] overflow-y-auto p-2">{results.map((item) => (
            <button key={item.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50">
              <span className="inline-flex shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">{item.type}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-slate-950">{item.label}</span><span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{item.detail}</span></span>
              <ArrowRight className="shrink-0 text-slate-300" size={16} />
            </button>
          ))}</div> : <div className="p-6 text-center text-sm font-bold text-slate-500">No League Manager records match “{query.trim()}”.</div>}
        </div>
      ) : null}
    </div>
  );
}
