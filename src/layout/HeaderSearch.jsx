import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { createNavigationController } from "../lib/navigation/index.js";
import { buildSystemSearchIndex, searchSystem } from "../lib/search/systemSearch.js";

export default function HeaderSearch({ setMainPage, setDayTab, setSettingsTab, setNavigationTarget, availablePages = [], fixturesByDay = {}, canOpenSettings = true, canOpenCoachHub = false, onOpenCoachHub }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const availablePageKey = availablePages.join("|");
  const index = useMemo(() => buildSystemSearchIndex({ availablePages: availablePageKey.split("|").filter(Boolean), fixturesByDay, canOpenSettings, canOpenCoachHub }), [availablePageKey, canOpenCoachHub, canOpenSettings, fixturesByDay.saturday, fixturesByDay.sunday, fixturesByDay.midweek]);
  const results = useMemo(() => searchSystem(index, query, 10), [index, query]);

  useEffect(() => setActiveIndex(0), [query]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const shortcut = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", shortcut);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", shortcut); };
  }, [open]);

  const select = (result) => {
    if (!result) return;
    if (result.action === "coach") onOpenCoachHub?.();
    else if (result.action === "page") setMainPage?.(result.page);
    else createNavigationController({ setMainPage, setDayTab, setSettingsTab, setNavigationTarget }).goTo(result.target, result.options || {});
    setQuery("");
    setOpen(false);
  };

  return <div className="relative w-full max-w-xl" ref={rootRef}>
    <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input ref={inputRef} value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((current) => Math.min(current + 1, Math.max(0, results.length - 1))); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => Math.max(0, current - 1)); }
      if (event.key === "Enter") { event.preventDefault(); select(results[activeIndex]); }
    }} type="search" role="combobox" aria-expanded={open} aria-controls="ground-control-search-results" aria-autocomplete="list" placeholder="Search pages, fixtures, teams, pitches or officials..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
    {query ? <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={15} /></button> : null}
    {open ? <section id="ground-control-search-results" role="listbox" aria-label="Ground Control search results" className="absolute left-0 right-0 top-full z-[160] mt-3 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-100">
      <div className="border-b border-slate-100 px-4 py-3"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{query ? `${results.length} result${results.length === 1 ? "" : "s"}` : "Quick access"}</div><div className="mt-1 text-xs font-semibold text-slate-500">Only areas available to your role and subscription are shown.</div></div>
      <div className="max-h-[min(60vh,520px)] overflow-y-auto p-2">
        {results.length ? results.map((result, resultIndex) => <button key={result.id} type="button" role="option" aria-selected={resultIndex === activeIndex} onMouseEnter={() => setActiveIndex(resultIndex)} onClick={() => select(result)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${resultIndex === activeIndex ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${result.category === "Fixture" ? "bg-sky-100 text-sky-700" : result.category === "Settings" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"}`}><Search size={16} /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-slate-950">{result.label}</span><span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{result.description}</span></span>
          <span className="shrink-0 text-[9px] font-black uppercase tracking-wide text-slate-400">{result.category}</span><ArrowRight className="shrink-0 text-slate-300" size={16} />
        </button>) : <div className="px-5 py-10 text-center"><div className="text-sm font-black text-slate-900">Nothing matched that search</div><p className="mt-2 text-xs font-semibold text-slate-500">Try a team, opposition, pitch, official, date or workspace name.</p></div>}
      </div>
    </section> : null}
  </div>;
}
