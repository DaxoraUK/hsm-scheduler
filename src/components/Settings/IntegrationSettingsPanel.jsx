import React from "react";
import { PlugZap } from "lucide-react";
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

export default function IntegrationSettingsPanel({ club = {}, setClub, saveTab, savedTab }) {
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
    <SettingsPanel>
      <SettingsSectionHeader
        icon={PlugZap}
        eyebrow="Fixture connection"
        title="Full-Time FA fixture source"
        description="Configure the fixture source the club can use today. Ground Control only shows connections that have a working customer workflow."
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
        Mark this source as enabled only after a live import has been checked against the club’s own fixture list.
      </Notice>

      <SaveBar onSave={() => saveTab?.("integrations", { club })} saved={savedTab === "integrations"} label="Save fixture source">
        Additional providers will only appear after their full connection and publishing workflows are ready.
      </SaveBar>
    </SettingsPanel>
  );
}
