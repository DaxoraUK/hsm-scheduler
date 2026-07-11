import React, { useEffect, useMemo, useState } from "react";
import { Download, Eraser, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DB } from "../../lib/supabase.js";
import { alignTeamContacts } from "../../lib/communications/contactModel.js";
import {
  COMMUNICATION_LAWFUL_BASES,
  DPIA_STATUSES,
  communicationPrivacyGaps,
  normaliseCommunicationPrivacy,
} from "../../lib/communications/privacyModel.js";
import {
  Field,
  Notice,
  PrimaryButton,
  SecondaryButton,
  SettingsPanel,
  SettingsSectionHeader,
  StatTile,
  inputClass,
  selectClass,
} from "./SettingsPrimitives.jsx";

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function CommunicationsPrivacyPanel({
  activeClubId,
  club = {},
  teamCfg = [],
  teamContacts = [],
  communicationPrivacy = {},
  setCommunicationPrivacy,
  workspaceAccess,
  communicationSchemaReady = false,
}) {
  const [draft, setDraft] = useState(() => normaliseCommunicationPrivacy({
    controllerName: club.name,
    privacyContactEmail: club.privacyEmail || club.email || "",
    ...communicationPrivacy,
  }));
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [purging, setPurging] = useState(false);
  const contacts = useMemo(() => alignTeamContacts(teamCfg, teamContacts), [teamCfg, teamContacts]);
  const gaps = communicationPrivacyGaps(draft);
  const canManage = Boolean(workspaceAccess?.canManageSettings);

  useEffect(() => {
    setDraft(normaliseCommunicationPrivacy({
      controllerName: club.name,
      privacyContactEmail: club.privacyEmail || club.email || "",
      ...communicationPrivacy,
    }));
  }, [club.email, club.name, club.privacyEmail, communicationPrivacy]);

  const update = (field, value) => setDraft((current) => normaliseCommunicationPrivacy({ ...current, [field]: value }));

  const save = async () => {
    if (!canManage || !activeClubId) return;
    if (!communicationSchemaReady) {
      toast.error("Secure communications migration required");
      return;
    }
    setSaving(true);
    try {
      const saved = normaliseCommunicationPrivacy(await DB.saveCommunicationPrivacy(activeClubId, draft));
      setDraft(saved);
      setCommunicationPrivacy?.(saved);
      toast.success("Privacy settings saved");
    } catch (error) {
      toast.error("Privacy settings were not saved", { description: error?.message });
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    if (!canManage || !activeClubId) return;
    setExporting(true);
    try {
      const [privacy, remoteContacts, events, deliveryData] = await Promise.all([
        DB.getCommunicationPrivacy(activeClubId),
        DB.loadTeamContacts(activeClubId),
        DB.listCommunicationEvents(activeClubId, 200),
        DB.exportCommunicationDeliveryData(activeClubId).catch(() => ({ batches: [], deliveries: [] })),
      ]);
      downloadJson(`ground-control-communications-data-${new Date().toISOString().slice(0, 10)}.json`, {
        exportedAt: new Date().toISOString(),
        club: { id: activeClubId, name: club.name || "Club" },
        purpose: "Data access and accountability export for adult coach operational communications.",
        privacy: normaliseCommunicationPrivacy(privacy),
        contacts: remoteContacts,
        communicationEvents: events,
        deliveryBatches: deliveryData.batches || [],
        deliveries: deliveryData.deliveries || [],
      });
      toast.success("Communications data exported");
    } catch (error) {
      toast.error("Data export failed", { description: error?.message });
    } finally {
      setExporting(false);
    }
  };

  const purgeExpired = async () => {
    if (!canManage || !activeClubId) return;
    setPurging(true);
    try {
      const [eventCount, deliveryCount] = await Promise.all([
        DB.purgeExpiredCommunicationEvents(activeClubId),
        DB.purgeExpiredCommunicationDeliveryData(activeClubId).catch(() => 0),
      ]);
      toast.success("Retention applied", { description: `${Number(eventCount) || 0} expired event records and ${Number(deliveryCount) || 0} delivery records removed.` });
    } catch (error) {
      toast.error("Retention cleanup failed", { description: error?.message });
    } finally {
      setPurging(false);
    }
  };

  return (
    <SettingsPanel>
      <SettingsSectionHeader
        icon={ShieldCheck}
        eyebrow="Data protection"
        title="Coach communications privacy"
        description="Document the club's purpose, lawful basis, privacy information and retention rule for adult coach contact data."
      />

      {!communicationSchemaReady ? (
        <Notice tone="warning" className="mt-5">Apply the included Supabase migration before using coach contacts or the shared communications audit trail.</Notice>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Contact records" value={contacts.filter((item) => item.coachPhone || item.coachEmail || item.assistantPhone || item.assistantEmail).length} detail="Adult team contacts" tone="green" />
        <StatTile label="Privacy notices" value={contacts.filter((item) => item.privacyNoticeProvidedAt).length} detail="Recorded as provided" tone="blue" />
        <StatTile label="Retention" value={`${draft.retentionDays} days`} detail="Audit and provider delivery history" tone="violet" />
        <StatTile label="Setup gaps" value={gaps.length} detail={gaps.length ? gaps.slice(0, 2).join(" · ") : "Required fields complete"} tone={gaps.length ? "rose" : "slate"} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Field label="Data controller name" hint="Usually the club or organisation deciding why the coach data is used.">
          <input className={inputClass} value={draft.controllerName} onChange={(event) => update("controllerName", event.target.value)} disabled={!canManage} />
        </Field>
        <Field label="Privacy contact email">
          <input type="email" className={inputClass} value={draft.privacyContactEmail} onChange={(event) => update("privacyContactEmail", event.target.value)} disabled={!canManage} placeholder="privacy@club.org.uk" />
        </Field>
        <Field label="Lawful basis" hint="The club must choose and document the basis that actually applies.">
          <select className={selectClass} value={draft.lawfulBasis} onChange={(event) => update("lawfulBasis", event.target.value)} disabled={!canManage}>
            <option value="">Select a lawful basis</option>
            {COMMUNICATION_LAWFUL_BASES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="DPIA status" hint="Record the screening outcome; a full DPIA is required where processing is likely to be high risk.">
          <select className={selectClass} value={draft.dpiaStatus} onChange={(event) => update("dpiaStatus", event.target.value)} disabled={!canManage}>
            {DPIA_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Privacy notice URL" className="lg:col-span-2">
          <input type="url" className={inputClass} value={draft.privacyNoticeUrl} onChange={(event) => update("privacyNoticeUrl", event.target.value)} disabled={!canManage} placeholder="https://club.example/privacy" />
        </Field>
        <Field label="Specific purpose" className="lg:col-span-2" hint="Do not broaden this into marketing or unrelated contact use.">
          <textarea className={`${inputClass} min-h-28 py-3`} value={draft.purpose} onChange={(event) => update("purpose", event.target.value)} disabled={!canManage} />
        </Field>
        <Field label="Audit retention (days)" hint="Minimum 30 days; review whether the selected period is necessary.">
          <input type="number" min={30} max={2555} className={inputClass} value={draft.retentionDays} onChange={(event) => update("retentionDays", Number(event.target.value))} disabled={!canManage} />
        </Field>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
          <strong className="text-slate-900">Data boundary:</strong> only adult coach and assistant contact details belong in this feature. Player or child contact data must not be entered.
        </div>
      </div>

      {gaps.length ? (
        <Notice tone="warning" className="mt-5">Complete before bulk message preparation: {gaps.join(" · ")}.</Notice>
      ) : (
        <Notice tone="success" className="mt-5">Required privacy setup fields are complete. This records configuration; it does not replace the club's own legal review or published privacy information.</Notice>
      )}

      <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
        <PrimaryButton icon={Save} onClick={save} disabled={!canManage || saving || !communicationSchemaReady}>{saving ? "Saving…" : "Save privacy settings"}</PrimaryButton>
        <SecondaryButton icon={Download} onClick={exportData} disabled={!canManage || exporting || !communicationSchemaReady}>{exporting ? "Exporting…" : "Export contact and audit data"}</SecondaryButton>
        <SecondaryButton icon={Eraser} onClick={purgeExpired} disabled={!canManage || purging || !communicationSchemaReady}>{purging ? "Applying…" : "Apply retention now"}</SecondaryButton>
        <SecondaryButton icon={RefreshCw} onClick={() => setDraft(normaliseCommunicationPrivacy(communicationPrivacy))}>Reset unsaved changes</SecondaryButton>
      </div>
    </SettingsPanel>
  );
}
