import React, { useState } from "react";
import { DEFAULT_CLUB, MINI_KW, PITCHES } from "../lib/constants.js";

function ManualForm({ onAdd, cfgList, club = DEFAULT_CLUB }) {
  const [f, setF] = useState({
    homeTeam: "",
    awayTeam: "",
    referee: "",
    refPhone: "",
    isCup: false,
    refStatus: "TBC",
  });

  const [err, setErr] = useState("");

  const set = (key, value) => {
    setF((prev) => ({ ...prev, [key]: value }));
  };

  const cfg = cfgList.find((team) => team.name === f.homeTeam);

  const submit = () => {
    if (!f.homeTeam) return setErr("Select a team.");
    if (!f.awayTeam.trim()) return setErr("Enter the opposition.");

    setErr("");

    const selectedCfg = cfgList.find((team) => team.name === f.homeTeam);

    onAdd({
      homeTeam: club.name + " " + f.homeTeam,
      awayTeam: f.awayTeam.trim(),
      referee: f.referee.trim(),
      refPhone: f.refPhone.trim(),
      isCup: f.isCup,
      status: "active",
      league: "Manual",
      date: "Manual",
      manual: true,
      refStatus: f.refStatus,
      manualFormat: selectedCfg ? selectedCfg.format : null,
      manualPitch: selectedCfg ? selectedCfg.defaultPitch : null,
      manualMins: selectedCfg ? selectedCfg.gameMins : 60,
    });

    setF({
      homeTeam: "",
      awayTeam: "",
      referee: "",
      refPhone: "",
      isCup: false,
      refStatus: "TBC",
    });
  };

  return (
    <div>
      {err && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {err}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label={`${club.name.split(" ").slice(0, 2).join(" ")} Team`}>
          <select
            value={f.homeTeam}
            onChange={(e) => {
              set("homeTeam", e.target.value);
              set(
                "isParentRef",
                MINI_KW.some((keyword) =>
                  e.target.value.toLowerCase().includes(keyword)
                )
              );
            }}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
          >
            <option value="">Select...</option>
            {cfgList.map((team) => (
              <option key={team.name} value={team.name}>
                {team.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Opposition">
          <input
            value={f.awayTeam}
            onChange={(e) => set("awayTeam", e.target.value)}
            placeholder="e.g. Farnworth Town"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
          />
        </Field>

        <Field label="Referee">
          <input
            value={f.referee}
            onChange={(e) => set("referee", e.target.value)}
            placeholder="Name or Parent Ref"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
          />
        </Field>

        <Field label="Ref Contact">
          <input
            value={f.refPhone}
            onChange={(e) => set("refPhone", e.target.value)}
            placeholder="07xxx..."
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
          />
        </Field>

        <Field label="Ref Status">
          <select
            value={f.refStatus}
            onChange={(e) => set("refStatus", e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
          >
            <option>TBC</option>
            <option>Awaiting</option>
            <option>Confirmed</option>
          </select>
        </Field>

        <div className="flex items-end">
          <label className="flex h-12 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-100">
            <input
              type="checkbox"
              checked={f.isCup}
              onChange={(e) => set("isCup", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-500"
            />
            Cup fixture
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
        >
          + Add Fixture
        </button>

        {cfg && (
          <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
            Auto-scheduled · {cfg.format} ·{" "}
            {PITCHES.find((pitch) => pitch.id === cfg.defaultPitch)?.label}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

export default ManualForm;