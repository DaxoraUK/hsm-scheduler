import React from "react";
import { Bell } from "lucide-react";

export default function HeaderProfile() {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
      >
        <Bell size={19} strokeWidth={2.5} />
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-500" />
      </button>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-sm font-black text-white">
          A
        </div>

        <div className="hidden sm:block">
          <div className="text-sm font-black text-slate-950">Andrew</div>
          <div className="text-xs font-bold text-slate-500">
            Club Administrator
          </div>
        </div>
      </div>
    </div>
  );
}