import React from "react";
import { Building2, Mail, Phone, UserRound } from "lucide-react";
import {
  Field,
  Notice,
  SaveBar,
  SettingsPanel,
  SettingsSectionHeader,
  inputClass,
  selectClass,
} from "./SettingsPrimitives.jsx";

const SPORTS = ["Football", "Rugby Union", "Rugby League", "Cricket", "Hockey", "Netball", "Other"];

export default function ClubSettingsPanel({ club = {}, setClub, saveTab, savedTab }) {
  const update = (field, value) => setClub((current) => ({ ...current, [field]: value }));

  return (
    <div className="space-y-5">
      <SettingsPanel>
        <SettingsSectionHeader
          icon={Building2}
          eyebrow="Organisation"
          title="Club profile"
          description="The core details used in workspace headings, reports, communications and account administration. Venue and parking details are managed separately."
        />

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Club or organisation name">
            <input className={inputClass} value={club.name || ""} onChange={(event) => update("name", event.target.value)} placeholder="Club name" />
          </Field>

          <Field label="Primary sport">
            <select className={selectClass} value={club.sport || "Football"} onChange={(event) => update("sport", event.target.value)}>
              {SPORTS.map((sport) => <option key={sport}>{sport}</option>)}
            </select>
          </Field>

          <Field label="County / region" hint="Useful for future league, funding and governing-body matching.">
            <input className={inputClass} value={club.region || club.county || ""} onChange={(event) => update("region", event.target.value)} placeholder="e.g. Greater Manchester" />
          </Field>

          <Field label="County FA / governing body">
            <input className={inputClass} value={club.governingBody || ""} onChange={(event) => update("governingBody", event.target.value)} placeholder="e.g. Lancashire FA" />
          </Field>
        </div>

        <SaveBar onSave={() => saveTab?.("club", { club })} saved={savedTab === "club"} label="Save club profile">
          Changes update the shared club profile used across Ground Control.
        </SaveBar>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSectionHeader
          icon={UserRound}
          eyebrow="Administration"
          title="Primary club contact"
          description="A clear operational contact helps with onboarding, account support and future service notifications."
        />

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Contact name">
            <div className="relative">
              <UserRound size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />
              <input className={`${inputClass} pl-10`} value={club.contactName || ""} onChange={(event) => update("contactName", event.target.value)} placeholder="Primary contact" />
            </div>
          </Field>

          <Field label="Contact role">
            <input className={inputClass} value={club.contactRole || ""} onChange={(event) => update("contactRole", event.target.value)} placeholder="e.g. Club Secretary" />
          </Field>

          <Field label="Email address">
            <div className="relative">
              <Mail size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />
              <input type="email" className={`${inputClass} pl-10`} value={club.contactEmail || ""} onChange={(event) => update("contactEmail", event.target.value)} placeholder="name@club.org.uk" />
            </div>
          </Field>

          <Field label="Phone number">
            <div className="relative">
              <Phone size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />
              <input className={`${inputClass} pl-10`} value={club.contactPhone || ""} onChange={(event) => update("contactPhone", event.target.value)} placeholder="07xxx xxxxxx" />
            </div>
          </Field>
        </div>

        <Notice tone="neutral">
          Ground Control now uses one fixed product identity. Legacy colour pickers, logo uploads and preview controls have been removed from club settings.
        </Notice>

        <SaveBar onSave={() => saveTab?.("club", { club })} saved={savedTab === "club"} label="Save contact details">
          Contact details are stored with the shared club profile.
        </SaveBar>
      </SettingsPanel>
    </div>
  );
}
