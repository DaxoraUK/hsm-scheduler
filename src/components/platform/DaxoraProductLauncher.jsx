import { useEffect, useRef, useState } from "react";
import { ChevronDown, CircleDollarSign, RadioTower, ShieldCheck, Trophy, UsersRound, X } from "lucide-react";

const ICONS = { ground_control: RadioTower, coach_hub: UsersRound, league_manager: Trophy, daxora_pay: CircleDollarSign, platform_admin: ShieldCheck };
const ACCENTS = { emerald: "bg-emerald-400/15 text-emerald-300", sky: "bg-sky-400/15 text-sky-300", violet: "bg-violet-400/15 text-violet-300", amber: "bg-amber-400/15 text-amber-300", slate: "bg-white/10 text-slate-200" };
const STATE_LABELS = { available: "Open", managed: "Coach access", upgrade: "Upgrade", unavailable: "No access", coming_soon: "Coming soon" };

export default function DaxoraProductLauncher({ products = [], onOpenProduct }) {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === "Escape") setOpen(false);
      if (!launcherRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  return (
    <div ref={launcherRef} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.07]">
        <span><span className="block text-[9px] font-black uppercase tracking-[0.24em] text-emerald-400">Daxora platform</span><span className="mt-1 block text-xs font-black text-white">Products and workspaces</span></span>
        <ChevronDown size={17} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <section role="dialog" aria-label="Daxora products" className="absolute left-0 top-[calc(100%+8px)] z-[120] w-[min(360px,calc(100vw-40px))] overflow-hidden rounded-3xl border border-slate-700 bg-[#0b1020] p-3 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 px-2 pb-3 pt-1"><div><div className="text-sm font-black">Your Daxora products</div><div className="mt-1 text-[11px] font-semibold text-slate-400">Access follows your organisation, role and subscription.</div></div><button type="button" aria-label="Close product launcher" onClick={() => setOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white"><X size={16} /></button></div>
          <div className="space-y-1">
            {products.map((product) => {
              const Icon = ICONS[product.code] || RadioTower;
              const content = <><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${ACCENTS[product.accent] || ACCENTS.slate}`}><Icon size={19} /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-black">{product.name}</span>{product.active ? <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-300">Current</span> : null}</span><span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-400">{product.detail}</span></span><span className="shrink-0 text-[9px] font-black uppercase tracking-wide text-slate-500">{STATE_LABELS[product.state]}</span></>;
              return product.canOpen ? <button key={product.code} type="button" onClick={() => { onOpenProduct?.(product); setOpen(false); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-white/[0.07]">{content}</button> : <div key={product.code} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 opacity-80">{content}</div>;
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
