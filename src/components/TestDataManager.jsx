import React, { useState } from "react";
import { RE, WH } from "../lib/constants.js";
import { createTestDataSeed, generateTestFixtures } from "../lib/testData/testFixtureGenerator.js";
import { S } from "../lib/styles.js";

const DAY_OPTIONS = [
  { key: "sat", dayKey: "saturday", label: "Saturday" },
  { key: "sun", dayKey: "sunday", label: "Sunday" },
  { key: "midweek", dayKey: "midweek", label: "Midweek" },
];

function TestDataManager(props) {
  const {
    testSat = [],
    setTestSat,
    testSun = [],
    setTestSun,
    testMidweek = [],
    setTestMidweek,
    club,
    onSave,
    cfgList = [],
  } = props;

  const [day, setDay] = useState("sat");
  const [saved, setSaved] = useState("");

  const collections = {
    sat: { list: testSat, setList: setTestSat },
    sun: { list: testSun, setList: setTestSun },
    midweek: { list: testMidweek, setList: setTestMidweek },
  };
  const current = collections[day] || collections.sat;
  const list = current.list || [];
  const setList = current.setList;
  const activeOption = DAY_OPTIONS.find((option) => option.key === day) || DAY_OPTIONS[0];

  function blank() {
    return {
      homeTeam: "",
      awayTeam: "",
      league: "",
      isCup: false,
      status: "active",
      referee: "",
      refPhone: "",
      refStatus: "TBC",
      fixtureDayKey: activeOption.dayKey,
      __day: activeOption.dayKey,
    };
  }

  function update(index, field, value) {
    const copy = list.slice();
    copy[index] = { ...copy[index], [field]: value };
    setList?.(copy);
  }

  function add() {
    setList?.([...list, blank()]);
  }

  function remove(index) {
    setList?.(list.filter((_, itemIndex) => itemIndex !== index));
  }

  function save() {
    onSave?.(day);
    setSaved(day);
    window.setTimeout(() => setSaved(""), 2500);
  }

  const inputStyle = {
    border: "1px solid #ddd",
    borderRadius: 4,
    padding: "5px 8px",
    fontSize: 12,
    width: "100%",
    boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: 10,
    fontWeight: 600,
    color: "#888",
    marginBottom: 2,
    display: "block",
  };

  return (
    <div style={S.card} className="np">
      <div style={{ background: club.primary, color: WH, padding: "10px 14px", fontWeight: 600, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Test Data Manager</span>
        <span style={{ fontSize: 11, fontWeight: 400 }}>{list.length} fixtures</span>
      </div>

      <div style={S.cb}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
          Each fixture-day workspace has isolated, seeded demonstration data.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0, marginBottom: 16, background: "#f0f0f0", borderRadius: 8, overflow: "hidden", maxWidth: 470 }}>
          {DAY_OPTIONS.map((option) => {
            const count = collections[option.key]?.list?.length || 0;
            const active = day === option.key;
            return (
              <button key={option.key} type="button" onClick={() => setDay(option.key)} style={{ padding: "8px 4px", fontSize: 12, fontWeight: active ? 700 : 400, background: active ? club.primary : "transparent", color: active ? "#fff" : "#666", border: "none", cursor: "pointer" }}>
                {option.label} ({count})
              </button>
            );
          })}
        </div>

        {list.map((fixture, index) => (
          <div key={`${fixture.homeTeam || "fixture"}-${index}`} style={{ border: "1px solid #eee", borderRadius: 6, padding: 10, marginBottom: 8, background: "#fafafa" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 180px" }}>
                <label style={labelStyle}>Home Team</label>
                <select style={inputStyle} value={fixture.homeTeam} onChange={(event) => update(index, "homeTeam", event.target.value)}>
                  <option value="">Select team...</option>
                  {cfgList.map((team) => {
                    const full = `${club.name} ${team.name}`;
                    return <option key={team.name} value={full}>{team.name}</option>;
                  })}
                </select>
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <label style={labelStyle}>Opposition</label>
                <input style={inputStyle} value={fixture.awayTeam} onChange={(event) => update(index, "awayTeam", event.target.value)} placeholder="Opposition" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 120px" }}>
                <label style={labelStyle}>League</label>
                <input style={inputStyle} value={fixture.league} onChange={(event) => update(index, "league", event.target.value)} placeholder="League" />
              </div>
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", paddingBottom: 6 }}>
                <input type="checkbox" checked={fixture.isCup} onChange={(event) => update(index, "isCup", event.target.checked)} /> Cup game
              </label>
              <button type="button" onClick={() => remove(index)} style={{ marginLeft: "auto", background: "#FEF2F2", color: RE, border: "1px solid #FECACA", borderRadius: 4, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Remove</button>
            </div>
          </div>
        ))}

        {list.length === 0 && <div style={{ fontSize: 12, color: "#aaa", textAlign: "center", padding: 16 }}>No test fixtures yet.</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={add} style={{ ...S.btn(club.primary) }}>+ Add Fixture</button>
          <button type="button" onClick={save} style={{ ...S.btn(club.secondary) }}>{saved === day ? "Saved" : `Save ${activeOption.label} Test Data`}</button>
          <button
            type="button"
            onClick={() => setList?.(generateTestFixtures({ dayKey: activeOption.dayKey, seed: createTestDataSeed(activeOption.dayKey), scenario: "standard", club, teams: cfgList }))}
            style={{ ...S.btn(RE) }}
          >
            Generate Demo Data
          </button>
        </div>
      </div>
    </div>
  );
}

export default TestDataManager;
