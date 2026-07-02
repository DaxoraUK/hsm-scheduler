import React from "react";
import { DEFAULT_CLUB, RE } from "../lib/constants.js";
import { S, thC } from "../lib/styles.js";

function getFixtureDay(entry = {}, key) {
  return (entry.fixtureDays || []).find((item) => item.key === key) || null;
}

function getDayCount(entry = {}, key) {
  const day = getFixtureDay(entry, key);
  if (day) return (day.scheduled || []).length;
  if (key === "saturday") return (entry.scheduled || []).length;
  if (key === "sunday") return (entry.sunScheduled || []).length;
  return (entry.midweekScheduled || []).length;
}

function getPostponedCount(entry = {}) {
  if (Array.isArray(entry.fixtureDays) && entry.fixtureDays.length) {
    return entry.fixtureDays.reduce(
      (total, day) => total + (day.postponed || []).length,
      0
    );
  }
  return (entry.postponedGames || []).length || entry.postponed || 0;
}

function HistoryPanel({ history, onLoad, onDelete, club = DEFAULT_CLUB }) {
  if (!history.length) {
    return <div style={{ fontSize: 12, color: "#aaa" }}>No saved weeks yet.</div>;
  }

  return (
    <table style={S.table}>
      <thead>
        <tr>
          {["Date", "Sat Fixtures", "Postponed", "Sun Fixtures", "Midweek Fixtures", "Actions"].map((heading) => (
            <th key={heading} style={thC(club.primary)}>{heading}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {history.map((week, index) => {
          const saturdayCount = getDayCount(week, "saturday");
          const sundayCount = getDayCount(week, "sunday");
          const midweekCount = getDayCount(week, "midweek");

          return (
            <tr key={week.id}>
              <td style={S.td(index % 2)}>
                <strong>{week.dateLabel}</strong>
                <br />
                <span style={{ fontSize: 10, color: "#888" }}>
                  {week.savedAt ? new Date(week.savedAt).toLocaleDateString("en-GB") : ""}
                </span>
              </td>
              <td style={S.td(index % 2)}>{saturdayCount}</td>
              <td style={S.td(index % 2)}>{getPostponedCount(week)}</td>
              <td style={S.td(index % 2)}>
                {sundayCount > 0 ? sundayCount : <span style={{ color: "#aaa" }}>-</span>}
              </td>
              <td style={S.td(index % 2)}>
                {midweekCount > 0 ? midweekCount : <span style={{ color: "#aaa" }}>-</span>}
              </td>
              <td style={S.td(index % 2)}>
                <button
                  style={{ ...S.btn(club.primary), padding: "3px 10px", fontSize: 11 }}
                  onClick={() => onLoad(week)}
                >
                  Load
                </button>
                <button
                  style={{ ...S.btn(RE), padding: "3px 10px", fontSize: 11, marginLeft: 6 }}
                  onClick={() => onDelete(week.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default HistoryPanel;
