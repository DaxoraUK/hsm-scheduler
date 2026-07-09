import React from "react";
import { CalendarDays, Clock3, PlugZap } from "lucide-react";
import PlanFeatureNotice from "../PlanFeatureNotice.jsx";
import { ENTITLEMENTS, hasEntitlement } from "../../lib/subscriptions/entitlements.js";
import {
  Field,
  Notice,
  SaveBar,
  SettingsPanel,
  SettingsSectionHeader,
  Toggle,
  inputClass,
  selectClass,
} from "./SettingsPrimitives.jsx";

const PLANNED_PROVIDERS = [
  ["TeamFeePay", "Payments, memberships and team records"],
  ["Pitchero", "Website, teams and fixture publishing"],
  ["Spond", "Events, attendance and communications"],
  ["Google Calendar", "Publishing club and team calendars"],
];

export default function IntegrationSettingsPanel({ club = {}, setClub, saveTab, savedTab, subscription, onOpenSubscription }) {
  const advancedIntegrationsEnabled = hasEntitlement(subscription, ENTITLEMENTS.ADVANCED_INTEGRATIONS);
  const integrations = club.integrations || {};
  const fullTime = integrations.fullTimeFa || {};

  const updateFullTime = (patch) => {
    setClub((current) => ({
      ...current,
      integrations: {
        ...(current.integrations || {}),
        fullTimeFa: { ...((current.integrations || {}).fullTimeFa || {}), ...patch },
      },
    }));
  };

  return (
    <div className="space-y-5">
      <SettingsPanel>
        <SettingsSectionHeader
          icon={PlugZap}
          eyebrow="Available connection"
          title="Full-Time FA fixture source"
          description="Configure the fixture source the club can actually use today. Credentials and service keys should be environment-managed, not entered by ordinary club users."
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Field label="Fixture source URL" hint="Use the club or team fixture page from Full-Time FA.">
              <input className={inputClass} value={fullTime.sourceUrl || ""} onChange={(event) => updateFullTime({ sourceUrl: event.target.value })} placeholder="https://fulltime.thefa.com/..." />
            </Field>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Club ID">
                <input className={inputClass} value={fullTime.clubId || ""} onChange={(event) => updateFullTime({ clubId: event.target.value })} placeholder="Optional Full-Time club ID" />
              </Field>
              <Field label="Import mode">
                <select className={selectClass} value={fullTime.mode || "import"} onChange={(event) => updateFullTime({ mode: event.target.value })}>
                  <option value="import">Import fixtures</option>
                  <option value="manual">Manual preparation</option>
                </select>
              </Field>
            </div>
          </div>

          <Toggle
            checked={!!fullTime.enabled}
            onChange={(enabled) => updateFullTime({ enabled })}
            label="Enable Full-Time FA"
            description="Makes this provider available to fixture import workflows."
          />
        </div>

        <Notice tone="warning" className="mt-5">
          This screen stores the club’s fixture-source configuration. A source should only be marked connected after the live import has been verified against the club’s own fixtures.
        </Notice>

        <SaveBar onSave={() => saveTab?.("integrations", { club })} saved={savedTab === "integrations"} label="Save fixture source">
          Ground Control will keep unavailable providers out of the active setup flow.
        </SaveBar>
      </SettingsPanel>

      {advancedIntegrationsEnabled ? (
        <SettingsPanel>
          <SettingsSectionHeader
            icon={Clock3}
            eyebrow="Product roadmap"
            title="Planned integrations"
            description="These providers are shown for transparency only. There are no fake toggles or unused credential fields."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {PLANNED_PROVIDERS.map(([name, description]) => (
              <div key={name} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm"><CalendarDays size={19} /></span>
                  <span className="rounded-full bg-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">Planned</span>
                </div>
                <h3 className="mt-4 text-base font-black text-slate-950">{name}</h3>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </SettingsPanel>
      ) : (
        <PlanFeatureNotice
          entitlement={ENTITLEMENTS.ADVANCED_INTEGRATIONS}
          subscription={subscription}
          title="Advanced provider integrations are hidden"
          description="Full-Time FA remains available as the standard fixture source. TeamFeePay, Pitchero, Spond and calendar integration workspaces are available from Pro."
          onOpenSubscription={onOpenSubscription}
        />
      )}
    </div>
  );
}
