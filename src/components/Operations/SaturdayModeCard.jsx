import React from "react";

export default function SaturdayModeCard({
  mode,
  testSat = [],
  useAstro,
  setUseAstro,
  satDate,
  setSatDate,
  runSatTest,
  runSatLive,
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-6 border-b border-slate-200 px-6 py-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
            Saturday Operations
          </div>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {mode === "test" ? "Test schedule" : "Live FA Full-Time schedule"}
          </h2>

          <p className="mt-2 text-base font-medium text-slate-500">
            {mode === "test"
              ? `Use saved test fixtures to validate the Saturday schedule. ${testSat.length} fixtures available.`
              : "Fetch Saturday fixtures and build the matchday plan."}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={!!useAstro}
              onChange={(e) => setUseAstro(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            Allow artificial surfaces
          </label>

          {mode === "test" ? (
            <button
              type="button"
              onClick={runSatTest}
              className="h-12 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 active:scale-[0.98]"
            >
              Run Saturday Test
            </button>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                  Saturday date
                </label>
                <input
                  type="date"
                  value={satDate}
                  onChange={(e) => setSatDate(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                />
              </div>

              <button
                type="button"
                onClick={runSatLive}
                className="h-12 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 active:scale-[0.98]"
              >
                Fetch Saturday Fixtures
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}