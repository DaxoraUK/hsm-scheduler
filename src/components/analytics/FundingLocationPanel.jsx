import React, { useMemo, useState } from "react";
import { Building2, CheckCircle2, ExternalLink, Loader2, MapPin, RefreshCw, Save, Search, ShieldCheck } from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import ProgressBar from "../../ui/ProgressBar.jsx";
import StatusChip from "../../ui/StatusChip.jsx";
import { buildLocalFundingDiscovery, buildFundingLocationProfile } from "../../lib/grants/localFundingDiscovery.js";
import { resolveFundingPostcode } from "../../lib/grants/postcodeService.js";

const INPUT_CLASS = "mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export default function FundingLocationPanel({ profile, projectType, canManage, saving, onSave }) {
  const [draft, setDraft] = useState(() => buildFundingLocationProfile(profile));
  const [resolving, setResolving] = useState(false);
  const discovery = useMemo(() => buildLocalFundingDiscovery({ profile: draft, projectType }), [draft, projectType]);
  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const resolvePostcode = async () => {
    setResolving(true);
    try {
      const resolved = await resolveFundingPostcode(draft.facilityPostcode || draft.postcode);
      setDraft((current) => ({
        ...current,
        postcode: current.postcode || resolved.postcode,
        facilityPostcode: resolved.postcode,
        homeNation: resolved.homeNation,
        country: resolved.country,
        region: resolved.region,
        localAuthority: resolved.localAuthority,
        adminCounty: resolved.adminCounty,
        parliamentaryConstituency: resolved.parliamentaryConstituency,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        postcodeResolvedAt: resolved.resolvedAt,
        postcodeSource: resolved.source,
      }));
      toast.success("Location resolved", { description: `${resolved.localAuthority || resolved.region || resolved.country} has been added to the funding profile.` });
    } catch (error) {
      toast.error("Postcode could not be resolved", { description: error?.message || "Check the postcode and try again." });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Club funding profile</div>
            <h3 className="mt-1 text-xl font-black text-slate-950">Resolve the club's local funding area</h3>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">The postcode identifies the home nation, region and local authority. County FA and organisation details still need club confirmation.</p>
          </div>
          <div className="w-full max-w-64 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Profile completeness</span><span className="text-lg font-black text-slate-950">{discovery.profileScore}%</span></div>
            <ProgressBar value={discovery.profileScore} tone={discovery.profileScore >= 80 ? "success" : discovery.profileScore >= 50 ? "warning" : "danger"} className="mt-3" />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Club postcode"><input className={INPUT_CLASS} value={draft.postcode} onChange={(event) => setField("postcode", event.target.value.toUpperCase())} placeholder="BL6 7QE" disabled={!canManage} /></Field>
          <Field label="Facility postcode" hint="Use the site postcode where the funded work will happen."><input className={INPUT_CLASS} value={draft.facilityPostcode} onChange={(event) => setField("facilityPostcode", event.target.value.toUpperCase())} placeholder="BL6 7QE" disabled={!canManage} /></Field>
          <Field label="Home nation"><select className={INPUT_CLASS} value={draft.homeNation} onChange={(event) => setField("homeNation", event.target.value)} disabled={!canManage}><option value="">Choose</option><option value="england">England</option><option value="scotland">Scotland</option><option value="wales">Wales</option><option value="northern-ireland">Northern Ireland</option></select></Field>
          <div className="flex items-end"><button type="button" onClick={resolvePostcode} disabled={!canManage || resolving || !(draft.facilityPostcode || draft.postcode)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700 disabled:opacity-45">{resolving ? <Loader2 size={17} className="animate-spin" /> : <MapPin size={17} />} Resolve postcode</button></div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Region"><input className={INPUT_CLASS} value={draft.region} onChange={(event) => setField("region", event.target.value)} placeholder="North West" disabled={!canManage} /></Field>
          <Field label="Local authority"><input className={INPUT_CLASS} value={draft.localAuthority} onChange={(event) => setField("localAuthority", event.target.value)} placeholder="Bolton" disabled={!canManage} /></Field>
          <Field label="Administrative county"><input className={INPUT_CLASS} value={draft.adminCounty} onChange={(event) => setField("adminCounty", event.target.value)} placeholder="Greater Manchester" disabled={!canManage} /></Field>
          <Field label="County FA" hint="Required for England-specific local football support."><input className={INPUT_CLASS} value={draft.countyFa} onChange={(event) => setField("countyFa", event.target.value)} placeholder="Lancashire FA" disabled={!canManage} /></Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Legal structure"><input className={INPUT_CLASS} value={draft.legalStructure} onChange={(event) => setField("legalStructure", event.target.value)} placeholder="Constituted club / charity / CASC / CIC" disabled={!canManage} /></Field>
          <Field label="Affiliation"><input className={INPUT_CLASS} value={draft.affiliation} onChange={(event) => setField("affiliation", event.target.value)} placeholder="County FA affiliation" disabled={!canManage} /></Field>
          <Field label="Facility tenure"><input className={INPUT_CLASS} value={draft.tenure} onChange={(event) => setField("tenure", event.target.value)} placeholder="Owned / lease to 2041 / licence" disabled={!canManage} /></Field>
          <Field label="Annual income band"><select className={INPUT_CLASS} value={draft.annualIncomeBand} onChange={(event) => setField("annualIncomeBand", event.target.value)} disabled={!canManage}><option value="">Not recorded</option><option value="under-10k">Under £10,000</option><option value="10k-50k">£10,000–£50,000</option><option value="50k-100k">£50,000–£100,000</option><option value="100k-250k">£100,000–£250,000</option><option value="250k-plus">£250,000+</option></select></Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Charity number"><input className={INPUT_CLASS} value={draft.charityNumber} onChange={(event) => setField("charityNumber", event.target.value)} placeholder="Optional" disabled={!canManage} /></Field>
          <Field label="CASC number"><input className={INPUT_CLASS} value={draft.cascNumber} onChange={(event) => setField("cascNumber", event.target.value)} placeholder="Optional" disabled={!canManage} /></Field>
          <Field label="Company or CIC number"><input className={INPUT_CLASS} value={draft.companyNumber} onChange={(event) => setField("companyNumber", event.target.value)} placeholder="Optional" disabled={!canManage} /></Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold leading-5 text-slate-500">{draft.postcodeResolvedAt ? `Postcode resolved ${new Date(draft.postcodeResolvedAt).toLocaleDateString("en-GB")} via ${draft.postcodeSource || "postcode data"}.` : "Resolve the postcode, confirm the remaining fields, then save the profile."}</div>
          <button type="button" onClick={() => onSave?.(draft)} disabled={!canManage || saving} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-45">{saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Save funding profile</button>
        </div>
      </section>

      {discovery.gaps.length ? (
        <section className="rounded-[26px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3"><RefreshCw size={20} className="mt-1 shrink-0 text-amber-700" /><div><h3 className="text-lg font-black text-amber-950">{discovery.gaps.length} profile item{discovery.gaps.length === 1 ? "" : "s"} still limit local matching</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{discovery.gaps.map((gap) => <div key={gap.key} className="rounded-2xl bg-white/70 p-4 ring-1 ring-amber-200"><div className="text-sm font-black text-amber-950">{gap.label}</div><div className="mt-1 text-sm font-semibold leading-6 text-amber-900">{gap.action}</div></div>)}</div></div></div>
        </section>
      ) : (
        <section className="flex items-start gap-3 rounded-[26px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"><CheckCircle2 size={21} className="mt-0.5 shrink-0 text-emerald-700" /><div><h3 className="font-black">Local discovery profile complete</h3><p className="mt-1 text-sm font-semibold leading-6">The key geographic and organisation fields are available for place-based funding checks.</p></div></section>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4 px-1">
          <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Official discovery routes</div><h3 className="mt-1 text-xl font-black text-slate-950">Where to check for local funding</h3><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">Ground Control uses the profile to prioritise the official directories and local bodies most relevant to the club.</p></div>
          <StatusChip status={discovery.readyForLocalSearch ? "success" : "warning"}>{discovery.readyForLocalSearch ? "Location ready" : "Complete location"}</StatusChip>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {discovery.sources.map((entry) => (
            <article key={entry.id} className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">{entry.id.includes("county-fa") ? <ShieldCheck size={20} /> : entry.id.includes("council") ? <Building2 size={20} /> : <Search size={20} />}</div><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{entry.organisation}</div><h4 className="mt-1 text-lg font-black text-slate-950">{entry.title}</h4></div></div><StatusChip status="info" size="sm">{entry.access}</StatusChip></div>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{entry.description}</p>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 ring-1 ring-slate-200"><strong>{entry.locationLabel}:</strong> {entry.reason}</div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="text-xs font-bold text-slate-500">{entry.scope}</span><a href={entry.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-black text-white transition hover:bg-slate-800">Open official source <ExternalLink size={14} /></a></div>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-950">{discovery.disclaimer}</div>
      </section>
    </div>
  );
}
