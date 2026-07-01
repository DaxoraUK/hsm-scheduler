import React, { useMemo } from "react";
import { ArrowRight, CheckCircle2, Link2, PlugZap, RadioTower, ShieldCheck } from "lucide-react";
import StatusChip from "../ui/StatusChip.jsx";
import {
  calculateIntegrationReadiness,
  getIntegrationProviders,
  getIntegrationRoadmap,
} from "../../lib/engines/integrationEngine.js";

function ProviderCard({ provider }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
            <PlugZap size={22} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-black text-slate-950">{provider.name}</div>
            <div className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-slate-400">{provider.category}</div>
          </div>
        </div>
        <StatusChip variant={provider.statusMeta?.tone}>{provider.statusMeta?.label}</StatusChip>
      </div>

      <p className="mt-4 min-h-[48px] text-sm font-bold leading-6 text-slate-500">{provider.description}</p>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          <span>Readiness</span>
          <span>{provider.readiness}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-slate-950" style={{ width: `${provider.readiness}%` }} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(provider.capabilities || []).map((capability) => (
          <span key={capability} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
            {capability}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function IntegrationHubCard() {
  const providers = useMemo(() => getIntegrationProviders(), []);
  const readiness = useMemo(() => calculateIntegrationReadiness(providers), [providers]);
  const roadmap = useMemo(() => getIntegrationRoadmap(providers), [providers]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <RadioTower size={28} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Integration Engine</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Integration Hub Foundations</h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">{readiness.summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusChip variant={readiness.status}>{readiness.label}</StatusChip>
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">{readiness.score}% ready</div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Foundation</div>
            <div className="mt-2 text-3xl font-black text-emerald-950">{readiness.foundation}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Planned</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{readiness.planned}</div>
          </div>
          <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">Providers</div>
            <div className="mt-2 text-3xl font-black text-sky-950">{providers.length}</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Next actions</div>
            <div className="mt-2 text-3xl font-black text-amber-950">{roadmap.length}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <ShieldCheck size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Build Order</div>
            <h3 className="text-xl font-black text-slate-950">Recommended integration tasks</h3>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {roadmap.slice(0, 8).map((item, index) => (
            <div key={`${item.providerId}-${item.action}`} className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">{index + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-slate-950">{item.providerName}</div>
                <div className="mt-1 text-sm font-bold text-slate-500">{item.action}</div>
              </div>
              <ArrowRight className="shrink-0 text-slate-400" size={18} strokeWidth={2.5} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-sky-200 bg-sky-50 p-6 text-sky-900 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700 ring-1 ring-sky-200">
            <Link2 size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-lg font-black">No live API calls yet</h3>
            <p className="mt-2 text-sm font-bold leading-6 text-sky-800">
              This phase deliberately creates the provider model, readiness scoring and build queue first. Actual API credentials, sync jobs and provider-specific calls come later once the data contracts are stable.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
