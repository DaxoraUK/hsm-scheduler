import React from "react";
import { ClipboardCheck, ShieldCheck, Workflow } from "lucide-react";
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
  };
}

export default function EliteGovernanceSettingsPanel({ club = {}, setClub, saveTab, savedTab, setMainPage }) {
  const governance = getGovernance(club);
  const completedControls = [
    Boolean(governance.executiveSponsorName.trim()),
    Boolean(governance.executiveSponsorTitle.trim()),
    Boolean(governance.reportingCadence),
    Boolean(governance.riskReviewCadence),
  ].filter(Boolean).length;

  const updateGovernance = (patch) => {
    setClub((current) => ({
      ...current,
      eliteGovernance: {
        ...(current.eliteGovernance && typeof current.eliteGovernance === "object" ? current.eliteGovernance : {}),
        ...patch,
      },
    }));
  };

  return (
    <div className="space-y-5">
      <SettingsPanel>
        <SettingsSectionHeader
          icon={ShieldCheck}
          eyebrow="Elite governance"
          title="Organisation accountability"
          description="Define the senior owner and reporting rhythm used by Organisation Command and governed executive packs."
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Controls complete" value={`${completedControls}/4`} detail="Current governance setup" tone={completedControls === 4 ? "green" : "amber"} />
          <StatTile label="Executive sponsor" value={governance.executiveSponsorName || "Not set"} detail={governance.executiveSponsorTitle || "Senior accountability"} tone={governance.executiveSponsorName ? "green" : "amber"} />
          <StatTile label="Board reporting" value={governance.reportingCadence} detail="Executive pack cadence" tone="blue" />
          <StatTile label="Risk review" value={governance.riskReviewCadence} detail="Operational review rhythm" tone="violet" />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Executive sponsor name" hint="The senior person accountable for organisation-wide operational oversight.">
            <input className={inputClass} value={governance.executiveSponsorName} onChange={(event) => updateGovernance({ executiveSponsorName: event.target.value })} placeholder="e.g. Alex Morgan" />
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
          Site leads, site administrators and reviewers are assigned once in Organisation Command → Governance & approvals. This page no longer keeps a second free-text responsibility list.
        </Notice>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => setMainPage?.("executive")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
            <Workflow size={15} /> Open responsibility map
          </button>
        </div>

        <SaveBar onSave={() => saveTab?.("governance", { club })} saved={savedTab === "governance"} label="Save organisation governance" sticky>
          <ClipboardCheck size={16} /> Saves executive accountability and reporting controls to the secure club workspace.
        </SaveBar>
      </SettingsPanel>
    </div>
  );
}
