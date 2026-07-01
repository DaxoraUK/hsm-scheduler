import React from "react";

export default function TimingSettingsPanel({
  S,
  RE,
  club,
  setClub,
  hdrStyle,
  startHour,
  setStartHour,
  startMin,
  setStartMin,
  endHour,
  setEndHour,
  endMin,
  setEndMin,
  bufferYouth,
  setBufferYouth,
  bufferAdult,
  setBufferAdult,
  DEFAULT_BUFFER_YOUTH,
  DEFAULT_BUFFER_ADULT,
  saveTab,
  savedTab,
}) {
  const sh = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
  const eh = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

  return (
    <div style={S.card} className="np">
      <div style={hdrStyle(club.primary)}>Timing Settings</div>

      <div style={S.cb}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <label style={S.lbl}>Earliest KO time</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number"
                min={6}
                max={11}
                style={{ ...S.inp, width: 60 }}
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
              />
              <span>:</span>
              <select
                style={{ ...S.sel, width: 70 }}
                value={startMin}
                onChange={(e) => setStartMin(Number(e.target.value))}
              >
                <option value={0}>00</option>
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={45}>45</option>
              </select>
              <span style={{ fontSize: 11, color: "#888" }}>{sh}</span>
            </div>
          </div>

          <div>
            <label style={S.lbl}>Latest youth KO time</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number"
                min={9}
                max={13}
                style={{ ...S.inp, width: 60 }}
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
              />
              <span>:</span>
              <select
                style={{ ...S.sel, width: 70 }}
                value={endMin}
                onChange={(e) => setEndMin(Number(e.target.value))}
              >
                <option value={0}>00</option>
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={45}>45</option>
              </select>
              <span style={{ fontSize: 11, color: "#888" }}>{eh}</span>
            </div>
          </div>

          <div>
            <label style={S.lbl}>Youth changeover buffer (mins)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min={0}
                max={30}
                step={5}
                style={{ ...S.inp, width: 70 }}
                value={bufferYouth}
                onChange={(e) => setBufferYouth(Number(e.target.value))}
              />
              <span style={{ fontSize: 11, color: "#888" }}>
                All youth/mini formats
              </span>
            </div>
          </div>

          <div>
            <label style={S.lbl}>Adult changeover buffer (mins)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min={0}
                max={60}
                step={5}
                style={{ ...S.inp, width: 70 }}
                value={bufferAdult}
                onChange={(e) => setBufferAdult(Number(e.target.value))}
              />
              <span style={{ fontSize: 11, color: "#888" }}>
                1st team and Reserves only
              </span>
            </div>
          </div>
        </div>

        <div style={{ paddingTop: 16, borderTop: "1px solid #eee", marginBottom: 16 }}>
          <label style={S.lbl}>Maximum games running at the same time</label>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
            <input
              type="number"
              min={1}
              max={20}
              style={{ ...S.inp, width: 80 }}
              value={club.maxConcurrent || 3}
              onChange={(e) =>
                setClub((c) => ({
                  ...c,
                  maxConcurrent: Math.max(1, Number(e.target.value) || 1),
                }))
              }
            />

            <span style={{ fontSize: 11, color: "#888", maxWidth: 340 }}>
              How many pitches can host a game simultaneously. Independent pitches
              do not count toward this limit. Based on parking, officials, or space.
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            paddingTop: 12,
            borderTop: "1px solid #eee",
            flexWrap: "wrap",
          }}
        >
          <button
            style={S.btn(RE)}
            onClick={() => {
              setBufferYouth(DEFAULT_BUFFER_YOUTH);
              setBufferAdult(DEFAULT_BUFFER_ADULT);
              setStartHour(8);
              setStartMin(30);
              setEndHour(11);
              setEndMin(30);
            }}
          >
            Reset to Defaults
          </button>

          <button style={S.btn(club.primary)} onClick={() => saveTab("timing")}>
            Save Timing
          </button>

          {savedTab === "timing" && (
            <span style={{ fontSize: 12, color: club.primary, fontWeight: 600 }}>
              ✓ Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}