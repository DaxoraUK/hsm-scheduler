import { AlertTriangle, ArrowRight, Building2, CheckCircle2, CircleDollarSign, KeyRound, LogOut, RadioTower, ShieldCheck, Sparkles, Trophy, UsersRound } from "lucide-react";
import { getRoleLabel } from "../lib/security/permissions.js";

const ICONS = { ground_control: RadioTower, coach_hub: UsersRound, league_manager: Trophy, daxora_pay: CircleDollarSign, platform_admin: ShieldCheck };
const TONES = { emerald: "bg-emerald-100 text-emerald-700", sky: "bg-sky-100 text-sky-700", violet: "bg-violet-100 text-violet-700", amber: "bg-amber-100 text-amber-700", slate: "bg-slate-200 text-slate-700" };
const STATUS = { available: "Ready to open", managed: "Managed access", upgrade: "Upgrade required", unavailable: "Not available", coming_soon: "Coming soon" };

function scopeLabel(assignment = {}) {
  const type = String(assignment.scopeType || assignment.scope_type || "club").toLowerCase();
  if (type === "club") return "Club-wide";
  if (type === "team") return "Assigned team";
  if (type === "site") return "Assigned site";
  return "Scoped access";
}

export function buildDaxoraAccessContext({ activeMembership = null, workspaceAccess = null, subscription = null, leagueMemberships = [] } = {}) {
  const roleCodes = Array.isArray(workspaceAccess?.roles) && workspaceAccess.roles.length
    ? workspaceAccess.roles
    : [activeMembership?.role || workspaceAccess?.role || "viewer"];
  const roles = [...new Set(roleCodes.filter(Boolean))].map((role) => ({ code: role, label: getRoleLabel(role) }));
  const assignments = Array.isArray(workspaceAccess?.roleAssignments) ? workspaceAccess.roleAssignments : [];
  const scopes = [...new Set(assignments.map(scopeLabel))];
  const support = workspaceAccess?.isSupport || activeMembership?.accessMode === "support";
  return {
    roles,
    scopes: scopes.length ? scopes : ["Club-wide"],
    accessLabel: support ? "Time-limited support" : workspaceAccess?.isReadOnly ? "Read-only access" : "Active access",
    planLabel: subscription?.planName || subscription?.planCode || "Plan being verified",
    leagueCount: Array.isArray(leagueMemberships) ? leagueMemberships.length : 0,
  };
}

export function buildDaxoraHomeAlerts({ products = [], memberships = [], workspaceAccess = null, subscription = null, leagueMemberships = [] } = {}) {
  const alerts = [];
  if (subscription?.isReadOnly) {
    alerts.push({ id: "subscription", tone: "warning", title: "Workspace is read-only", detail: subscription.message || `${subscription.planName || "The current plan"} does not currently permit publishing or sending.` });
  } else if (subscription) {
    alerts.push({ id: "subscription", tone: "ready", title: `${subscription.planName || "Daxora"} access active`, detail: `${subscription.statusLabel || "Active"} · operational permissions remain role-controlled.` });
  }
  if (workspaceAccess?.isSupport) alerts.push({ id: "support", tone: "warning", title: "Support session active", detail: "This organisation remains read-only and the session is time-limited." });
  if (memberships.length > 1) alerts.push({ id: "organisations", tone: "info", title: `${memberships.length} organisations available`, detail: "Check the selected organisation before opening a product or completing an action." });
  if (leagueMemberships.length) alerts.push({ id: "leagues", tone: "info", title: `${leagueMemberships.length} League Manager workspace${leagueMemberships.length === 1 ? "" : "s"}`, detail: "League access is separate from the selected club and retains its own role boundary." });
  if (!alerts.length && products.some((product) => product.canOpen)) alerts.push({ id: "ready", tone: "ready", title: "Platform ready", detail: "Your available products are shown below." });
  return alerts.slice(0, 3);
}

export default function DaxoraHomePage({ products = [], club, memberships = [], activeClubId = "", activeMembership = null, workspaceAccess = null, subscription = null, leagueMemberships = [], user, onClubChange, onOpenProduct, onSignOut }) {
  const displayName = user?.user_metadata?.display_name || user?.email || "Daxora user";
  const accessContext = buildDaxoraAccessContext({ activeMembership, workspaceAccess, subscription, leagueMemberships });
  const platformAlerts = buildDaxoraHomeAlerts({ products, memberships, workspaceAccess, subscription, leagueMemberships });
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div><div className="text-xl font-black uppercase tracking-[0.16em] text-slate-950">Daxora</div><div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.26em] text-emerald-600">One club. One platform.</div></div>
          <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><div className="text-xs font-black text-slate-900">{displayName}</div><div className="text-[10px] font-semibold text-slate-500">Secure account</div></div><button type="button" onClick={onSignOut} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"><LogOut size={14} /> <span className="hidden sm:inline">Sign out</span></button></div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="overflow-hidden rounded-[32px] bg-gradient-to-br from-[#050816] via-[#0b1730] to-[#063c32] px-6 py-8 text-white shadow-xl sm:px-10 sm:py-11">
          <div className="flex max-w-3xl items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300"><Sparkles size={15} /> Daxora platform</div>
          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">What would you like to run today?</h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-300 sm:text-base">Choose a product. Your organisation, roles and subscription travel securely with you.</p>
          <div className="mt-7 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400"><Building2 size={14} className="text-emerald-300" /> Current organisation</div>
              {memberships.length > 1 ? <select aria-label="Current organisation" value={activeClubId} onChange={(event) => onClubChange?.(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-[#0b1730] px-3 text-sm font-black text-white outline-none"><option value={activeClubId}>{club?.name || activeMembership?.club?.name || "Current club"}</option>{memberships.filter((item) => item.clubId !== activeClubId).map((item) => <option key={item.clubId} value={item.clubId}>{item.club?.name || item.clubName || item.name || "Club workspace"}</option>)}</select> : <div className="mt-2 text-sm font-black text-white">{club?.name || activeMembership?.club?.name || "Your Daxora organisation"}</div>}
              <div className="mt-2 text-[11px] font-semibold text-slate-400">{memberships.length > 1 ? `${memberships.length} club workspaces available` : "Secure organisation boundary active"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400"><KeyRound size={14} className="text-cyan-300" /> Your access here</div>
              <div className="mt-2 flex flex-wrap gap-2">{accessContext.roles.map((role) => <span key={role.code} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black text-cyan-100">{role.label}</span>)}</div>
              <div className="mt-3 text-[11px] font-semibold text-slate-400">{accessContext.accessLabel} · {accessContext.scopes.join(" + ")} · {accessContext.planLabel}{accessContext.leagueCount ? ` · ${accessContext.leagueCount} league workspace${accessContext.leagueCount === 1 ? "" : "s"}` : ""}</div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-3" aria-label="Platform status">
          {platformAlerts.map((alert) => {
            const warning = alert.tone === "warning";
            const Icon = warning ? AlertTriangle : CheckCircle2;
            return <div key={alert.id} className={`flex items-start gap-3 rounded-2xl border p-4 ${warning ? "border-amber-200 bg-amber-50 text-amber-950" : alert.tone === "info" ? "border-sky-200 bg-sky-50 text-sky-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}><Icon size={18} className={`mt-0.5 shrink-0 ${warning ? "text-amber-600" : alert.tone === "info" ? "text-sky-600" : "text-emerald-600"}`} /><div><div className="text-sm font-black">{alert.title}</div><div className="mt-1 text-xs font-semibold leading-5 opacity-75">{alert.detail}</div></div></div>;
          })}
        </section>

        <section className="mt-9"><div><div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Your products</div><h2 className="mt-2 text-2xl font-black">Choose a workspace</h2></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const Icon = ICONS[product.code] || RadioTower;
              const enabled = product.canOpen;
              return <button key={product.code} type="button" disabled={!enabled} onClick={() => onOpenProduct?.(product)} className={`group min-h-56 rounded-[26px] border p-6 text-left shadow-sm transition ${enabled ? "border-slate-200 bg-white hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl" : "cursor-default border-slate-200 bg-slate-50 opacity-75"}`}><div className="flex items-start justify-between gap-3"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${TONES[product.accent] || TONES.slate}`}><Icon size={23} /></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-500">{STATUS[product.state]}</span></div><h3 className="mt-6 text-xl font-black">{product.name}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{product.description}</p><div className={`mt-6 flex items-center justify-between text-xs font-black ${enabled ? "text-emerald-700" : "text-slate-400"}`}><span>{product.detail}</span>{enabled ? <ArrowRight size={17} className="transition group-hover:translate-x-1" /> : null}</div></button>;
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
