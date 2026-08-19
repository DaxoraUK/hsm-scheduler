import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import { useDaxoraConfirm } from "../../contexts/DaxoraInteractionContext.jsx";
import { normaliseScheduleVersion, normaliseScheduleVersionPayload } from "../../lib/league/leagueSchedulingEngine.js";
import {
  buildLeagueOperationalFixtures,
  getFixtureOfficialRequirement,
  getLeagueOfficialCoverage,
  getRequiredOfficialRoles,
  leagueAppointmentsToCsv,
  ROLE_LABELS,
  suggestLeagueOfficialAssignments,
  suggestLeagueRearrangementDates,
} from "../../lib/league/leagueOperationsEngine.js";

const INPUT = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500";
const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const TABS = [
  ["pool", "Official pool"],
  ["requirements", "Requirements"],
  ["appointments", "Appointments"],
  ["availability", "Availability & conflicts"],
  ["postponements", "Postponements"],
  ["reports", "Reports"],
];

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    navy: "border-slate-950 bg-slate-950 text-white",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.11em] ${tones[tone] || tones.slate}`}>{children}</span>;
}

function Field({ label, children, className = "" }) {
  return <label className={className}><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>{children}</label>;
}

function Metric({ label, value, detail, tone = "slate" }) {
  const tones = { slate: "border-slate-200 bg-slate-50", green: "border-emerald-200 bg-emerald-50", amber: "border-amber-200 bg-amber-50", rose: "border-rose-200 bg-rose-50" };
  return <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}><div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="mt-1 text-2xl font-black text-slate-950">{value}</div>{detail ? <div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div> : null}</div>;
}

function downloadText(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function officialDraft(row = {}) {
  return {
    id: row.id || "",
    name: row.name || "",
    email: row.email || "",
    phone: row.phone || "",
    grade: row.grade || "",
    homePostcode: row.homePostcode || "",
    travelRadiusMiles: row.travelRadiusMiles || 35,
    maxAppointmentsPerDay: row.maxAppointmentsPerDay || 1,
    maxAppointmentsPerWeek: row.maxAppointmentsPerWeek || 2,
    canReferee: row.id ? row.canReferee : true,
    canAssistant: row.id ? row.canAssistant : true,
    canFourth: Boolean(row.canFourth),
    canObserve: Boolean(row.canObserve),
    status: row.status || "active",
    notes: row.notes || "",
  };
}

function requirementDraft(row = {}, scopeType, scopeId) {
  return {
    id: row.id || "",
    scopeType,
    scopeId,
    refereeCount: row.refereeCount ?? 1,
    assistantCount: row.assistantCount ?? 0,
    fourthOfficialCount: row.fourthOfficialCount ?? 0,
    observerCount: row.observerCount ?? 0,
    minimumGrade: row.minimumGrade || "",
  };
}

function appointmentKey(row) {
  return `${row.targetType}:${row.targetId}:${row.role}`;
}

function OfficialPool({ leagueId, operations, canEdit, onRefresh }) {
  const daxoraConfirm = useDaxoraConfirm();
  const [selectedId, setSelectedId] = useState(operations.officials[0]?.id || "");
  const selected = operations.officials.find((row) => row.id === selectedId);
  const [draft, setDraft] = useState(officialDraft(selected));
  useEffect(() => setDraft(officialDraft(selected)), [selectedId, selected?.updatedAt]);
  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  return <div className="grid gap-5 xl:grid-cols-[0.9fr_1.3fr]">
    <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><div className="text-lg font-black text-slate-950">Official pool</div><div className="text-xs font-semibold text-slate-500">Referees, assistants, fourth officials and observers.</div></div><button type="button" onClick={() => { setSelectedId(""); setDraft(officialDraft()); }} className={`${BUTTON} bg-slate-950 text-white`}><Plus size={15} /> Add official</button></div><div className="max-h-[680px] space-y-2 overflow-y-auto p-3">{operations.officials.map((official) => <button type="button" key={official.id} onClick={() => setSelectedId(official.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === official.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{official.name}</div><div className="mt-1 text-xs font-semibold text-slate-500">{official.grade || "Grade not set"} · {official.homePostcode || "Postcode not set"}</div></div><Pill tone={official.status === "active" ? "green" : "slate"}>{official.status}</Pill></div><div className="mt-3 flex flex-wrap gap-1.5">{official.canReferee ? <Pill tone="blue">Referee</Pill> : null}{official.canAssistant ? <Pill>Assistant</Pill> : null}{official.canFourth ? <Pill>Fourth</Pill> : null}{official.canObserve ? <Pill>Observer</Pill> : null}</div></button>)}{!operations.officials.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><Users className="mx-auto text-slate-300" size={34} /><div className="mt-3 text-sm font-black text-slate-600">No officials loaded yet</div></div> : null}</div></Panel>
    <Panel className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><div className="text-lg font-black text-slate-950">{draft.id ? "Edit official" : "New official"}</div><div className="text-xs font-semibold text-slate-500">Private contact details remain inside the league operations workspace.</div></div>{draft.id ? <button type="button" disabled={!canEdit} onClick={async () => { if (!(await daxoraConfirm({ title: "Deactivate this official?", description: "The official will leave the active appointment pool. Existing appointment history will be retained.", confirmLabel: "Deactivate official", tone: "danger" }))) return; try { await DB.deactivateLeagueOfficial(leagueId, draft.id); await onRefresh(); setSelectedId(""); toast.success("Official deactivated"); } catch (error) { toast.error("Official could not be deactivated", { description: error?.message }); } }} className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700"><Trash2 size={15} /></button> : null}</div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Name" className="sm:col-span-2"><input className={INPUT} value={draft.name} onChange={update("name")} placeholder="Official name" /></Field><Field label="Email"><input type="email" className={INPUT} value={draft.email} onChange={update("email")} placeholder="name@example.org" /></Field><Field label="Phone"><input className={INPUT} value={draft.phone} onChange={update("phone")} /></Field><Field label="Grade / level"><input className={INPUT} value={draft.grade} onChange={update("grade")} placeholder="Level 5" /></Field><Field label="Home postcode"><input className={INPUT} value={draft.homePostcode} onChange={update("homePostcode")} /></Field><Field label="Travel radius (miles)"><input type="number" min="0" max="250" className={INPUT} value={draft.travelRadiusMiles} onChange={update("travelRadiusMiles")} /></Field><Field label="Max appointments per day"><input type="number" min="1" max="5" className={INPUT} value={draft.maxAppointmentsPerDay} onChange={update("maxAppointmentsPerDay")} /></Field><Field label="Max appointments per week"><input type="number" min="1" max="14" className={INPUT} value={draft.maxAppointmentsPerWeek} onChange={update("maxAppointmentsPerWeek")} /></Field><Field label="Status"><select className={INPUT} value={draft.status} onChange={update("status")}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></Field><div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">{[["canReferee", "Referee"], ["canAssistant", "Assistant referee"], ["canFourth", "Fourth official"], ["canObserve", "Observer / mentor"]].map(([key, label]) => <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={draft[key]} onChange={update(key)} /><span className="text-xs font-black text-slate-700">{label}</span></label>)}</div><Field label="Notes" className="sm:col-span-2"><textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={draft.notes} onChange={update("notes")} /></Field></div><div className="mt-5 flex justify-end"><button type="button" disabled={!canEdit || draft.name.trim().length < 2} onClick={async () => { try { const id = await DB.upsertLeagueOfficial(leagueId, draft); await onRefresh(); setSelectedId(id || draft.id); toast.success("Official saved"); } catch (error) { toast.error("Official could not be saved", { description: error?.message }); } }} className={`${BUTTON} bg-emerald-600 text-white`}><Save size={15} /> Save official</button></div></Panel>
  </div>;
}

function Requirements({ leagueId, workspace, operations, canEdit, onRefresh }) {
  const scopes = [
    { type: "league", id: workspace.league.id, name: "League default" },
    ...workspace.divisions.map((row) => ({ type: "division", id: row.id, name: row.name })),
    ...workspace.cups.map((row) => ({ type: "cup", id: row.id, name: row.name })),
  ];
  const [drafts, setDrafts] = useState({});
  useEffect(() => { const next = {}; scopes.forEach((scope) => { const row = operations.requirements.find((item) => item.scopeType === scope.type && item.scopeId === scope.id); next[`${scope.type}:${scope.id}`] = requirementDraft(row, scope.type, scope.id); }); setDrafts(next); }, [operations.requirements.length, workspace.divisions.length, workspace.cups.length]);
  const change = (key, field, value) => setDrafts((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  return <Panel className="overflow-hidden"><div className="border-b border-slate-200 p-5"><div className="text-xl font-black text-slate-950">Competition official requirements</div><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">Configure officials per division or cup. Premier Division can require two assistants without hard-coding that rule into the product.</p></div><div className="overflow-x-auto"><table className="min-w-full text-xs"><thead><tr className="bg-slate-50 text-left"><th className="px-4 py-3 font-black text-slate-600">Competition scope</th><th className="px-3 py-3 font-black text-slate-600">Referee</th><th className="px-3 py-3 font-black text-slate-600">Assistants</th><th className="px-3 py-3 font-black text-slate-600">Fourth</th><th className="px-3 py-3 font-black text-slate-600">Observer</th><th className="px-3 py-3 font-black text-slate-600">Minimum grade</th><th className="px-4 py-3" /></tr></thead><tbody>{scopes.map((scope) => { const key = `${scope.type}:${scope.id}`; const draft = drafts[key] || requirementDraft({}, scope.type, scope.id); return <tr key={key} className="border-t border-slate-100"><td className="px-4 py-3"><div className="font-black text-slate-900">{scope.name}</div><div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{scope.type}</div></td>{[["refereeCount", 0, 1], ["assistantCount", 0, 2], ["fourthOfficialCount", 0, 1], ["observerCount", 0, 1]].map(([field, min, max]) => <td key={field} className="px-3 py-3"><select className="h-9 rounded-xl border border-slate-200 bg-white px-2 font-black" value={draft[field]} onChange={(event) => change(key, field, Number(event.target.value))}>{Array.from({ length: max - min + 1 }, (_, index) => min + index).map((value) => <option key={value} value={value}>{value}</option>)}</select></td>)}<td className="px-3 py-3"><input className="h-9 w-32 rounded-xl border border-slate-200 px-2 font-bold" value={draft.minimumGrade} onChange={(event) => change(key, "minimumGrade", event.target.value)} placeholder="Optional" /></td><td className="px-4 py-3 text-right"><button type="button" disabled={!canEdit} onClick={async () => { try { await DB.upsertLeagueOfficialRequirement(leagueId, draft); await onRefresh(); toast.success(`${scope.name} requirements saved`); } catch (error) { toast.error("Requirement could not be saved", { description: error?.message }); } }} className={`${BUTTON} bg-slate-950 text-white`}><Save size={14} /> Save</button></td></tr>; })}</tbody></table></div></Panel>;
}

function Appointments({ leagueId, workspace, operations, canEdit, onRefresh, fixtures }) {
  const boardRoles = ["referee", "assistant_1", "assistant_2", "fourth_official", "observer"];
  const [date, setDate] = useState(fixtures.find((row) => row.date)?.date || "");
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const dates = [...new Set(fixtures.filter((row) => row.date).map((row) => row.date))].sort();

  useEffect(() => { if (!date && dates[0]) setDate(dates[0]); }, [dates.join("|")]);
  useEffect(() => {
    const next = {};
    operations.assignments.forEach((row) => { next[appointmentKey(row)] = { ...row }; });
    setDrafts(next);
  }, [operations.assignments]);

  const visible = fixtures.filter((row) => row.date === date && !["cancelled", "postponed"].includes(row.status));
  const changeAssignment = (fixture, role, officialId) => {
    const key = `${fixture.targetType}:${fixture.targetId}:${role}`;
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...current[key],
        targetType: fixture.targetType,
        targetId: fixture.targetId,
        targetDate: fixture.date,
        kickOff: fixture.kickOff,
        venueId: fixture.venueId,
        role,
        officialId,
        status: current[key]?.status || "proposed",
      },
    }));
  };
  const dirtyRows = Object.values(drafts).filter((row) => row.officialId);
  const assignedFor = (fixture, role) => drafts[`${fixture.targetType}:${fixture.targetId}:${role}`];
  const officialSupportsRole = (official, role) => {
    if (role === "referee") return official.canReferee;
    if (["assistant_1", "assistant_2"].includes(role)) return official.canAssistant;
    if (role === "fourth_official") return official.canFourth;
    if (role === "observer") return official.canObserve;
    return false;
  };
  const autoAssign = () => {
    const existing = Object.values(drafts).filter((row) => row.officialId);
    const result = suggestLeagueOfficialAssignments({
      fixtures: visible,
      officials: operations.officials,
      availability: operations.availability,
      conflicts: operations.conflicts,
      requirements: operations.requirements,
      assignments: existing,
      workspace,
    });
    if (!result.suggestions.length) {
      toast.info("No new appointments could be suggested", { description: result.unresolved[0]?.reason || "Every required role is already filled." });
      return;
    }
    setDrafts((current) => {
      const next = { ...current };
      result.suggestions.forEach((row) => { next[appointmentKey(row)] = row; });
      return next;
    });
    toast.success(`${result.suggestions.length} appointment suggestions prepared`, {
      description: result.unresolved.length ? `${result.unresolved.length} roles still need manual attention.` : "All required roles on this date are covered.",
    });
  };
  const save = async () => {
    setBusy(true);
    try {
      await DB.bulkUpsertLeagueOfficialAssignments(leagueId, dirtyRows);
      await onRefresh();
      toast.success("Appointments saved atomically");
    } catch (error) {
      toast.error("Appointments could not be saved", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };
  const responseLink = (assignment) => assignment.responseToken
    ? `${window.location.origin}/api/league/official-response?token=${encodeURIComponent(assignment.responseToken)}`
    : "";

  return (
    <div className="space-y-5">
      <Panel className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="text-xl font-black text-slate-950">Appointment board</div><p className="mt-1 text-sm font-semibold text-slate-500">Allocate a complete matchday at once, including assistants, fourth officials and observers where competition rules require them.</p></div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Fixture date"><select className={`${INPUT} min-w-[180px]`} value={date} onChange={(event) => setDate(event.target.value)}>{dates.map((value) => <option key={value} value={value}>{new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })}</option>)}</select></Field>
            <button type="button" disabled={!canEdit || !visible.length} onClick={autoAssign} className={`${BUTTON} bg-amber-500 text-slate-950`}><Sparkles size={15} /> Suggest all officials</button>
            <button type="button" disabled={!canEdit || !dirtyRows.length || busy} onClick={save} className={`${BUTTON} bg-emerald-600 text-white`}><Save size={15} /> Save appointment board</button>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid min-w-[1580px] grid-cols-[80px_minmax(240px,1.4fr)_minmax(160px,0.9fr)_repeat(5,minmax(150px,0.9fr))_90px] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
            <div>Time</div><div>Fixture</div><div>Venue</div>{boardRoles.map((role) => <div key={role}>{ROLE_LABELS[role]}</div>)}<div>Status</div>
          </div>
          <div className="divide-y divide-slate-100">
            {visible.map((fixture) => {
              const requirement = getFixtureOfficialRequirement(fixture, operations.requirements);
              const roles = getRequiredOfficialRoles(requirement);
              return (
                <div key={`${fixture.targetType}-${fixture.targetId}`} className="grid min-w-[1580px] grid-cols-[80px_minmax(240px,1.4fr)_minmax(160px,0.9fr)_repeat(5,minmax(150px,0.9fr))_90px] gap-2 px-4 py-3">
                  <div className="text-xs font-black text-slate-700">{fixture.kickOff}</div>
                  <div><div className="text-xs font-black text-slate-950">{fixture.homeTeamName} v {fixture.awayTeamName}</div><div className="mt-0.5 text-[10px] font-semibold text-slate-500">{fixture.competitionName}</div></div>
                  <div className="truncate text-xs font-bold text-slate-600">{fixture.venueName}</div>
                  {boardRoles.map((role) => {
                    const required = roles.includes(role);
                    const assignment = assignedFor(fixture, role);
                    return (
                      <div key={role}>
                        {required ? (
                          <select className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold" value={assignment?.officialId || ""} onChange={(event) => changeAssignment(fixture, role, event.target.value)}>
                            <option value="">Unassigned</option>
                            {operations.officials.filter((official) => official.status === "active" && officialSupportsRole(official, role)).map((official) => <option key={official.id} value={official.id}>{official.name}</option>)}
                          </select>
                        ) : <div className="flex h-9 items-center rounded-xl bg-slate-50 px-3 text-[10px] font-bold text-slate-400">Not required</div>}
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-1">{roles.every((role) => assignedFor(fixture, role)?.officialId) ? <Pill tone="green">Covered</Pill> : <Pill tone="amber">Gaps</Pill>}</div>
                </div>
              );
            })}
            {!visible.length ? <div className="p-10 text-center text-sm font-bold text-slate-400">No scheduled fixtures on this date.</div> : null}
          </div>
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center justify-between"><div><div className="text-base font-black text-slate-950">Responses and replacements</div><div className="mt-1 text-xs font-semibold text-slate-500">Copy one secure accept-or-decline link after appointments have been saved. Declines enter the replacement queue.</div></div></div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {operations.assignments.filter((row) => fixtures.find((item) => item.targetType === row.targetType && item.targetId === row.targetId)?.date === date).map((assignment) => {
            const fixture = fixtures.find((item) => item.targetType === assignment.targetType && item.targetId === assignment.targetId);
            const official = operations.officials.find((row) => row.id === assignment.officialId);
            const link = responseLink(assignment);
            return (
              <div key={assignment.id || appointmentKey(assignment)} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3">
                <div className="min-w-0"><div className="truncate text-xs font-black text-slate-900">{official?.name || "Official"} · {ROLE_LABELS[assignment.role]}</div><div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{fixture?.homeTeamName} v {fixture?.awayTeamName}</div></div>
                <div className="flex items-center gap-2">
                  <Pill tone={assignment.status === "accepted" || assignment.status === "confirmed" ? "green" : assignment.status === "declined" || assignment.status === "replacement_required" ? "rose" : "amber"}>{assignment.status}</Pill>
                  {link ? <button type="button" aria-label="Copy official response link" onClick={async () => { try { await navigator.clipboard.writeText(link); if (assignment.id && assignment.status === "proposed") { await DB.updateLeagueOfficialAssignmentStatus(leagueId, assignment.id, "sent"); await onRefresh(); } toast.success("Official response link copied"); } catch (error) { toast.error("Response link could not be copied", { description: error?.message }); } }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200"><ClipboardCopy size={14} /></button> : null}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}


function AvailabilityAndConflicts({ leagueId, workspace, operations, canEdit, onRefresh }) {
  const [officialId, setOfficialId] = useState(operations.officials[0]?.id || "");
  const [availability, setAvailability] = useState({ availableOn: "", startsAt: "", endsAt: "", availabilityStatus: "available", notes: "" });
  const [conflict, setConflict] = useState({ conflictType: "club", parentClubId: "", teamId: "", reason: "" });
  useEffect(() => {
    if (!officialId && operations.officials[0]?.id) setOfficialId(operations.officials[0].id);
    if (officialId && !operations.officials.some((row) => row.id === officialId)) setOfficialId(operations.officials[0]?.id || "");
  }, [officialId, operations.officials]);
  const selected = operations.officials.find((row) => row.id === officialId);
  const officialAvailability = operations.availability.filter((row) => row.officialId === officialId);
  const officialConflicts = operations.conflicts.filter((row) => row.officialId === officialId);
  return <div className="grid gap-5 xl:grid-cols-2"><Panel className="p-5"><div className="text-xl font-black text-slate-950">Availability calendar</div><div className="mt-4"><select className={INPUT} value={officialId} onChange={(event) => setOfficialId(event.target.value)}>{operations.officials.map((official) => <option key={official.id} value={official.id}>{official.name}</option>)}</select></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Date"><input type="date" className={INPUT} value={availability.availableOn} onChange={(event) => setAvailability((current) => ({ ...current, availableOn: event.target.value }))} /></Field><Field label="Status"><select className={INPUT} value={availability.availabilityStatus} onChange={(event) => setAvailability((current) => ({ ...current, availabilityStatus: event.target.value }))}><option value="available">Available</option><option value="preferred">Preferred</option><option value="unavailable">Unavailable</option></select></Field><Field label="Available from"><input type="time" className={INPUT} value={availability.startsAt} onChange={(event) => setAvailability((current) => ({ ...current, startsAt: event.target.value }))} /></Field><Field label="Available until"><input type="time" className={INPUT} value={availability.endsAt} onChange={(event) => setAvailability((current) => ({ ...current, endsAt: event.target.value }))} /></Field></div><button type="button" disabled={!canEdit || !officialId || !availability.availableOn} onClick={async () => { try { await DB.upsertLeagueOfficialAvailability(leagueId, officialId, availability); await onRefresh(); setAvailability({ availableOn: "", startsAt: "", endsAt: "", availabilityStatus: "available", notes: "" }); toast.success("Availability saved"); } catch (error) { toast.error("Availability could not be saved", { description: error?.message }); } }} className={`${BUTTON} mt-4 bg-emerald-600 text-white`}><Plus size={15} /> Add availability</button><div className="mt-5 space-y-2">{officialAvailability.map((row) => <div key={row.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><div><div className="text-xs font-black text-slate-800">{row.availableOn}</div><div className="text-[10px] font-semibold text-slate-500">{row.startsAt || "Any time"}{row.endsAt ? `–${row.endsAt}` : ""}</div></div><Pill tone={row.availabilityStatus === "unavailable" ? "rose" : row.availabilityStatus === "preferred" ? "green" : "blue"}>{row.availabilityStatus}</Pill></div>)}</div></Panel>
  <Panel className="p-5"><div className="text-xl font-black text-slate-950">Club and team conflicts</div><p className="mt-1 text-sm font-semibold text-slate-500">Prevent appointments involving an official’s own club, family connection or declared conflict.</p><div className="mt-4 grid gap-3"><Field label="Conflict type"><select className={INPUT} value={conflict.conflictType} onChange={(event) => setConflict((current) => ({ ...current, conflictType: event.target.value }))}><option value="club">Parent club</option><option value="team">Specific team</option></select></Field>{conflict.conflictType === "club" ? <Field label="Parent club"><select className={INPUT} value={conflict.parentClubId} onChange={(event) => setConflict((current) => ({ ...current, parentClubId: event.target.value, teamId: "" }))}><option value="">Select club</option>{workspace.clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></Field> : <Field label="Team"><select className={INPUT} value={conflict.teamId} onChange={(event) => setConflict((current) => ({ ...current, teamId: event.target.value, parentClubId: "" }))}><option value="">Select team</option>{workspace.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>}<Field label="Reason"><input className={INPUT} value={conflict.reason} onChange={(event) => setConflict((current) => ({ ...current, reason: event.target.value }))} placeholder="Own club, family connection…" /></Field></div><button type="button" disabled={!canEdit || !officialId || (!conflict.parentClubId && !conflict.teamId)} onClick={async () => { try { await DB.upsertLeagueOfficialConflict(leagueId, officialId, conflict); await onRefresh(); setConflict({ conflictType: "club", parentClubId: "", teamId: "", reason: "" }); toast.success("Official conflict saved"); } catch (error) { toast.error("Conflict could not be saved", { description: error?.message }); } }} className={`${BUTTON} mt-4 bg-slate-950 text-white`}><ShieldCheck size={15} /> Add conflict</button><div className="mt-5 space-y-2">{officialConflicts.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"><div><div className="text-xs font-black text-slate-800">{row.teamId ? workspace.teams.find((team) => team.id === row.teamId)?.name : workspace.clubs.find((club) => club.id === row.parentClubId)?.name}</div><div className="mt-0.5 text-[10px] font-semibold text-slate-500">{row.reason || "Declared conflict"}</div></div><Pill>{row.conflictType}</Pill></div>)}</div><div className="mt-4 text-[10px] font-semibold text-slate-400">Selected official: {selected?.name || "None"}</div></Panel></div>;
}

function Postponements({ leagueId, workspace, operations, canEdit, onRefresh, onScheduleChanged, fixtures }) {
  const [form, setForm] = useState({ targetType: "", targetId: "", reasonCategory: "weather", reason: "", deadlineOn: "", requestedByClubId: "", notes: "" });
  const [workingId, setWorkingId] = useState("");
  const targetKey = `${form.targetType}:${form.targetId}`;
  const selectedFixture = fixtures.find((row) => row.targetType === form.targetType && row.targetId === form.targetId);

  const findSuggestions = async (row, fixture) => {
    setWorkingId(row.id);
    try {
      const suggestions = suggestLeagueRearrangementDates({ postponement: row, fixture, fixtures, workspace, limit: 6 });
      await DB.saveLeaguePostponementSuggestions(leagueId, row.id, suggestions);
      await onRefresh();
      if (suggestions.length) toast.success(`${suggestions.length} valid rearrangement date${suggestions.length === 1 ? "" : "s"} found`);
      else toast.warning("No conflict-free rearrangement dates were found", { description: "Review the league calendar, blackouts and venue capacity." });
    } catch (error) {
      toast.error("Rearrangement dates could not be calculated", { description: error?.message });
    } finally {
      setWorkingId("");
    }
  };

  const applySuggestion = async (row, suggestion) => {
    setWorkingId(row.id);
    try {
      const result = await DB.applyLeaguePostponementRearrangement(leagueId, row.id, suggestion);
      await onRefresh();
      await onScheduleChanged?.(result?.version_id || result?.versionId || "");
      toast.success("Fixture rearranged into a new schedule version", { description: `${suggestion.date} at ${suggestion.kickOff}` });
    } catch (error) {
      toast.error("Rearrangement could not be applied", { description: error?.message });
    } finally {
      setWorkingId("");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
      <Panel className="p-5">
        <div className="text-xl font-black text-slate-950">Log postponement</div>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Preserve the original fixture, calculate valid alternatives and apply the selected date as a new schedule version.</p>
        <div className="mt-4 space-y-3">
          <Field label="Fixture"><select className={INPUT} value={targetKey === ":" ? "" : targetKey} onChange={(event) => { const [targetType, targetId] = event.target.value.split(":"); setForm((current) => ({ ...current, targetType: targetType || "", targetId: targetId || "" })); }}><option value="">Select fixture</option>{fixtures.filter((row) => row.date && row.targetType === "schedule_entry").map((fixture) => <option key={`${fixture.targetType}:${fixture.targetId}`} value={`${fixture.targetType}:${fixture.targetId}`}>{fixture.date} · {fixture.homeTeamName} v {fixture.awayTeamName}</option>)}</select></Field>
          <Field label="Reason category"><select className={INPUT} value={form.reasonCategory} onChange={(event) => setForm((current) => ({ ...current, reasonCategory: event.target.value }))}><option value="weather">Weather</option><option value="venue_unavailable">Venue unavailable</option><option value="cup_clash">Cup clash</option><option value="club_request">Club request</option><option value="officials">Officials</option><option value="other">Other</option></select></Field>
          <Field label="Reason"><textarea className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></Field>
          <Field label="Rearrangement deadline"><input type="date" className={INPUT} value={form.deadlineOn} onChange={(event) => setForm((current) => ({ ...current, deadlineOn: event.target.value }))} /></Field>
          <Field label="Requesting club"><select className={INPUT} value={form.requestedByClubId} onChange={(event) => setForm((current) => ({ ...current, requestedByClubId: event.target.value }))}><option value="">League / not specified</option>{workspace.clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></Field>
        </div>
        <button type="button" disabled={!canEdit || !selectedFixture || form.reason.trim().length < 2} onClick={async () => { try { await DB.upsertLeaguePostponement(leagueId, { ...form, originalDate: selectedFixture.date, originalKickOff: selectedFixture.kickOff, originalVenueId: selectedFixture.venueId, status: "rearrangement_required" }); await onRefresh(); setForm({ targetType: "", targetId: "", reasonCategory: "weather", reason: "", deadlineOn: "", requestedByClubId: "", notes: "" }); toast.success("Postponement added to the command queue"); } catch (error) { toast.error("Postponement could not be saved", { description: error?.message }); } }} className={`${BUTTON} mt-4 w-full bg-rose-600 text-white`}><CalendarClock size={15} /> Add to rearrangement queue</button>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 p-5"><div><div className="text-xl font-black text-slate-950">Rearrangement queue</div><div className="mt-1 text-sm font-semibold text-slate-500">The operator chooses the date; the database repeats every hard conflict check before creating a new version.</div></div><Pill tone={operations.postponements.length ? "amber" : "green"}>{operations.postponements.length}</Pill></div>
        <div className="divide-y divide-slate-100">
          {operations.postponements.map((row) => {
            const fixture = fixtures.find((item) => item.targetType === row.targetType && item.targetId === row.targetId);
            const open = !["closed", "rearranged", "rejected"].includes(row.status);
            const suggestions = Array.isArray(row.proposedDates) ? row.proposedDates : [];
            return (
              <div key={row.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div><div className="text-sm font-black text-slate-950">{fixture ? `${fixture.homeTeamName} v ${fixture.awayTeamName}` : "Completed or historic fixture"}</div><div className="mt-1 text-xs font-semibold text-slate-500">Original: {row.originalDate || "Unknown"} · {row.originalKickOff || "TBC"} · {row.reason}</div><div className="mt-2 flex flex-wrap gap-2"><Pill tone="rose">{row.reasonCategory || "postponed"}</Pill><Pill tone={row.status === "rearranged" ? "green" : "amber"}>{row.status}</Pill>{row.deadlineOn ? <Pill tone="amber">Deadline {row.deadlineOn}</Pill> : null}</div></div>
                  <select disabled={!canEdit || workingId === row.id} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-black" value={row.status} onChange={async (event) => { try { await DB.updateLeaguePostponementStatus(leagueId, row.id, event.target.value); await onRefresh(); toast.success("Rearrangement status updated"); } catch (error) { toast.error("Status could not be updated", { description: error?.message }); } }}><option value="requested">Requested</option><option value="approved">Approved</option><option value="rearrangement_required">Needs rearranging</option><option value="proposed">Date proposed</option><option value="rearranged">Rearranged</option><option value="rejected">Rejected</option><option value="closed">Closed</option></select>
                </div>

                {row.status === "rearranged" ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Rearranged</div><div className="mt-1 text-sm font-black text-emerald-950">{row.selectedDate} · {String(row.selectedKickOff || "").slice(0, 5) || "TBC"}</div><div className="mt-1 text-xs font-semibold text-emerald-700">New schedule version created and awaiting normal validation/publication.</div></div> : null}

                {open && fixture ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Suggested dates</div><div className="mt-1 text-xs font-semibold text-slate-500">Ranked by earliest valid date, fixture congestion and home/away sequence impact.</div></div><button type="button" disabled={!canEdit || workingId === row.id} onClick={() => findSuggestions(row, fixture)} className={`${BUTTON} bg-slate-950 text-white`}><Sparkles size={15} className={workingId === row.id ? "animate-pulse" : ""} /> {workingId === row.id ? "Checking…" : "Find valid dates"}</button></div>
                    <div className="mt-3 grid gap-2">{suggestions.map((suggestion) => <div key={`${row.id}-${suggestion.date}-${suggestion.kickOff}`} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-black text-slate-950">{suggestion.date} at {suggestion.kickOff}</div><div className="mt-1 text-[10px] font-semibold text-slate-500">{suggestion.congestion || 0} other fixtures that date · sequence impact {suggestion.sequencePenalty || 0}</div></div><button type="button" disabled={!canEdit || workingId === row.id} onClick={() => applySuggestion(row, suggestion)} className={`${BUTTON} bg-emerald-600 text-white`}><Save size={14} /> Apply date</button></div>)}{!suggestions.length ? <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs font-bold text-slate-400">Run the date finder to calculate conflict-free options.</div> : null}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {!operations.postponements.length ? <div className="p-10 text-center"><CheckCircle2 className="mx-auto text-emerald-400" size={34} /><div className="mt-3 text-sm font-black text-slate-600">No fixtures in the rearrangement queue</div></div> : null}
        </div>
      </Panel>
    </div>
  );
}

function Reports({ workspace, operations, fixtures }) {
  const coverage = getLeagueOfficialCoverage(fixtures, operations.requirements, operations.assignments);
  const accepted = operations.assignments.filter((row) => ["accepted", "confirmed"].includes(row.status)).length;
  const declined = operations.assignments.filter((row) => ["declined", "replacement_required"].includes(row.status)).length;
  const officialCounts = operations.officials.map((official) => ({ official, count: operations.assignments.filter((row) => row.officialId === official.id && !["declined", "withdrawn"].includes(row.status)).length })).sort((a, b) => b.count - a.count);
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Coverage" value={`${coverage.percentage}%`} detail={`${coverage.filled}/${coverage.required} roles`} tone={coverage.percentage === 100 ? "green" : "amber"} /><Metric label="Active officials" value={operations.officials.filter((row) => row.status === "active").length} /><Metric label="Accepted" value={accepted} tone="green" /><Metric label="Declines / replacements" value={declined} tone={declined ? "rose" : "green"} /><Metric label="Postponement queue" value={operations.postponements.filter((row) => !["closed", "rearranged", "rejected"].includes(row.status)).length} tone="amber" /></div><div className="grid gap-5 xl:grid-cols-2"><Panel className="p-5"><div className="flex items-center justify-between"><div><div className="text-lg font-black text-slate-950">Appointment export</div><div className="mt-1 text-xs font-semibold text-slate-500">Date, fixture, venue, role, official and response status.</div></div><button type="button" onClick={() => downloadText(`${workspace.league.slug || "league"}-official-appointments.csv`, leagueAppointmentsToCsv(fixtures, operations.assignments, operations.officials))} className={`${BUTTON} bg-slate-950 text-white`}><Download size={15} /> CSV</button></div><div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">Use this export as the appointment secretary’s weekly working sheet or reconciliation file while the pilot league continues using its current FA systems.</div></Panel><Panel className="overflow-hidden"><div className="border-b border-slate-200 p-5"><div className="text-lg font-black text-slate-950">Workload distribution</div><div className="mt-1 text-xs font-semibold text-slate-500">Appointments across the current schedule version and cup ties.</div></div><div className="max-h-[430px] divide-y divide-slate-100 overflow-y-auto">{officialCounts.map(({ official, count }) => <div key={official.id} className="flex items-center justify-between px-5 py-3"><div><div className="text-sm font-black text-slate-900">{official.name}</div><div className="mt-0.5 text-[10px] font-semibold text-slate-500">{official.grade || "Grade not set"}</div></div><Pill tone={count > official.maxAppointmentsPerWeek * 4 ? "amber" : "blue"}>{count} appointments</Pill></div>)}</div></Panel></div></div>;
}

export default function LeagueOfficialsWorkspace({ leagueId, workspace, operations, canEdit, onRefreshOperations, initialTab = "pool", focusToken = 0 }) {
  const [tab, setTab] = useState(initialTab);
  const [versions, setVersions] = useState([]);
  const [versionPayload, setVersionPayload] = useState(null);
  const [versionId, setVersionId] = useState("");
  const [status, setStatus] = useState("loading");
  const loadSchedule = useCallback(async (preferredVersionId = "") => { setStatus("loading"); try { const rows = (await DB.listLeagueScheduleVersions(leagueId)).map(normaliseScheduleVersion); setVersions(rows); const selected = rows.find((row) => row.id === preferredVersionId) || rows.find((row) => row.id === versionId) || rows.find((row) => row.status === "published") || rows[0]; if (selected) { setVersionId(selected.id); setVersionPayload(normaliseScheduleVersionPayload(await DB.getLeagueScheduleVersion(leagueId, selected.id))); } else setVersionPayload({ version: null, entries: [] }); setStatus("ready"); } catch (error) { setStatus("error"); toast.error("Officials workspace could not load the schedule", { description: error?.message }); } }, [leagueId, versionId]);
  useEffect(() => { loadSchedule(); }, [leagueId]);
  useEffect(() => { if (TABS.some(([key]) => key === initialTab)) setTab(initialTab); }, [initialTab, focusToken]);
  useEffect(() => { if (versionId && versions.some((row) => row.id === versionId)) DB.getLeagueScheduleVersion(leagueId, versionId).then((payload) => setVersionPayload(normaliseScheduleVersionPayload(payload))).catch(() => {}); }, [versionId]);
  const fixtures = useMemo(() => buildLeagueOperationalFixtures(workspace, versionPayload), [workspace, versionPayload]);
  const coverage = useMemo(() => getLeagueOfficialCoverage(fixtures, operations.requirements, operations.assignments), [fixtures, operations.requirements, operations.assignments]);
  if (status === "loading") return <Panel className="flex min-h-[440px] items-center justify-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-emerald-600" size={28} /><div className="mt-3 text-sm font-black text-slate-700">Loading match officials…</div></div></Panel>;
  return <div className="space-y-5"><Panel className="p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><UserCheck size={24} /></span><div><h2 className="text-2xl font-black text-slate-950">Match officials</h2><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">Competition requirements, referee pools, assistants, availability, appointments, responses and replacements.</p></div></div><div className="grid gap-3 sm:grid-cols-3"><Metric label="Pool" value={operations.officials.filter((row) => row.status === "active").length} detail="Active officials" /><Metric label="Coverage" value={`${coverage.percentage}%`} detail={`${coverage.missing.length} roles open`} tone={coverage.percentage === 100 ? "green" : "amber"} /><Metric label="Replacements" value={operations.assignments.filter((row) => row.status === "replacement_required").length} tone={operations.assignments.some((row) => row.status === "replacement_required") ? "rose" : "green"} /></div></div></Panel><Panel className="p-3"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-wrap gap-2">{TABS.map(([key, label]) => <button type="button" key={key} onClick={() => setTab(key)} className={`${BUTTON} ${tab === key ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{label}</button>)}</div>{["appointments", "postponements", "reports"].includes(tab) ? <select className={`${INPUT} max-w-sm`} value={versionId} onChange={(event) => setVersionId(event.target.value)}>{versions.map((version) => <option key={version.id} value={version.id}>Schedule v{version.versionNumber} · {version.status}</option>)}</select> : null}</div></Panel>{tab === "pool" ? <OfficialPool leagueId={leagueId} operations={operations} canEdit={canEdit} onRefresh={onRefreshOperations} /> : null}{tab === "requirements" ? <Requirements leagueId={leagueId} workspace={workspace} operations={operations} canEdit={canEdit} onRefresh={onRefreshOperations} /> : null}{tab === "appointments" ? <Appointments leagueId={leagueId} workspace={workspace} operations={operations} canEdit={canEdit} onRefresh={onRefreshOperations} fixtures={fixtures} /> : null}{tab === "availability" ? <AvailabilityAndConflicts leagueId={leagueId} workspace={workspace} operations={operations} canEdit={canEdit} onRefresh={onRefreshOperations} /> : null}{tab === "postponements" ? <Postponements leagueId={leagueId} workspace={workspace} operations={operations} canEdit={workspace.access.canOperate} onRefresh={onRefreshOperations} onScheduleChanged={loadSchedule} fixtures={fixtures} /> : null}{tab === "reports" ? <Reports workspace={workspace} operations={operations} fixtures={fixtures} /> : null}</div>;
}
