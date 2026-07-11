import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import { sortPitches } from "../../lib/pitches.js";
import { numberValue } from "../../lib/settings/dataExchange.js";
import {
  alignTeamContactsForEditing,
  getTeamContactKey,
  normaliseEditableTeamContact,
} from "../../lib/communications/contactModel.js";
import {
  getEntitlementLimit,
  isUnlimitedLimit,
  LIMIT_KEYS,
} from "../../lib/subscriptions/entitlements.js";
import SettingsDataActions from "./SettingsDataActions.jsx";
import {
  Field,
  Notice,
  PrimaryButton,
  SaveBar,
  SecondaryButton,
  SettingsPanel,
  SettingsSectionHeader,
  StatTile,
  inputClass,
  selectClass,
} from "./SettingsPrimitives.jsx";

const FORMATS = ["3v3", "5v5", "7v7", "9v9", "11v11-youth", "11v11-small", "11v11"];
const TEAM_TYPES = [
  ["youth", "Youth"],
  ["adult", "Adult"],
  ["veterans", "Veterans"],
  ["girls", "Girls"],
  ["women", "Women"],
];
const DAYS = ["Saturday", "Sunday", "Midweek"];

const TEAM_COLUMNS = [
  { key: "name", label: "Name", aliases: ["Team", "Team name"] },
  { key: "teamType", label: "Team Type", aliases: ["Type", "Category"] },
  { key: "format", label: "Format" },
  { key: "siteId", label: "Home Site", aliases: ["Site", "Site ID"] },
  { key: "defaultPitch", label: "Default Pitch", aliases: ["Pitch"] },
  { key: "altPitch", label: "Alternative Pitch", aliases: ["Alt Pitch"] },
  { key: "day", label: "Default Day", aliases: ["Day"] },
  { key: "gameMins", label: "Match Minutes", aliases: ["Minutes", "Mins"] },
  { key: "ageOrder", label: "Age Order" },
];

function getSites(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites : [];
  if (sites.length) {
    return sites.map((site, index) => ({
      id: site.id || `site-${index + 1}`,
      name: site.name || site.venue || `Site ${index + 1}`,
      isPrimary: !!site.isPrimary || site.id === club.primarySiteId || (!club.primarySiteId && index === 0),
    }));
  }
  return [{ id: club.primarySiteId || "main-ground", name: club.venue || "Main Ground", isPrimary: true }];
}

function classifyFallback(team = {}) {
  if (team.teamType) return team.teamType;
  const name = String(team.name || "").toLowerCase();
  if (/(1st|first|reserves|open age|sunday 1st|seniors|senior)/i.test(name)) return "adult";
  if (/vets|veterans/.test(name)) return "veterans";
  if (/women|ladies/.test(name)) return "women";
  if (/girls|lionesses/.test(name)) return "girls";
  return "youth";
}

function teamTypeLabel(team = {}) {
  const key = classifyFallback(team);
  return TEAM_TYPES.find(([value]) => value === key)?.[1] || "Youth";
}

function normaliseImportedTeam(row, index, primarySiteId) {
  const name = String(row.name || "").trim();
  if (!name) return null;
  const teamType = String(row.teamType || "youth").trim().toLowerCase().replace(/\s+/g, "_");
  const format = FORMATS.includes(row.format) ? row.format : "11v11-youth";
  const day = DAYS.includes(row.day) ? row.day : "Saturday";
  return {
    name,
    teamType: TEAM_TYPES.some(([value]) => value === teamType) ? teamType : "youth",
    format,
    siteId: String(row.siteId || primarySiteId || "").trim() || null,
    defaultPitch: String(row.defaultPitch || "").trim() || null,
    altPitch: String(row.altPitch || "").trim() || null,
    day,
    gameMins: Math.max(20, numberValue(row.gameMins, 70)),
    ageOrder: numberValue(row.ageOrder, index + 1),
  };
}

export default function TeamSettingsPanel({
  club = {},
  teamCfg = [],
  setTeamCfg,
  teamContacts = [],
  setTeamContacts,
  pitchCfg = [],
  TEAM_CONFIG_DEFAULT = [],
  saveTab,
  savedTab,
  subscription,
  workspaceAccess,
  communicationSchemaReady = false,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const sites = getSites(club);
  const primarySite = sites.find((site) => site.isPrimary) || sites[0];
  const sortedPitches = sortPitches(pitchCfg);
  const teamLimit = getEntitlementLimit(subscription, LIMIT_KEYS.TEAMS);
  const canAddTeam = isUnlimitedLimit(teamLimit) || teamCfg.length < teamLimit;
  const canManageContacts = Boolean(workspaceAccess?.canManageSettings);
  const contacts = alignTeamContactsForEditing(teamCfg, teamContacts);
  const counts = teamCfg.reduce((acc, team) => {
    const type = classifyFallback(team);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  useEffect(() => {
    if (!teamCfg.length) {
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex((current) => Math.min(Math.max(current, 0), teamCfg.length - 1));
  }, [teamCfg.length]);

  const filteredTeams = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return teamCfg
      .map((team, index) => ({ team, index, contact: contacts[index] }))
      .filter(({ team, contact }) => {
        if (!needle) return true;
        return [
          team.name,
          team.day,
          team.format,
          teamTypeLabel(team),
          contact?.coachName,
          contact?.coachEmail,
        ].some((value) => String(value || "").toLowerCase().includes(needle));
      });
  }, [contacts, query, teamCfg]);

  const setAlignedContacts = (updater) => {
    setTeamContacts?.((current) => updater(alignTeamContactsForEditing(teamCfg, current)));
  };

  const updateTeam = (index, field, value) => {
    setTeamCfg((current) => current.map((team, rowIndex) => (
      rowIndex === index ? { ...team, [field]: value === "" ? null : value } : team
    )));
    if (field === "name") {
      setAlignedContacts((current) => current.map((contact, rowIndex) => (
        rowIndex === index ? { ...contact, teamName: value } : contact
      )));
    }
  };

  const updateContact = (index, field, value) => {
    if (!canManageContacts) return;
    setAlignedContacts((current) => current.map((contact, rowIndex) => (
      rowIndex === index ? { ...contact, [field]: value } : contact
    )));
  };

  const clearContact = (index) => {
    if (!canManageContacts) return;
    setAlignedContacts((current) => current.map((contact, rowIndex) => (
      rowIndex === index
        ? normaliseEditableTeamContact({ teamKey: contact.teamKey, teamName: contact.teamName, receiveMatchdayMessages: false })
        : contact
    )));
  };

  const addTeam = () => {
    if (!canAddTeam) return;
    const nextTeam = {
      name: "New Team",
      teamType: "youth",
      format: "11v11-youth",
      siteId: primarySite?.id || null,
      defaultPitch: sortedPitches[0]?.id || null,
      altPitch: null,
      ageOrder: teamCfg.length + 1,
      day: "Saturday",
      gameMins: 70,
    };
    const nextIndex = teamCfg.length;
    setTeamCfg((current) => [...current, nextTeam]);
    setTeamContacts?.((current) => [
      ...alignTeamContactsForEditing(teamCfg, current),
      normaliseEditableTeamContact({ teamKey: getTeamContactKey(nextTeam, nextIndex), teamName: nextTeam.name }, nextTeam, nextIndex),
    ]);
    setQuery("");
    setSelectedIndex(nextIndex);
  };

  const removeTeam = (index) => {
    setTeamCfg((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setTeamContacts?.((current) => alignTeamContactsForEditing(teamCfg, current).filter((_, rowIndex) => rowIndex !== index));
    setSelectedIndex((current) => {
      if (current > index) return current - 1;
      if (current === index) return Math.max(0, Math.min(index, teamCfg.length - 2));
      return current;
    });
  };

  const importTeams = (rows, mode) => {
    const next = mode === "append" ? [...teamCfg, ...rows] : rows;
    const limited = isUnlimitedLimit(teamLimit) ? next : next.slice(0, teamLimit);
    setTeamCfg(limited);
    setTeamContacts?.((current) => alignTeamContactsForEditing(limited, mode === "append" ? current : []));
    setSelectedIndex(0);
    setQuery("");
  };

  const restoreDefaults = () => {
    setTeamCfg(TEAM_CONFIG_DEFAULT);
    setTeamContacts?.(alignTeamContactsForEditing(TEAM_CONFIG_DEFAULT, []));
    setSelectedIndex(0);
    setQuery("");
  };

  const selectedTeam = teamCfg[selectedIndex] || null;
  const selectedContact = selectedTeam
    ? contacts[selectedIndex] || normaliseEditableTeamContact({}, selectedTeam, selectedIndex)
    : null;
  const selectedHomeSiteId = selectedTeam?.siteId || primarySite?.id || "";
  const selectedSitePitches = sortedPitches.filter((pitch) => (pitch.siteId || primarySite?.id) === selectedHomeSiteId);
  const selectedPitchOptions = selectedSitePitches.length ? selectedSitePitches : sortedPitches;

  return (
    <SettingsPanel>
      <SettingsSectionHeader
        icon={UsersRound}
        eyebrow="Matchday setup"
        title="Teams and coach contacts"
        description="Choose a team from the list, edit it in one place and save without scrolling through every team. Adult coach contact details remain separately protected."
        action={<PrimaryButton icon={Plus} onClick={addTeam} disabled={!canAddTeam}>Add team</PrimaryButton>}
      />

      <SaveBar
        sticky
        onSave={() => saveTab?.("teams", { teamCfg, teamContacts: contacts })}
        saved={savedTab === "teams"}
        label="Save teams and contacts"
      >
        <span className="font-black text-slate-700">Editing {selectedTeam?.name || "team settings"}</span>
        <SecondaryButton icon={RotateCcw} onClick={restoreDefaults}>Restore demonstration defaults</SecondaryButton>
      </SaveBar>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Teams" value={teamCfg.length} detail={isUnlimitedLimit(teamLimit) ? "Unlimited plan limit" : `${teamLimit} plan limit`} tone="green" />
        <StatTile label="Youth" value={counts.youth || 0} tone="blue" />
        <StatTile label="Adult" value={counts.adult || 0} tone="violet" />
        <StatTile label="Girls / women" value={(counts.girls || 0) + (counts.women || 0)} tone="rose" />
        <StatTile label="Coach contacts" value={contacts.filter((contact) => contact.coachPhone || contact.coachEmail).length} tone="slate" />
      </div>

      <details className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50/70">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-black text-slate-800 marker:hidden">
          Import, export or download a team template
        </summary>
        <div className="border-t border-slate-200 p-4 sm:p-5">
          <SettingsDataActions
            label="Teams"
            rows={teamCfg}
            columns={TEAM_COLUMNS}
            filename="ground-control-teams"
            templateRows={[{ name: "U14 Example", teamType: "youth", format: "11v11-youth", siteId: primarySite?.id || "main-ground", defaultPitch: "P1", altPitch: "P2", day: "Saturday", gameMins: 70, ageOrder: 7 }]}
            normaliseRow={(row, index) => normaliseImportedTeam(row, index, primarySite?.id)}
            onImport={importTeams}
          />
        </div>
      </details>

      {!communicationSchemaReady ? (
        <Notice tone="warning" className="mt-5">
          The secure coach-contact migration has not been detected. Apply the included Supabase migration before saving contacts.
        </Notice>
      ) : null}

      {!canAddTeam ? (
        <Notice tone="warning" className="mt-5">
          {subscription?.planName || "The current plan"} allows {teamLimit} teams. Remove a team or review Plan & subscription before adding another.
        </Notice>
      ) : null}

      <Notice tone="info" className="mt-5">
        Only adult coach or manager contact details should be entered here. Do not enter player or child contact information. Contact data is excluded from general team exports.
      </Notice>

      <div className="mt-5 grid min-w-0 gap-5 2xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-[24px] border border-slate-200 bg-slate-50/80 p-3 2xl:sticky 2xl:top-44 2xl:max-h-[calc(100vh-12rem)] 2xl:self-start 2xl:overflow-hidden">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClass} pl-10`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a team or coach"
              aria-label="Find a team or coach"
            />
          </div>
          <div className="mt-3 flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <span>{filteredTeams.length} shown</span>
            <span>{teamCfg.length} total</span>
          </div>
          <div className="mt-2 grid max-h-[280px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 2xl:block 2xl:max-h-[calc(100vh-18rem)] 2xl:space-y-1">
            {filteredTeams.map(({ team, index, contact }) => {
              const active = index === selectedIndex;
              const contactReady = Boolean(contact?.coachPhone || contact?.coachEmail);
              return (
                <button
                  key={contact?.teamKey || `team-${index}`}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                    active
                      ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                      : "border-transparent bg-white text-slate-800 hover:border-slate-200"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white/10 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>
                    {contactReady ? <CheckCircle2 size={17} /> : <UsersRound size={17} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">{team.name || "Unnamed team"}</span>
                    <span className={`mt-0.5 block truncate text-[11px] font-bold ${active ? "text-slate-300" : "text-slate-400"}`}>
                      {team.day || "Saturday"} · {team.format || "No format"} · {teamTypeLabel(team)}
                    </span>
                  </span>
                  <ChevronRight size={16} className={active ? "text-slate-300" : "text-slate-400"} />
                </button>
              );
            })}
            {!filteredTeams.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">
                No teams match that search.
              </div>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0">
          {selectedTeam && selectedContact ? (
            <article className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Team {selectedIndex + 1} of {teamCfg.length}</div>
                  <div className="mt-1 text-lg font-black text-slate-950">{selectedTeam.name || "Unnamed team"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeTeam(selectedIndex)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 transition hover:bg-rose-50"
                >
                  <Trash2 size={16} /> Remove team
                </button>
              </div>

              <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
                <Field label="Team name" className="md:col-span-2">
                  <input className={inputClass} value={selectedTeam.name || ""} onChange={(event) => updateTeam(selectedIndex, "name", event.target.value)} />
                </Field>
                <Field label="Type">
                  <select className={selectClass} value={classifyFallback(selectedTeam)} onChange={(event) => updateTeam(selectedIndex, "teamType", event.target.value)}>
                    {TEAM_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Format">
                  <select className={selectClass} value={selectedTeam.format || ""} onChange={(event) => updateTeam(selectedIndex, "format", event.target.value)}>
                    {FORMATS.map((format) => <option key={format}>{format}</option>)}
                  </select>
                </Field>
                <Field label="Default day">
                  <select className={selectClass} value={selectedTeam.day || "Saturday"} onChange={(event) => updateTeam(selectedIndex, "day", event.target.value)}>
                    {DAYS.map((day) => <option key={day}>{day}</option>)}
                  </select>
                </Field>
                <Field label="Minutes">
                  <input type="number" min={20} max={120} step={5} className={inputClass} value={selectedTeam.gameMins ?? 70} onChange={(event) => updateTeam(selectedIndex, "gameMins", Number(event.target.value))} />
                </Field>
                <Field label="Home site">
                  <select className={selectClass} value={selectedHomeSiteId} onChange={(event) => updateTeam(selectedIndex, "siteId", event.target.value)}>
                    {sites.map((site) => <option key={site.id} value={site.id}>{site.name}{site.isPrimary ? " ★" : ""}</option>)}
                  </select>
                </Field>
                <Field label="Default pitch">
                  <select className={selectClass} value={selectedTeam.defaultPitch || ""} onChange={(event) => updateTeam(selectedIndex, "defaultPitch", event.target.value)}>
                    <option value="">Unassigned</option>
                    {selectedPitchOptions.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label}</option>)}
                  </select>
                </Field>
                <Field label="Alternative pitch">
                  <select className={selectClass} value={selectedTeam.altPitch || ""} onChange={(event) => updateTeam(selectedIndex, "altPitch", event.target.value)}>
                    <option value="">None</option>
                    {selectedPitchOptions.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label}</option>)}
                  </select>
                </Field>
                <Field label="Scheduling order" hint="Lower numbers are considered first.">
                  <input type="number" min={1} className={inputClass} value={selectedTeam.ageOrder ?? selectedIndex + 1} onChange={(event) => updateTeam(selectedIndex, "ageOrder", Number(event.target.value))} />
                </Field>
              </div>

              <div className="mt-6 rounded-[22px] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700"><ShieldCheck size={15} /> Restricted contact record</div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Visible only to club administrators and authorised matchday operators. It is not included in the general team CSV.</p>
                  </div>
                  {canManageContacts && (selectedContact.coachName || selectedContact.coachPhone || selectedContact.coachEmail || selectedContact.assistantName) ? (
                    <button type="button" onClick={() => clearContact(selectedIndex)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50">Remove contact data</button>
                  ) : null}
                </div>

                {canManageContacts ? (
                  <div className="mt-5 grid gap-x-5 gap-y-5 md:grid-cols-2">
                    <Field label="Coach / manager name">
                      <input className={inputClass} value={selectedContact.coachName} onChange={(event) => updateContact(selectedIndex, "coachName", event.target.value)} placeholder="Primary adult contact" />
                    </Field>
                    <Field label="Mobile number">
                      <input className={inputClass} value={selectedContact.coachPhone} onChange={(event) => updateContact(selectedIndex, "coachPhone", event.target.value)} placeholder="07xxx xxxxxx" inputMode="tel" />
                    </Field>
                    <Field label="Email address">
                      <input type="email" className={inputClass} value={selectedContact.coachEmail} onChange={(event) => updateContact(selectedIndex, "coachEmail", event.target.value)} placeholder="coach@club.org.uk" />
                    </Field>
                    <Field label="Preferred channel">
                      <select className={selectClass} value={selectedContact.preferredChannel} onChange={(event) => updateContact(selectedIndex, "preferredChannel", event.target.value)}>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                        <option value="email">Email</option>
                      </select>
                    </Field>
                    <Field label="Assistant coach name">
                      <input className={inputClass} value={selectedContact.assistantName} onChange={(event) => updateContact(selectedIndex, "assistantName", event.target.value)} placeholder="Optional" />
                    </Field>
                    <Field label="Assistant mobile">
                      <input className={inputClass} value={selectedContact.assistantPhone} onChange={(event) => updateContact(selectedIndex, "assistantPhone", event.target.value)} placeholder="Optional" inputMode="tel" />
                    </Field>
                    <Field label="Assistant email">
                      <input type="email" className={inputClass} value={selectedContact.assistantEmail} onChange={(event) => updateContact(selectedIndex, "assistantEmail", event.target.value)} placeholder="Optional" />
                    </Field>
                    <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                      <input type="checkbox" checked={selectedContact.assistantEnabled} onChange={(event) => updateContact(selectedIndex, "assistantEnabled", event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" />
                      Include assistant in messages
                    </label>
                    <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                      <input type="checkbox" checked={selectedContact.receiveMatchdayMessages} onChange={(event) => updateContact(selectedIndex, "receiveMatchdayMessages", event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" />
                      Receive matchday messages
                    </label>
                    <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedContact.privacyNoticeProvidedAt)}
                        onChange={(event) => updateContact(selectedIndex, "privacyNoticeProvidedAt", event.target.checked ? new Date().toISOString() : null)}
                        className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                      />
                      Privacy notice provided
                    </label>
                  </div>
                ) : (
                  <Notice tone="info" className="mt-4">Coach contact details are hidden because your role cannot manage club contacts.</Notice>
                )}
              </div>
            </article>
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 p-10 text-center text-sm font-semibold text-slate-500">
              No teams configured. Add a team or import a CSV template.
            </div>
          )}
        </div>
      </div>
    </SettingsPanel>
  );
}
