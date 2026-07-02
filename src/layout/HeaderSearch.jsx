import React, { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { createNavigationController, resolveSearchNavigation } from "../lib/navigation/index.js";

export default function HeaderSearch({ setMainPage, setDayTab, setNavigationTarget }) {
  const [query, setQuery] = useState("");

  const performSearch = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;

    const match = resolveSearchNavigation(q);
    if (match) {
      const nav = createNavigationController({ setMainPage, setDayTab, setNavigationTarget });
      nav.goTo(match.target, match.options);
      return;
    }

    toast.info("No direct match found", {
      description: `Try searching for fixtures, pitch, reports, messages, analytics or settings.`,
    });
  };

  return (
    <div className="relative w-full max-w-md">
      <button
        type="button"
        onClick={performSearch}
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:text-emerald-600"
      >
        <Search size={18} />
      </button>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") performSearch();
        }}
        type="text"
        placeholder="Search Ground Control..."
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white"
      />
    </div>
  );
}