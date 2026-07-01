import React, { useState } from "react";
import { DEFAULT_CLUB, RE } from "../lib/constants.js";
import { S } from "../lib/styles.js";

const ROLE_OPTIONS = [
  { value: "league_referee", label: "League Ref", enforceClashes: true },
  { value: "club_referee", label: "Club Ref", enforceClashes: true },
  { value: "parent_referee", label: "Parent Ref", enforceClashes: false },
  { value: "volunteer", label: "Volunteer", enforceClashes: false },
  { value: "manager_referee", label: "Manager Ref", enforceClashes: true },
  { value: "assistant_referee", label: "Assistant Ref", enforceClashes: true },
  { value: "observer", label: "Observer / Mentor", enforceClashes: false },
];

function getRoleMeta(role) {
  return ROLE_OPTIONS.find((option) => option.value === role) || ROLE_OPTIONS[1];
}

function RefManager({ refs, setRefs, club = DEFAULT_CLUB }) {
  const [form, setForm] = useState({ name: "", phone: "", role: "club_referee" });

  const add = () => {
    if (!form.name.trim()) return;
    const roleMeta = getRoleMeta(form.role);
    setRefs((previous) => [
      ...previous,
      {
        id: Date.now(),
        ...form,
        roleLabel: roleMeta.label,
        enforceClashes: roleMeta.enforceClashes,
      },
    ]);
    setForm({ name: "", phone: "", role: "club_referee" });
  };

  const updateRef = (id, patch) => {
    setRefs((previous) =>
      previous.map((ref) => {
        if (ref.id !== id) return ref;
        const next = { ...ref, ...patch };
        if (patch.role) {
          const roleMeta = getRoleMeta(patch.role);
          next.roleLabel = roleMeta.label;
          next.enforceClashes = roleMeta.enforceClashes;
        }
        return next;
      })
    );
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 180px auto", gap: 8, marginBottom: 10, alignItems: "end" }}>
        <div>
          <label style={S.lbl}>Name</label>
          <input
            style={S.inp}
            placeholder="Referee name"
            value={form.name}
            onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
          />
        </div>
        <div>
          <label style={S.lbl}>Mobile</label>
          <input
            style={S.inp}
            placeholder="07xxx xxxxxx"
            value={form.phone}
            onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))}
          />
        </div>
        <div>
          <label style={S.lbl}>Role</label>
          <select
            style={S.inp}
            value={form.role}
            onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value }))}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button style={S.btn(club.primary)} onClick={add}>+ Add</button>
      </div>

      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
        Parent refs, volunteers and observers are treated as flexible helpers and do not trigger overlap clashes. League, club, manager and assistant refs are clash-checked.
      </div>

      {refs.length === 0 ? (
        <div style={{ fontSize: 12, color: "#aaa" }}>No referees saved yet.</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Name</th>
              <th style={S.th}>Mobile</th>
              <th style={S.th}>Role</th>
              <th style={S.th}>Clashes</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {refs.map((ref, index) => {
              const role = ref.role || "club_referee";
              const roleMeta = getRoleMeta(role);
              const enforceClashes = typeof ref.enforceClashes === "boolean" ? ref.enforceClashes : roleMeta.enforceClashes;

              return (
                <tr key={ref.id}>
                  <td style={S.td(index % 2)}>{ref.name}</td>
                  <td style={S.td(index % 2)}>{ref.phone || "-"}</td>
                  <td style={S.td(index % 2)}>
                    <select
                      style={{ ...S.inp, padding: "6px 8px", fontSize: 12 }}
                      value={role}
                      onChange={(event) => updateRef(ref.id, { role: event.target.value })}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={S.td(index % 2)}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: enforceClashes ? "#92400e" : "#047857" }}>
                      <input
                        type="checkbox"
                        checked={enforceClashes}
                        onChange={(event) => updateRef(ref.id, { enforceClashes: event.target.checked })}
                      />
                      {enforceClashes ? "Enforced" : "Ignored"}
                    </label>
                  </td>
                  <td style={S.td(index % 2)}>
                    <button
                      onClick={() => setRefs((previous) => previous.filter((item) => item.id !== ref.id))}
                      style={{ background: "none", border: "none", color: RE, cursor: "pointer", fontSize: 13 }}
                    >
                      x
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default RefManager;
