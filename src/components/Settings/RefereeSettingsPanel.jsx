import React, { useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { booleanValue } from "../../lib/settings/dataExchange.js";
import SettingsDataActions from "./SettingsDataActions.jsx";
import {
  Field,
  Notice,
  PrimaryButton,
  SaveBar,
  SettingsPanel,
  SettingsSectionHeader,
  StatTile,
  inputClass,
  selectClass,
} from "./SettingsPrimitives.jsx";

const ROLE_OPTIONS = [
  { value: "league_referee", label: "League referee", enforceClashes: true },
  { value: "club_referee", label: "Club referee", enforceClashes: true },
  { value: "parent_referee", label: "Parent referee", enforceClashes: false },
  { value: "volunteer", label: "Volunteer", enforceClashes: false },
  { value: "manager_referee", label: "Manager referee", enforceClashes: true },
  { value: "assistant_referee", label: "Assistant referee", enforceClashes: true },
  { value: "observer", label: "Observer / mentor", enforceClashes: false },
];

const OFFICIAL_COLUMNS = [
  { key: "name", label: "Name", aliases: ["Official", "Referee"] },
  { key: "phone", label: "Phone", aliases: ["Mobile", "Telephone"] },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "enforceClashes", label: "Clash Checks", aliases: ["Enforce Clashes"] },
];

function roleMeta(role) {
  return ROLE_OPTIONS.find((option) => option.value === role) || ROLE_OPTIONS[1];
}

function normaliseRole(value) {
  const text = String(value || "club_referee").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (ROLE_OPTIONS.some((option) => option.value === text)) return text;
  const byLabel = ROLE_OPTIONS.find((option) => option.label.toLowerCase().replace(/[\s/-]+/g, "_") === text);
  return byLabel?.value || "club_referee";
}

function normaliseImportedOfficial(row, index) {
  const name = String(row.name || "").trim();
  if (!name) return null;
  const role = normaliseRole(row.role);
  const meta = roleMeta(role);
  return {
    id: row.id || `${Date.now()}-${index}`,
    name,
    phone: String(row.phone || "").trim(),
    email: String(row.email || "").trim(),
    role,
    roleLabel: meta.label,
    enforceClashes: booleanValue(row.enforceClashes, meta.enforceClashes),
  };
}

export default function RefereeSettingsPanel({ refs = [], setRefs, saveTab, savedTab }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", role: "club_referee" });
  const clashChecked = refs.filter((official) => typeof official.enforceClashes === "boolean" ? official.enforceClashes : roleMeta(official.role).enforceClashes).length;

  const addOfficial = () => {
    if (!form.name.trim()) return;
    const meta = roleMeta(form.role);
    setRefs((current) => [...current, {
      id: Date.now(),
      ...form,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      roleLabel: meta.label,
      enforceClashes: meta.enforceClashes,
    }]);
    setForm({ name: "", phone: "", email: "", role: "club_referee" });
  };

  const updateOfficial = (id, patch) => {
    setRefs((current) => current.map((official) => {
      if (official.id !== id) return official;
      const next = { ...official, ...patch };
      if (patch.role) {
        const meta = roleMeta(patch.role);
        next.roleLabel = meta.label;
        next.enforceClashes = meta.enforceClashes;
      }
      return next;
    }));
  };

  return (
    <div className="space-y-5">
      <SettingsPanel>
        <SettingsSectionHeader
          icon={ShieldCheck}
          eyebrow="Matchday people"
          title="Officials directory"
          description="Maintain known league-appointed referees and any club volunteers. Ground Control records appointments and checks clashes; it does not appoint league referees."
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatTile label="People" value={refs.length} tone="green" />
          <StatTile label="Clash checked" value={clashChecked} tone="amber" />
          <StatTile label="Flexible helpers" value={Math.max(0, refs.length - clashChecked)} tone="blue" />
        </div>

        <div className="mt-5">
          <SettingsDataActions
            label="Officials"
            rows={refs}
            columns={OFFICIAL_COLUMNS}
            filename="ground-control-officials"
            templateRows={[{ name: "Alex Example", phone: "07123 456789", email: "alex@example.org", role: "club_referee", enforceClashes: true }]}
            normaliseRow={normaliseImportedOfficial}
            onImport={(rows, mode) => setRefs((current) => mode === "append" ? [...current, ...rows] : rows)}
          />
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Name"><input className={inputClass} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Official name" /></Field>
            <Field label="Mobile"><input className={inputClass} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="07xxx xxxxxx" /></Field>
            <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.org" /></Field>
            <Field label="Role"><select className={selectClass} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>{ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          </div>
          <div className="mt-4 flex justify-end"><PrimaryButton icon={Plus} onClick={addOfficial} disabled={!form.name.trim()}>Add person</PrimaryButton></div>
        </div>

        <Notice tone="info" className="mt-5">League appointments are entered against the relevant fixture after checking the official source. League, club, manager and assistant referees are clash-checked. Parent referees, volunteers and observers remain flexible unless you override the setting.</Notice>

        <div className="mt-6 space-y-4">
          {refs.map((official, index) => {
            const role = official.role || "club_referee";
            const meta = roleMeta(role);
            const enforce = typeof official.enforceClashes === "boolean" ? official.enforceClashes : meta.enforceClashes;
            return (
              <article key={official.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Person {index + 1}</div>
                    <div className="mt-1 text-sm font-black text-slate-950">{official.name || "Unnamed person"}</div>
                  </div>
                  <button type="button" onClick={() => setRefs((current) => current.filter((item) => item.id !== official.id))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50" aria-label={`Remove ${official.name}`}><Trash2 size={17} /></button>
                </div>
                <div className="grid gap-x-4 gap-y-5 lg:grid-cols-2 xl:grid-cols-3">
                  <Field label="Name" ><input className={inputClass} value={official.name || ""} onChange={(event) => updateOfficial(official.id, { name: event.target.value })} /></Field>
                  <Field label="Phone" ><input className={inputClass} value={official.phone || ""} onChange={(event) => updateOfficial(official.id, { phone: event.target.value })} placeholder="07xxx xxxxxx" /></Field>
                  <Field label="Email" ><input type="email" className={inputClass} value={official.email || ""} onChange={(event) => updateOfficial(official.id, { email: event.target.value })} placeholder="name@example.org" /></Field>
                  <Field label="Role" ><select className={selectClass} value={role} onChange={(event) => updateOfficial(official.id, { role: event.target.value })}>{ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                  <Field label="Clash handling" ><label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-black text-slate-700"><input type="checkbox" checked={enforce} onChange={(event) => updateOfficial(official.id, { enforceClashes: event.target.checked })} className="h-5 w-5 rounded border-slate-300 text-emerald-600" />{enforce ? "Enforced" : "Flexible"}</label></Field>
                </div>
              </article>
            );
          })}
        </div>

        {!refs.length ? <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">No officials saved. Add a person or import a CSV template.</div> : null}

        <SaveBar onSave={() => saveTab?.("refs", { refs })} saved={savedTab === "refs"} label="Save officials">
          Saved officials are available to matchday assignment and intelligence.
        </SaveBar>
      </SettingsPanel>
    </div>
  );
}
