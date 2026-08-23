import { ArrowRight, Building2, CircleDollarSign, LogOut, RadioTower, ShieldCheck, Sparkles, Trophy, UsersRound } from "lucide-react";

const ICONS = { ground_control: RadioTower, coach_hub: UsersRound, league_manager: Trophy, daxora_pay: CircleDollarSign, platform_admin: ShieldCheck };
const TONES = { emerald: "bg-emerald-100 text-emerald-700", sky: "bg-sky-100 text-sky-700", violet: "bg-violet-100 text-violet-700", amber: "bg-amber-100 text-amber-700", slate: "bg-slate-200 text-slate-700" };
const STATUS = { available: "Ready to open", managed: "Managed access", upgrade: "Upgrade required", unavailable: "Not available", coming_soon: "Coming soon" };

export default function DaxoraHomePage({ products = [], club, memberships = [], activeClubId = "", user, onClubChange, onOpenProduct, onSignOut }) {
  const displayName = user?.user_metadata?.display_name || user?.email || "Daxora user";
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
          {memberships.length > 1 ? <label className="mt-7 block max-w-sm"><span className="mb-2 block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Organisation</span><select value={activeClubId} onChange={(event) => onClubChange?.(event.target.value)} className="h-12 w-full rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white outline-none"><option value={activeClubId}>{club?.name || "Current club"}</option>{memberships.filter((item) => item.clubId !== activeClubId).map((item) => <option className="text-slate-950" key={item.clubId} value={item.clubId}>{item.clubName || item.name || "Club workspace"}</option>)}</select></label> : <div className="mt-7 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-xs font-black text-slate-200"><Building2 size={16} className="text-emerald-300" /> {club?.name || "Your Daxora organisation"}</div>}
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
