import React from "react";

export default function OperationsPage({ children }) {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Weekend Operations
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Plan fixtures, control the operational timeline, monitor pitch pressure, parking and coach communications.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
              Ground Ready
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
              Live workspace
            </span>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
