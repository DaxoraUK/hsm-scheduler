import React from "react";
import { Plus, RotateCcw, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { sortPitches } from "../../lib/pitches.js";
import { numberValue } from "../../lib/settings/dataExchange.js";
import { alignTeamContactsForEditing, getTeamContactKey, normaliseEditableTeamContact } from "../../lib/communications/contactModel.js";
import { getEntitlementLimit, isUnlimitedLimit, LIMIT_KEYS } from "../../lib/subscriptions/entitlements.js";
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
  };

  const removeTeam = (index) => {
    setTeamCfg((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setTeamContacts?.((current) => alignTeamContactsForEditing(teamCfg, current).filter((_, rowIndex) => rowIndex !== index));
  };

  const importTeams = (rows, mode) => {
    const next = mode === "append" ? [...teamCfg, ...rows] : rows;
    const limited = isUnlimitedLimit(teamLimit) ? next : next.slice(0, teamLimit);
    setTeamCfg(limited);
    setTeamContacts?.((current) => alignTeamContactsForEditing(limited, mode === "append" ? current : []));
  };

  const restoreDefaults = () => {
    setTeamCfg(TEAM_CONFIG_DEFAULT);
    setTeamContacts?.(alignTeamContactsForEditing(TEAM_CONFIG_DEFAULT, []));
  };

  return (
    <SettingsPanel>
      <SettingsSectionHeader
        icon={UsersRound}
        eyebrow="Matchday setup"
        title="Teams and coach contacts"
        description="Team setup drives scheduling. Adult coach contact details are stored separately with tighter access controls for operational communications."
        action={<PrimaryButton icon={Plus} onClick={addTeam} disabled={!canAddTeam}>Add team</PrimaryButton>}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Teams" value={teamCfg.length} detail={isUnlimitedLimit(teamLimit) ? "Unlimited plan limit" : `${teamLimit} plan limit`} tone="green" />
        <StatTile label="Youth" value={counts.youth || 0} tone="blue" />
        <StatTile label="Adult" value={counts.adult || 0} tone="violet" />
        <StatTile label="Girls / women" value={(counts.girls || 0) + (counts.women || 0)} tone="rose" />
        <StatTile label="Coach contacts" value={contacts.filter((contact) => contact.coachPhone || contact.coachEmail).length} tone="slate" />
      </div>

      <div className="mt-5">
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

      <div className="mt-5">
        <Notice tone="info">
          Only adult coach or manager contact details should be entered here. Do not enter player or child contact information. Contact data is excluded from general team exports.
        </Notice>
      </div>

      <div className="mt-6 space-y-4">
        {teamCfg.map((team, index) => {
          const homeSiteId = team.siteId || primarySite?.id || "";
          const sitePitches = sortedPitches.filter((pitch) => (pitch.siteId || primarySite?.id) === homeSiteId);
          const options = sitePitches.length ? sitePitches : sortedPitches;
          const contact = contacts[index] || normaliseEditableTeamContact({}, team, index);

          return (
            <article key={contact.teamKey || `team-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Team {index + 1}</div>
                  <div className="mt-1 text-sm font-black text-slate-950">{team.name || "Unnamed team"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeTeam(index)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                  aria-label={`Remove ${team.name || "team"}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>

              <div className="grid gap-x-4 gap-y-5 lg:grid-cols-2 xl:grid-cols-3">
                <Field label="Team name" className="lg:col-span-2 xl:col-span-2">
                  <input className={inputClass} value={team.name || ""} onChange={(event) => updateTeam(index, "name", event.target.value)} />
                </Field>
                <Field label="Type">
                  <select className={selectClass} value={classifyFallback(team)} onChange={(event) => updateTeam(index, "teamType", event.target.value)}>
                    {TEAM_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Format">
                  <select className={selectClass} value={team.format || ""} onChange={(event) => updateTeam(index, "format", event.target.value)}>
                    {FORMATS.map((format) => <option key={format}>{format}</option>)}
                  </select>
                </Field>
                <Field label="Default day">
                  <select className={selectClass} value={team.day || "Saturday"} onChange={(event) => updateTeam(index, "day", event.target.value)}>
                    {DAYS.map((day) => <option key={day}>{day}</option>)}
                  </select>
                </Field>
                <Field label="Minutes">
                  <input type="number" min={20} max={120} step={5} className={inputClass} value={team.gameMins ?? 70} onChange={(event) => updateTeam(index, "gameMins", Number(event.target.value))} />
                </Field>
                <Field label="Home site">
                  <select className={selectClass} value={homeSiteId} onChange={(event) => updateTeam(index, "siteId", event.target.value)}>
                    {sites.map((site) => <option key={site.id} value={site.id}>{site.name}{site.isPrimary ? " ★" : ""}</option>)}
                  </select>
                </Field>
                <Field label="Default pitch">
                  <select className={selectClass} value={team.defaultPitch || ""} onChange={(event) => updateTeam(index, "defaultPitch", event.target.value)}>
                    <option value="">Unassigned</option>
                    {options.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label}</option>)}
                  </select>
                </Field>
                <Field label="Alternative pitch">
                  <select className={selectClass} value={team.altPitch || ""} onChange={(event) => updateTeam(index, "altPitch", event.target.value)}>
                    <option value="">None</option>
                    {options.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label}</option>)}
                  </select>
                </Field>
                <Field label="Scheduling order" hint="Lower numbers are considered first.">
                  <input type="number" min={1} className={inputClass} value={team.ageOrder ?? index + 1} onChange={(event) => updateTeam(index, "ageOrder", Number(event.target.value))} />
                </Field>
              </div>

              <div className="mt-6 rounded-[22px] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700"><ShieldCheck size={15} /> Restricted contact record</div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Visible only to club administrators and authorised matchday operators. It is not included in the general team CSV.</p>
                  </div>
                  {canManageContacts && (contact.coachName || contact.coachPhone || contact.coachEmail || contact.assistantName) ? (
                    <button type="button" onClick={() => clearContact(index)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50">Remove contact data</button>
                  ) : null}
                </div>

                {canManageContacts ? (
                  <div className="mt-5 grid gap-x-4 gap-y-5 lg:grid-cols-2 xl:grid-cols-3">
                    <Field label="Coach / manager name">
                      <input className={inputClass} value={contact.coachName} onChange={(event) => updateContact(index, "coachName", event.target.value)} placeholder="Primary adult contact" />
                    </Field>
                    <Field label="Mobile number">
                      <input className={inputClass} value={contact.coachPhone} onChange={(event) => updateContact(index, "coachPhone", event.target.value)} placeholder="07xxx xxxxxx" inputMode="tel" />
                    </Field>
                    <Field label="Email address">
                      <input type="email" className={inputClass} value={contact.coachEmail} onChange={(event) => updateContact(index, "coachEmail", event.target.value)} placeholder="coach@club.org.uk" />
                    </Field>
                    <Field label="Preferred channel">
                      <select className={selectClass} value={contact.preferredChannel} onChange={(event) => updateContact(index, "preferredChannel", event.target.value)}>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                        <option value="email">Email</option>
                      </select>
                    </Field>
                    <Field label="Assistant coach name">
                      <input className={inputClass} value={contact.assistantName} onChange={(event) => updateContact(index, "assistantName", event.target.value)} placeholder="Optional" />
                    </Field>
                    <Field label="Assistant mobile">
                      <input className={inputClass} value={contact.assistantPhone} onChange={(event) => updateContact(index, "assistantPhone", event.target.value)} placeholder="Optional" inputMode="tel" />
                    </Field>
                    <Field label="Assistant email">
                      <input type="email" className={inputClass} value={contact.assistantEmail} onChange={(event) => updateContact(index, "assistantEmail", event.target.value)} placeholder="Optional" />
                    </Field>
                    <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                      <input type="checkbox" checked={contact.assistantEnabled} onChange={(event) => updateContact(index, "assistantEnabled", event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" />
                      Include assistant in messages
                    </label>
                    <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                      <input type="checkbox" checked={contact.receiveMatchdayMessages} onChange={(event) => updateContact(index, "receiveMatchdayMessages", event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" />
                      Receive matchday messages
                    </label>
                    <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(contact.privacyNoticeProvidedAt)}
                        onChange={(event) => updateContact(index, "privacyNoticeProvidedAt", event.target.checked ? new Date().toISOString() : null)}
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
          );
        })}
      </div>

      {!teamCfg.length ? <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">No teams configured. Add a team or import a CSV template.</div> : null}

      <SaveBar onSave={() => saveTab?.("teams", { teamCfg, teamContacts: contacts })} saved={savedTab === "teams"} label="Save teams and contacts">
        <SecondaryButton icon={RotateCcw} onClick={restoreDefaults}>Restore demonstration defaults</SecondaryButton>
      </SaveBar>
    </SettingsPanel>
  );
}
