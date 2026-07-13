import React, { useMemo } from "react";
import { Building2, ClipboardCheck, ShieldCheck, UsersRound } from "lucide-react";
import {
  Field,
  Notice,
  SaveBar,
  SettingsPanel,
  SettingsSectionHeader,
  StatTile,
  inputClass,
  selectClass,
} from "./SettingsPrimitives.jsx";

function getSites(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites : [];
  if (sites.length) {
    return sites.map((site, index) => ({
      id: site.id || `site-${index + 1}`,
      name: site.name || site.venue || `Site ${index + 1}`,
      isPrimary: Boolean(site.isPrimary) || site.id === club.primarySiteId || (!club.primarySiteId && index === 0),
    }));
  }
  return [{ id: club.primarySiteId || "main-ground", name: club.venue || "Main Ground", isPrimary: true }];
}

function getGovernance(club = {}) {
  const current = club.eliteGovernance && typeof club.eliteGovernance === "object"
    ? club.eliteGovernance
    : {};
  return {
    executiveSponsorName: current.executiveSponsorName || "",
    executiveSponsorTitle: current.executiveSponsorTitle || "",
    reportingCadence: current.reportingCadence || "monthly",
    riskReviewCadence: current.riskReviewCadence || "weekly",
    boardPackTitle: current.boardPackTitle || "Organisation operations and impact report",
    siteLeads: current.siteLeads && typeof current.siteLeads === "object" ? current.siteLeads : {},
  };
}

export default function EliteGovernanceSettingsPanel({ club = {}, setClub, saveTab, savedTab }) {
  const governance = getGovernance(club);
  const sites = useMemo(() => getSites(club), [club]);
  const leadCount = sites.filter((site) => governance.siteLeads?.[site.id]?.name?.trim()).length;
  const completedControls = [
    Boolean(governance.executiveSponsorName.trim()),
    Boolean(governance.executiveSponsorTitle.trim()),
    leadCount === sites.length,
    Boolean(governance.reportingCadence),
  ].filter(Boolean).length;

  const updateGovernance = (patch) => {
    setClub((current) => ({
      ...current,
      eliteGovernance: {
        ...getGovernance(current),
        ...patch,
      },
    }));
  };

  const updateSiteLead = (siteId, field, value) => {
    updateGovernance({
      siteLeads: {
        ...governance.siteLeads,
        [siteId]: {
          ...(governance.siteLeads?.[siteId] || {}),
          [field]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-5">
      <SettingsPanel>
        <SettingsSectionHeader
          icon={ShieldCheck}
          eyebrow="Elite governance"
          title="Organisation accountability"
          description="Define the senior owner, reporting rhythm and site-level responsibility used by Organisation Command."
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Controls complete" value={`${completedControls}/4`} detail="Current governance setup" tone={completedControls === 4 ? "green" : "amber"} />
          <StatTile label="Sites covered" value={`${leadCount}/${sites.length}`} detail="Named accountable leads" tone={leadCount === sites.length ? "green" : "amber"} />
          <StatTile label="Board reporting" value={governance.reportingCadence} detail="Executive pack cadence" tone="blue" />
          <StatTile label="Risk review" value={governance.riskReviewCadence} detail="Operational review rhythm" tone="violet" />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Executive sponsor name" hint="The senior person accountable for organisation-wide operational oversight.">
            <input className={inputClass} value={governance.executiveSponsorName} onChange={(event) => updateGovernance({ executiveSponsorName: event.target.value })} placeholder="e.g. Club Chair" />
          </Field>
          <Field label="Executive sponsor title">
            <input className={inputClass} value={governance.executiveSponsorTitle} onChange={(event) => updateGovernance({ executiveSponsorTitle: event.target.value })} placeholder="e.g. Chair of Trustees" />
          </Field>
          <Field label="Board reporting cadence">
            <select className={selectClass} value={governance.reportingCadence} onChange={(event) => updateGovernance({ reportingCadence: event.target.value })}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biannual">Twice yearly</option>
            </select>
          </Field>
          <Field label="Operational risk review">
            <select className={selectClass} value={governance.riskReviewCadence} onChange={(event) => updateGovernance({ riskReviewCadence: event.target.value })}>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          <Field label="Board pack title" className="md:col-span-2">
            <input className={inputClass} value={governance.boardPackTitle} onChange={(event) => updateGovernance({ boardPackTitle: event.target.value })} />
          </Field>
        </div>

        <Notice tone="neutral" className="mt-5">
          These settings describe accountability and reporting. They do not grant permissions; workspace roles remain the security authority.
        </Notice>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSectionHeader
          icon={Building2}
          eyebrow="Delegated control"
          title="Site leads"
          description="Assign a named accountable lead to every venue so senior users can see where operational ownership is missing."
        />

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {sites.map((site) => {
            const lead = governance.siteLeads?.[site.id] || {};
            return (
              <article key={site.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-emerald-300"><UsersRound size={18} /></span>
                  <div>
                    <h3 className="text-base font-black text-slate-950">{site.name}</h3>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">{site.isPrimary ? "Primary site" : "Organisation site"}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Accountable lead">
                    <input className={inputClass} value={lead.name || ""} onChange={(event) => updateSiteLead(site.id, "name", event.target.value)} placeholder="Full name" />
                  </Field>
                  <Field label="Role / responsibility">
                    <input className={inputClass} value={lead.role || ""} onChange={(event) => updateSiteLead(site.id, "role", event.target.value)} placeholder="e.g. Site Operations Lead" />
                  </Field>
                </div>
              </article>
            );
          })}
        </div>

        <SaveBar onSave={() => saveTab?.("governance", { club })} saved={savedTab === "governance"} label="Save organisation governance" sticky>
          <ClipboardCheck size={16} /> Saves executive accountability and site-lead coverage to the secure club workspace.
        </SaveBar>
      </SettingsPanel>
    </div>
  );
}
