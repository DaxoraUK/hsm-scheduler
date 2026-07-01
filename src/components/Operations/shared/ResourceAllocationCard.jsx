import React from "react";
import { AlertTriangle, Car, CheckCircle2, MapPinned, ShieldCheck, UsersRound } from "lucide-react";
import StatusChip from "../../ui/StatusChip.jsx";

const toneClasses = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

function ToneTile({ icon: Icon, label, value, tone = "neutral" }) {
  return (
    <div className={`rounded-3xl border p-5 ${toneClasses[tone] || toneClasses.neutral}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-inset ring-black/5">
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">{label}</div>
          <div className="mt-1 text-xl font-black leading-none">{value}</div>
        </div>
      </div>
    </div>
  );
}

function ResourceBadge({ item }) {
  const tone = item?.status === "success" ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : item?.status === "danger" ? "bg-red-50 text-red-800 ring-red-100" : "bg-amber-50 text-amber-800 ring-amber-100";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1 ${tone}`}>
      {item?.label || "Missing"}
    </span>
  );
}

export default function ResourceAllocationCard({ allocation }) {
  const issues = allocation?.issues || [];
  const fixtures = allocation?.allocations || [];
  const siteParking = allocation?.siteParking || [];
  const status = allocation?.status || "neutral";

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <ShieldCheck size={26} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Resource Intelligence</div>
              <h3 className="mt-1 text-2xl font-black text-slate-950">{allocation?.label || "Resource allocation"}</h3>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
                {allocation?.summary || "Ground Control checks pitch, site, parking and officials readiness for every active fixture."}
              </p>
            </div>
          </div>
          <StatusChip variant={status}>{allocation?.score ?? 0}% ready</StatusChip>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ToneTile icon={MapPinned} label="Pitches" value={`${allocation?.metrics?.allocatedPitches || 0}/${allocation?.metrics?.fixtures || 0}`} tone={allocation?.metrics?.missingPitch || allocation?.metrics?.closedPitch ? "danger" : "success"} />
        <ToneTile icon={UsersRound} label="Officials" value={allocation?.metrics?.missingOfficials ? `${allocation.metrics.missingOfficials} TBC` : "Confirmed"} tone={allocation?.metrics?.missingOfficials ? "warning" : "success"} />
        <ToneTile icon={Car} label="Parking" value={allocation?.metrics?.parkingWarnings ? `${allocation.metrics.parkingWarnings} review` : "Within capacity"} tone={allocation?.metrics?.parkingWarnings ? "warning" : "success"} />
        <ToneTile icon={ShieldCheck} label="Sites" value={`${allocation?.metrics?.sites || 0} active`} tone={allocation?.metrics?.missingSite ? "warning" : "success"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Fixture Resources</div>
              <h4 className="mt-1 text-lg font-black text-slate-950">Active fixture allocation</h4>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{fixtures.length} fixtures</span>
          </div>

          <div className="mt-5 space-y-3">
            {fixtures.length ? fixtures.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-950">
                      {item.fixture.homeTeam || item.fixture.team || "Fixture"}
                      {item.fixture.awayTeam ? ` vs ${item.fixture.awayTeam}` : ""}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-500">{item.site?.name || "No site"}</div>
                  </div>
                  <StatusChip variant={item.status}>{item.label}</StatusChip>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ResourceBadge item={item.resources.pitch} />
                  <ResourceBadge item={item.resources.officials} />
                  <ResourceBadge item={item.resources.parking} />
                </div>
              </div>
            )) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500 ring-1 ring-slate-200">
                Build a schedule to see resource allocation by fixture.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Site Parking Peaks</div>
            <div className="mt-4 space-y-3">
              {siteParking.length ? siteParking.map((site) => (
                <div key={site.site.id} className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-950">{site.site.name}</div>
                      <div className="mt-1 text-xs font-bold text-slate-500">Peak {site.peakCars} cars at {site.peakLabel}</div>
                    </div>
                    <StatusChip variant={site.status}>{site.utilisation}%</StatusChip>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(site.utilisation, 100)}%` }} />
                  </div>
                </div>
              )) : null}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                <AlertTriangle size={20} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Resource Gaps</div>
                <h4 className="text-lg font-black text-slate-950">{issues.length ? `${issues.length} to review` : "No gaps found"}</h4>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {issues.length ? issues.slice(0, 6).map((issue, index) => (
                <div key={`${issue.fixture}-${issue.domain}-${index}`} className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600 ring-1 ring-slate-200">
                  <span className="font-black text-slate-950">{issue.domain}:</span> {issue.message}
                  <div className="mt-1 text-xs font-bold text-slate-400">{issue.fixture}</div>
                </div>
              )) : (
                <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
                  Core fixture resources look ready.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
