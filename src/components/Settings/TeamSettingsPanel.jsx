import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
  UserRoundPlus,
} from "lucide-react";
import { sortPitches } from "../../lib/pitches.js";
import { DB } from "../../lib/supabase.js";
import { resolveCoachHubContactForTeam } from "../../lib/coachHubContactBridge.js";
import { numberValue } from "../../lib/settings/dataExchange.js";
import { getClubSites, getPrimarySite, reconcileSiteAssignments, resolveSiteId } from "../../lib/siteAssignments.js";
import { sortTeamEntriesAlphabetically } from "../../lib/teams/teamOrdering.js";
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

function ensureFirstTeamHorwichAlias(team = {}) {
  if (String(team.name || "").trim().toLowerCase() !== "hsm 1st team") return team;
  const aliases = Array.isArray(team.externalAliases) ? team.externalAliases.join(", ") : String(team.externalAliases || "");
  if (aliases.split(",").some((alias) => alias.trim().toLowerCase() === "horwich")) return team;
  return { ...team, externalAliases: [aliases, "Horwich"].filter(Boolean).join(", ") };
}

const TEAM_COLUMNS = [
  { key: "name", label: "Name", aliases: ["Team", "Team name"] },
  { key: "externalAliases", label: "External Team Names", aliases: ["Full-Time names", "External aliases"] },
  { key: "teamType", label: "Team Type", aliases: ["Type", "Category"] },
  { key: "format", label: "Format" },
  { key: "siteId", label: "Home Site", aliases: ["Site", "Site ID"] },
  { key: "defaultPitch", label: "Default Pitch", aliases: ["Pitch"] },
  { key: "altPitch", label: "Alternative Pitch", aliases: ["Alt Pitch"] },
  { key: "day", label: "Default Day", aliases: ["Day"] },
  { key: "gameMins", label: "Match Minutes", aliases: ["Minutes", "Mins"] },
  { key: "ageOrder", label: "Age Order" },
];

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
  return ensureFirstTeamHorwichAlias({
    name,
    externalAliases: String(row.externalAliases || "").trim(),
    teamType: TEAM_TYPES.some(([value]) => value === teamType) ? teamType : "youth",
    format,
    siteId: String(row.siteId || primarySiteId || "").trim() || null,
    defaultPitch: String(row.defaultPitch || "").trim() || null,
    altPitch: String(row.altPitch || "").trim() || null,
    day,
    gameMins: Math.max(20, numberValue(row.gameMins, 70)),
    ageOrder: numberValue(row.ageOrder, index + 1),
  });
}

function CompactMetric({ label, value, detail, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    violet: "border-violet-200 bg-violet-50 text-violet-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone] || tones.slate}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-55">{label}</div>
      <div className="mt-1 text-xl font-black tracking-tight">{value}</div>
      {detail ? <div className="mt-0.5 text-[11px] font-bold opacity-60">{detail}</div> : null}
    </div>
  );
}

function hasDirectContactData(contact = {}) {
  return Boolean(contact.coachName || contact.coachPhone || contact.coachEmail || contact.assistantName || contact.assistantPhone || contact.assistantEmail);
}

function primaryCoachHubAssignment(contact = {}) {
  const assignments = Array.isArray(contact.additionalContacts) ? contact.additionalContacts : [];
  return assignments.find((assignment) => assignment?.isPrimary)
    || assignments.find((assignment) => ["manager", "lead_coach", "coach"].includes(String(assignment?.staffRole || "").toLowerCase()))
    || assignments[0]
    || null;
}

function visibleTeamContact(contact = {}) {
  const assignedPrimary = primaryCoachHubAssignment(contact);
  if (!assignedPrimary) {
    return { ...contact, coachHubManagedPrimary: false, assignedPrimary: null };
  }
  return {
    ...contact,
    coachName: assignedPrimary.name || "",
    coachPhone: assignedPrimary.mobile || "",
    coachEmail: assignedPrimary.email || "",
    preferredChannel: assignedPrimary.preferredChannel || contact.preferredChannel || "email",
    coachHubManagedPrimary: true,
    assignedPrimary,
  };
}

function hasContactData(contact = {}) {
  return hasDirectContactData(contact) || Boolean(primaryCoachHubAssignment(contact));
}

function coachHubContactForTeam(team = {}, index = 0, workspace = {}) {
  return resolveCoachHubContactForTeam(
    { ...team, key: getTeamContactKey(team, index) },
    [workspace?.people || [], workspace?.assignments || []],
  );
}

function resolvedVisibleTeamContact(team = {}, index = 0, contact = {}, workspace = {}) {
  const directCoachHubContact = coachHubContactForTeam(team, index, workspace);
  if (directCoachHubContact) {
    return {
      ...contact,
      coachName: directCoachHubContact.coachName || "",
      coachPhone: directCoachHubContact.coachPhone || "",
      coachEmail: directCoachHubContact.coachEmail || "",
      preferredChannel: directCoachHubContact.preferredChannel || contact.preferredChannel || "email",
      coachHubManagedPrimary: true,
      assignedPrimary: directCoachHubContact,
    };
  }
  return visibleTeamContact(contact);
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
  setSettingsTab,
  activeClubId,
}) {
  useEffect(() => {
    setTeamCfg((current) => {
      const upgraded = current.map(ensureFirstTeamHorwichAlias);
      return upgraded.some((team, index) => team !== current[index]) ? upgraded : current;
    });
  }, [setTeamCfg]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [limitMessage, setLimitMessage] = useState("");
  const [coachHubWorkspace, setCoachHubWorkspace] = useState({ people: [], assignments: [] });
  const clubId = activeClubId || club.id;
  const sites = useMemo(() => getClubSites(club), [club]);
  const primarySite = getPrimarySite(sites);
  const assignments = useMemo(() => reconcileSiteAssignments({ club, teams: teamCfg, pitches: pitchCfg }), [club, teamCfg, pitchCfg]);
  const sortedPitches = useMemo(() => sortPitches(assignments.pitches), [assignments.pitches]);
  const teamLimit = getEntitlementLimit(subscription, LIMIT_KEYS.TEAMS);
  const canAddTeam = isUnlimitedLimit(teamLimit) || teamCfg.length < teamLimit;
  const overTeamLimit = !isUnlimitedLimit(teamLimit) && teamCfg.length > teamLimit;
  const excessTeams = overTeamLimit ? teamCfg.length - teamLimit : 0;
  const canManageContacts = Boolean(workspaceAccess?.canManageSettings);
  const contacts = alignTeamContactsForEditing(teamCfg, teamContacts);
  const counts = teamCfg.reduce((acc, team) => {
    const type = classifyFallback(team);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const refreshCoachHubWorkspace = useCallback(async () => {
    if (!clubId || !canManageContacts) {
      setCoachHubWorkspace({ people: [], assignments: [] });
      return;
    }
    try {
      const payload = await DB.listCoachHubAdminWorkspace(clubId);
      setCoachHubWorkspace({
        people: Array.isArray(payload?.people) ? payload.people : [],
        assignments: Array.isArray(payload?.assignments) ? payload.assignments : [],
      });
    } catch {
      // The protected team-contact RPC remains the fallback for non-admin roles
      // and for brief schema-cache refresh windows during deployment.
      setCoachHubWorkspace({ people: [], assignments: [] });
    }
  }, [canManageContacts, clubId]);

  useEffect(() => {
    refreshCoachHubWorkspace();
    if (typeof window === "undefined") return undefined;
    const refresh = () => refreshCoachHubWorkspace();
    window.addEventListener("ground-control-coach-hub-contacts-changed", refresh);
    return () => window.removeEventListener("ground-control-coach-hub-contacts-changed", refresh);
  }, [refreshCoachHubWorkspace]);

  useEffect(() => {
    if (!teamCfg.length) {
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex((current) => Math.min(Math.max(current, 0), teamCfg.length - 1));
  }, [teamCfg.length]);

  const filteredTeams = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortTeamEntriesAlphabetically(teamCfg
      .map((team, index) => {
        const contact = contacts[index];
        return {
          team,
          index,
          contact,
          visibleContact: resolvedVisibleTeamContact(team, index, contact, coachHubWorkspace),
        };
      })
      .filter(({ team, visibleContact }) => {
        if (!needle) return true;
        const resolvedSiteId = resolveSiteId(team.siteId || team.homeSiteId, sites, primarySite?.id);
        const siteName = sites.find((site) => site.id === resolvedSiteId)?.name || "";
        return [team.name, team.day, team.format, teamTypeLabel(team), siteName, visibleContact?.coachName, visibleContact?.coachEmail]
          .some((value) => String(value || "").toLowerCase().includes(needle));
      }));
  }, [coachHubWorkspace, contacts, primarySite?.id, query, sites, teamCfg]);

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

  const saveTeams = () => {
    const nextTeams = reconcileSiteAssignments({ club, teams: teamCfg }).teams;
    if (nextTeams.some((team, index) => team.siteId !== teamCfg[index]?.siteId)) setTeamCfg(nextTeams);
    return saveTab?.("teams", { teamCfg: nextTeams, teamContacts: contacts });
  };

  const addTeam = () => {
    if (!canAddTeam) {
      setLimitMessage(`${subscription?.planName || "The current plan"} allows ${teamLimit} teams.`);
      return;
    }
    setLimitMessage("");
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
    setLimitMessage("");
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
    if (!isUnlimitedLimit(teamLimit) && next.length > teamLimit) {
      setLimitMessage(`Import blocked: ${next.length} teams exceeds the ${teamLimit}-team ${subscription?.planName || "plan"} limit.`);
      return;
    }
    const resolved = reconcileSiteAssignments({ club, teams: next }).teams;
    setLimitMessage("");
    setTeamCfg(resolved);
    setTeamContacts?.((current) => alignTeamContactsForEditing(resolved, mode === "append" ? current : []));
    setSelectedIndex(0);
    setQuery("");
  };

  const restoreDefaults = () => {
    if (!isUnlimitedLimit(teamLimit) && TEAM_CONFIG_DEFAULT.length > teamLimit) {
      setLimitMessage(`Demonstration defaults contain ${TEAM_CONFIG_DEFAULT.length} teams and cannot be restored on this plan.`);
      return;
    }
    const resolved = reconcileSiteAssignments({ club, teams: TEAM_CONFIG_DEFAULT }).teams;
    setLimitMessage("");
    setTeamCfg(resolved);
    setTeamContacts?.(alignTeamContactsForEditing(resolved, []));
    setSelectedIndex(0);
    setQuery("");
  };

  const selectedTeam = teamCfg[selectedIndex] || null;
  const selectedStoredContact = selectedTeam
    ? contacts[selectedIndex] || normaliseEditableTeamContact({}, selectedTeam, selectedIndex)
    : null;
  const selectedContact = selectedStoredContact
    ? resolvedVisibleTeamContact(selectedTeam, selectedIndex, selectedStoredContact, coachHubWorkspace)
    : null;
  const selectedHomeSiteId = resolveSiteId(selectedTeam?.siteId || selectedTeam?.homeSiteId, sites, primarySite?.id);
  const selectedSitePitches = sortedPitches.filter((pitch) => resolveSiteId(pitch.siteId, sites, primarySite?.id) === selectedHomeSiteId);
  const selectedPitchOptions = selectedSitePitches.length ? selectedSitePitches : sortedPitches;
  const selectedContactReady = Boolean(
    selectedContact?.coachName
    || selectedContact?.coachPhone
    || selectedContact?.coachEmail
    || selectedContact?.assistantName
    || selectedContact?.assistantPhone
    || selectedContact?.assistantEmail,
  );
  const selectedDirectContactReady = hasDirectContactData(selectedStoredContact);
  const coachHubManagedPrimary = Boolean(selectedContact?.coachHubManagedPrimary);

  return (
    <SettingsPanel className="p-5 sm:p-6">
      <SettingsSectionHeader
        icon={UsersRound}
        eyebrow="Matchday setup"
        title="Teams and coach contacts"
        description="Select a team, manage its scheduling details and open the protected contact record only when needed."
        action={<PrimaryButton icon={Plus} onClick={addTeam} disabled={!canAddTeam}>Add team</PrimaryButton>}
      />

      <SaveBar
        sticky
        onSave={saveTeams}
        saved={savedTab === "teams"}
        label="Save teams and contacts"
        disabled={overTeamLimit}
        disabledReason={overTeamLimit ? `Remove ${excessTeams} team${excessTeams === 1 ? "" : "s"} or upgrade before saving.` : ""}
      >
        <span className="font-black text-slate-700">Editing {selectedTeam?.name || "team settings"}</span>
        <SecondaryButton icon={RotateCcw} onClick={restoreDefaults}>Restore defaults</SecondaryButton>
      </SaveBar>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <CompactMetric label="Teams" value={teamCfg.length} detail={isUnlimitedLimit(teamLimit) ? "Unlimited" : `${teamLimit} limit`} tone="green" />
        <CompactMetric label="Youth" value={counts.youth || 0} tone="blue" />
        <CompactMetric label="Adult" value={counts.adult || 0} tone="violet" />
        <CompactMetric label="Girls / women" value={(counts.girls || 0) + (counts.women || 0)} tone="rose" />
        <CompactMetric
          label="Contacts"
          value={teamCfg.filter((team, index) => {
            const visible = resolvedVisibleTeamContact(team, index, contacts[index], coachHubWorkspace);
            return Boolean(visible?.coachName || visible?.coachPhone || visible?.coachEmail || hasContactData(contacts[index]));
          }).length}
        />
      </div>

      {assignments.repairedTeams > 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {assignments.repairedTeams} historic team assignment{assignments.repairedTeams === 1 ? "" : "s"} will be linked to {primarySite?.name || "the primary site"} when saved.
        </div>
      ) : null}

      <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-slate-800 marker:hidden">Import, export or download a team template</summary>
        <div className="border-t border-slate-200 p-4">
          <SettingsDataActions
            label="Teams"
            rows={assignments.teams}
            columns={TEAM_COLUMNS}
            filename="ground-control-teams"
            templateRows={[{ name: "U14 Example", teamType: "youth", format: "11v11-youth", siteId: primarySite?.id || "main-ground", defaultPitch: "P1", altPitch: "P2", day: "Saturday", gameMins: 70, ageOrder: 7 }]}
            normaliseRow={(row, index) => normaliseImportedTeam(row, index, primarySite?.id)}
            onImport={importTeams}
          />
        </div>
      </details>

      {limitMessage ? <Notice tone="warning" className="mt-4">{limitMessage}</Notice> : null}
      {!communicationSchemaReady ? <Notice tone="warning" className="mt-4">The secure coach-contact migration has not been detected. Apply the included Supabase migration before saving contacts.</Notice> : null}
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><UserRoundPlus size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-emerald-950">Team contacts now power Coach Hub and Communications</div>
          <div className="mt-1 text-xs font-semibold leading-5 text-emerald-800">Save the adult coach once, then invite them to their dedicated team calendar and request area without re-entering contact information.</div>
        </div>
        <button type="button" onClick={() => setSettingsTab?.("coachhub")} className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-black text-white">Open Coach Hub</button>
      </div>
      {!canAddTeam ? (
        <Notice tone="warning" className="mt-4">
          {subscription?.planName || "The current plan"} allows {teamLimit} teams. {overTeamLimit ? `Remove ${excessTeams} team${excessTeams === 1 ? "" : "s"} in this session and then save, or upgrade the workspace.` : "Remove a team or review Plan & subscription before adding another."}
        </Notice>
      ) : null}

      <div className="@container mt-4">
      <div className="grid min-w-0 gap-4 @4xl:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-[22px] border border-slate-200 bg-slate-50/80 p-3 @4xl:sticky @4xl:top-44 @4xl:max-h-[calc(100vh-12rem)] @4xl:self-start @4xl:overflow-hidden">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find team or coach" aria-label="Find a team or coach" />
          </div>
          <div className="mt-2.5 flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400"><span>{filteredTeams.length} shown</span><span>{teamCfg.length} total</span></div>
          <div className="mt-2 grid max-h-[320px] grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-1.5 overflow-y-auto pr-1 @4xl:block @4xl:max-h-[calc(100vh-18rem)] @4xl:space-y-1">
            {filteredTeams.map(({ team, index, contact, visibleContact }) => {
              const active = index === selectedIndex;
              const contactReady = Boolean(visibleContact?.coachName || visibleContact?.coachPhone || visibleContact?.coachEmail || hasContactData(contact));
              return (
                <button key={contact?.teamKey || `team-${index}`} type="button" onClick={() => setSelectedIndex(index)} className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-slate-950 bg-slate-950 text-white shadow-sm" : "border-transparent bg-white text-slate-800 hover:border-slate-200"}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-white/10 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>{contactReady ? <CheckCircle2 size={16} /> : <UsersRound size={16} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">{team.name || "Unnamed team"}</span>
                    <span className={`mt-0.5 block truncate text-[10px] font-bold ${active ? "text-slate-300" : "text-slate-400"}`}>{team.day || "Saturday"} · {team.format || "No format"} · {teamTypeLabel(team)}</span>
                  </span>
                  <ChevronRight size={15} className={active ? "text-slate-300" : "text-slate-400"} />
                </button>
              );
            })}
            {!filteredTeams.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">No teams match that search.</div> : null}
          </div>
        </aside>

        <div className="min-w-0">
          {selectedTeam && selectedContact ? (
            <article className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Team {selectedIndex + 1} of {teamCfg.length}</div>
                  <div className="mt-1 text-lg font-black text-slate-950">{selectedTeam.name || "Unnamed team"}</div>
                  <div className="mt-0.5 text-xs font-bold text-slate-400">{sites.find((site) => site.id === selectedHomeSiteId)?.name || primarySite?.name || "Main site"}</div>
                </div>
                <button type="button" onClick={() => removeTeam(selectedIndex)} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 transition hover:bg-rose-50"><Trash2 size={15} /> Remove</button>
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-x-4 gap-y-4">
                <Field label="Team name" className="col-span-full"><input className={inputClass} value={selectedTeam.name || ""} onChange={(event) => updateTeam(selectedIndex, "name", event.target.value)} /></Field>
                <Field label="External fixture names" hint="Comma-separated names used by Full-Time or other fixture providers." className="col-span-full"><input className={inputClass} value={Array.isArray(selectedTeam.externalAliases) ? selectedTeam.externalAliases.join(", ") : selectedTeam.externalAliases || ""} onChange={(event) => updateTeam(selectedIndex, "externalAliases", event.target.value)} placeholder="Horwich St. Mary's, Horwich St Mary's" /></Field>
                <Field label="Type"><select className={selectClass} value={classifyFallback(selectedTeam)} onChange={(event) => updateTeam(selectedIndex, "teamType", event.target.value)}>{TEAM_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                <Field label="Format"><select className={selectClass} value={selectedTeam.format || ""} onChange={(event) => updateTeam(selectedIndex, "format", event.target.value)}>{FORMATS.map((format) => <option key={format}>{format}</option>)}</select></Field>
                <Field label="Default day"><select className={selectClass} value={selectedTeam.day || "Saturday"} onChange={(event) => updateTeam(selectedIndex, "day", event.target.value)}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select></Field>
                <Field label="Minutes"><input type="number" min={20} max={120} step={5} className={inputClass} value={selectedTeam.gameMins ?? 70} onChange={(event) => updateTeam(selectedIndex, "gameMins", Number(event.target.value))} /></Field>
                <Field label="Home site"><select className={selectClass} value={selectedHomeSiteId || ""} onChange={(event) => updateTeam(selectedIndex, "siteId", event.target.value)}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}{site.isPrimary ? " ★" : ""}</option>)}</select></Field>
                <Field label="Default pitch"><select className={selectClass} value={selectedTeam.defaultPitch || ""} onChange={(event) => updateTeam(selectedIndex, "defaultPitch", event.target.value)}><option value="">Unassigned</option>{selectedPitchOptions.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label}</option>)}</select></Field>
                <Field label="Alternative pitch"><select className={selectClass} value={selectedTeam.altPitch || ""} onChange={(event) => updateTeam(selectedIndex, "altPitch", event.target.value)}><option value="">None</option>{selectedPitchOptions.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label}</option>)}</select></Field>
                <Field label="Scheduling order" hint="Lower numbers are considered first."><input type="number" min={1} className={inputClass} value={selectedTeam.ageOrder ?? selectedIndex + 1} onChange={(event) => updateTeam(selectedIndex, "ageOrder", Number(event.target.value))} /></Field>
              </div>

              <details key={selectedContact.teamKey || selectedIndex} className="mt-5 rounded-2xl border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden">
                  <span className="min-w-0">
                    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700"><ShieldCheck size={15} /> Protected coach contact</span>
                    <span className="mt-1 block truncate text-sm font-black text-slate-950">{selectedContactReady ? selectedContact.coachName || selectedContact.coachEmail || selectedContact.coachPhone || "Contact details added" : "No contact details added"}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${selectedContactReady ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{coachHubManagedPrimary ? "Coach Hub" : selectedContactReady ? "Configured" : "Open to add"}</span>
                </summary>

                <div className="border-t border-slate-200 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-3xl space-y-2">
                      <p className="text-xs font-semibold leading-5 text-slate-500">Enter the main adult contact and optional assistant here. This protected record powers Communications and Coach Hub invitations, so the club does not set the person up twice. Do not enter player or child contact information.</p>
                      <button type="button" onClick={() => setSettingsTab?.("coachhub")} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-800 transition hover:bg-violet-100"><UsersRound size={15} /> Assign more coaches, assistants or team roles</button>
                    </div>
                    {canManageContacts && selectedDirectContactReady ? <button type="button" onClick={() => clearContact(selectedIndex)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50">Remove Team-form contact data</button> : null}
                  </div>

                  {coachHubManagedPrimary ? <Notice tone="info" className="mt-4">The primary contact is assigned through Coach Hub and is shown here automatically. Edit the person or their team role in Coach Hub; assistant details can still be maintained below.</Notice> : null}

                  {canManageContacts ? (
                    <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-x-4 gap-y-4">
                      <Field label="Coach / manager name"><input disabled={coachHubManagedPrimary} className={inputClass} value={selectedContact.coachName} onChange={(event) => updateContact(selectedIndex, "coachName", event.target.value)} placeholder="Primary adult contact" /></Field>
                      <Field label="Mobile number"><input disabled={coachHubManagedPrimary} className={inputClass} value={selectedContact.coachPhone} onChange={(event) => updateContact(selectedIndex, "coachPhone", event.target.value)} placeholder="07xxx xxxxxx" inputMode="tel" /></Field>
                      <Field label="Email address"><input disabled={coachHubManagedPrimary} type="email" className={inputClass} value={selectedContact.coachEmail} onChange={(event) => updateContact(selectedIndex, "coachEmail", event.target.value)} placeholder="coach@club.org.uk" /></Field>
                      <Field label="Preferred channel"><select disabled={coachHubManagedPrimary} className={selectClass} value={selectedContact.preferredChannel} onChange={(event) => updateContact(selectedIndex, "preferredChannel", event.target.value)}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option></select></Field>
                      <Field label="Assistant coach name"><input className={inputClass} value={selectedContact.assistantName} onChange={(event) => updateContact(selectedIndex, "assistantName", event.target.value)} placeholder="Optional" /></Field>
                      <Field label="Assistant mobile"><input className={inputClass} value={selectedContact.assistantPhone} onChange={(event) => updateContact(selectedIndex, "assistantPhone", event.target.value)} placeholder="Optional" inputMode="tel" /></Field>
                      <Field label="Assistant email"><input type="email" className={inputClass} value={selectedContact.assistantEmail} onChange={(event) => updateContact(selectedIndex, "assistantEmail", event.target.value)} placeholder="Optional" /></Field>
                      <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700"><input type="checkbox" checked={selectedContact.assistantEnabled} onChange={(event) => updateContact(selectedIndex, "assistantEnabled", event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" /> Include assistant</label>
                      <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700"><input type="checkbox" checked={selectedContact.receiveMatchdayMessages} onChange={(event) => updateContact(selectedIndex, "receiveMatchdayMessages", event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" /> Receive messages</label>
                      <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700"><input type="checkbox" checked={Boolean(selectedContact.privacyNoticeProvidedAt)} onChange={(event) => updateContact(selectedIndex, "privacyNoticeProvidedAt", event.target.checked ? new Date().toISOString() : null)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" /> Privacy notice provided</label>
                    </div>
                  ) : <Notice tone="info" className="mt-4">Coach contact details are hidden because your role cannot manage club contacts.</Notice>}
                </div>
              </details>
            </article>
          ) : <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/70 p-10 text-center text-sm font-semibold text-slate-500">No teams configured. Add a team or import a CSV template.</div>}
        </div>
      </div>
      </div>
    </SettingsPanel>
  );
}
