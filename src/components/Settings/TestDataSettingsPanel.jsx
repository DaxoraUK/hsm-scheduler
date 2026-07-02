import React, { useState } from "react";
import { Plus, RotateCcw, TestTube2, Trash2 } from "lucide-react";
import { TEST_SAT, TEST_SUN } from "../../lib/constants.js";
import { isSupaConfigured, supaFetch } from "../../lib/supabase.js";
import {
  Field,
  Notice,
  PrimaryButton,
  SecondaryButton,
  SettingsPanel,
  SettingsSectionHeader,
  inputClass,
  selectClass,
} from "./SettingsPrimitives.jsx";

function blankFixture() {
  return { homeTeam: "", awayTeam: "", league: "", isCup: false, status: "active", referee: "", refPhone: "", refStatus: "TBC" };
}

export default function TestDataSettingsPanel({ testSat = [], setTestSat, testSun = [], setTestSun, club = {}, teamCfg = [] }) {
  const [day, setDay] = useState("sat");
  const [saved, setSaved] = useState("");
  const list = day === "sat" ? testSat : testSun;
  const setList = day === "sat" ? setTestSat : setTestSun;

  const update = (index, field, value) => setList((current) => current.map((fixture, rowIndex) => rowIndex === index ? { ...fixture, [field]: value } : fixture));

  const save = () => {
    try {
      localStorage.setItem(day === "sat" ? "hsm_testsat" : "hsm_testsun", JSON.stringify(list));
    } catch (error) {}
    if (isSupaConfigured()) {
      const key = day === "sat" ? "testsat" : "testsun";
      supaFetch("DELETE", `club_config?id=eq.${key}`);
      supaFetch("POST", "club_config", [{ id: key, data: { fixtures: list } }], { Prefer: "return=minimal" });
    }
    setSaved(day);
    window.setTimeout(() => setSaved(""), 2200);
  };

  return (
    <SettingsPanel>
      <SettingsSectionHeader
        icon={TestTube2}
        eyebrow="Development only"
        title="Demonstration fixtures"
        description="Prepare repeatable Saturday and Sunday fixtures for product demonstrations. This page disappears in production mode."
      />

      <div className="mt-5 inline-flex rounded-2xl bg-slate-100 p-1">
        <button type="button" onClick={() => setDay("sat")} className={`rounded-xl px-4 py-2 text-sm font-black transition ${day === "sat" ? "bg-slate-950 text-white shadow" : "text-slate-500"}`}>Saturday ({testSat.length})</button>
        <button type="button" onClick={() => setDay("sun")} className={`rounded-xl px-4 py-2 text-sm font-black transition ${day === "sun" ? "bg-slate-950 text-white shadow" : "text-slate-500"}`}>Sunday ({testSun.length})</button>
      </div>

      <Notice tone="warning">These fixtures are not operational records and should never be mixed with a live club matchweek.</Notice>

      <div className="mt-5 space-y-3">
        {list.map((fixture, index) => (
          <div key={index} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_160px_auto_auto] xl:items-end">
              <Field label="Home team">
                <select className={selectClass} value={fixture.homeTeam || ""} onChange={(event) => update(index, "homeTeam", event.target.value)}>
                  <option value="">Select team…</option>
                  {teamCfg.map((team) => {
                    const full = `${club.name} ${team.name}`;
                    return <option key={team.name} value={full}>{team.name}</option>;
                  })}
                </select>
              </Field>
              <Field label="Opposition"><input className={inputClass} value={fixture.awayTeam || ""} onChange={(event) => update(index, "awayTeam", event.target.value)} placeholder="Opposition" /></Field>
              <Field label="League"><input className={inputClass} value={fixture.league || ""} onChange={(event) => update(index, "league", event.target.value)} placeholder="League" /></Field>
              <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-black text-slate-700"><input type="checkbox" checked={!!fixture.isCup} onChange={(event) => update(index, "isCup", event.target.checked)} className="h-5 w-5 rounded border-slate-300" /> Cup</label>
              <button type="button" onClick={() => setList((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="flex h-11 w-11 items-center justify-center rounded-2xl text-rose-600 transition hover:bg-rose-50" aria-label="Remove test fixture"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>

      {!list.length ? <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">No demonstration fixtures for this day.</div> : null}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
        <PrimaryButton icon={Plus} onClick={() => setList((current) => [...current, blankFixture()])}>Add fixture</PrimaryButton>
        <SecondaryButton onClick={save}>{saved === day ? "Saved" : `Save ${day === "sat" ? "Saturday" : "Sunday"}`}</SecondaryButton>
        <SecondaryButton icon={RotateCcw} onClick={() => setList(day === "sat" ? TEST_SAT : TEST_SUN)}>Restore demo data</SecondaryButton>
      </div>
    </SettingsPanel>
  );
}
