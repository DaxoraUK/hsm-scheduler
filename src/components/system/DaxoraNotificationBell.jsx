import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, CheckCheck, ChevronRight, CircleAlert, Info, ShieldAlert, Trash2, X } from "lucide-react";
import {
  clearReadDaxoraNotifications,
  dismissDaxoraNotification,
  markAllDaxoraNotificationsRead,
  markDaxoraNotificationRead,
  readDaxoraNotifications,
  subscribeToDaxoraNotifications,
} from "../../lib/notifications/daxoraNotifications.js";

const SEVERITY = {
  error: { Icon: CircleAlert, className: "bg-rose-100 text-rose-700", label: "Critical" },
  warning: { Icon: ShieldAlert, className: "bg-amber-100 text-amber-800", label: "Warning" },
  action: { Icon: BellRing, className: "bg-violet-100 text-violet-700", label: "Action required" },
  success: { Icon: CheckCheck, className: "bg-emerald-100 text-emerald-700", label: "Completed" },
  info: { Icon: Info, className: "bg-sky-100 text-sky-700", label: "Information" },
};

function relativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Just now";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function DaxoraNotificationBell() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState(() => readDaxoraNotifications());
  const panelRef = useRef(null);

  useEffect(() => subscribeToDaxoraNotifications(setItems), []);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const unread = items.filter((item) => !item.readAt).length;
  const visible = useMemo(() => filter === "unread" ? items.filter((item) => !item.readAt) : items, [filter, items]);

  const openItem = (item) => {
    markDaxoraNotificationRead(item.id);
    if (item.href) {
      if (item.href.startsWith("http")) window.location.assign(item.href);
      else window.history.pushState({}, "", item.href);
      window.dispatchEvent(new Event("popstate"));
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button type="button" aria-label={`Daxora notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition ${open ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
        {unread ? <BellRing size={19} /> : <Bell size={19} />}
        {unread ? <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[9px] font-black text-white">{unread > 99 ? "99+" : unread}</span> : null}
      </button>

      {open ? (
        <section className="fixed inset-x-3 top-[76px] z-[170] max-h-[calc(100vh-92px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)] sm:absolute sm:inset-auto sm:right-0 sm:top-14 sm:w-[430px]" aria-label="Daxora notification centre">
          <div className="relative overflow-hidden bg-[#07121f] px-5 py-5 text-white">
            <div className="absolute -right-12 -top-20 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-4">
              <div><div className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300">Daxora activity centre</div><h2 className="mt-2 text-xl font-black">Notifications</h2><p className="mt-1 text-xs font-semibold text-slate-400">Warnings and actions stay here after the toast closes.</p></div>
              <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"><X size={17} /></button>
            </div>
            <div className="relative mt-4 flex items-center gap-2">
              {["all", "unread"].map((key) => <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-xl px-3 py-2 text-xs font-black capitalize ${filter === key ? "bg-white text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>{key}{key === "unread" && unread ? ` (${unread})` : ""}</button>)}
              {unread ? <button type="button" onClick={markAllDaxoraNotificationsRead} className="ml-auto text-xs font-black text-emerald-300 hover:text-emerald-200">Mark all read</button> : null}
            </div>
          </div>

          <div className="max-h-[58vh] overflow-y-auto">
            {visible.length ? visible.map((item) => {
              const severity = SEVERITY[item.severity] || SEVERITY.info;
              const Icon = severity.Icon;
              return (
                <article key={item.id} className={`group border-b border-slate-100 px-4 py-4 last:border-b-0 ${item.readAt ? "bg-white" : "bg-emerald-50/40"}`}>
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => openItem(item)} className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${severity.className}`}><Icon size={18} /></button>
                    <button type="button" onClick={() => openItem(item)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2"><span className="truncate text-sm font-black text-slate-950">{item.title}</span>{!item.readAt ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" /> : null}</div>
                      {item.description ? <p className="mt-1 line-clamp-3 text-xs font-semibold leading-5 text-slate-600">{item.description}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.11em] text-slate-400"><span>{severity.label}</span><span>·</span><span>{item.workspaceName || "Daxora"}</span><span>·</span><span>{relativeTime(item.createdAt)}</span></div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.href ? <button type="button" aria-label="Open related item" onClick={() => openItem(item)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800"><ChevronRight size={16} /></button> : null}
                      <button type="button" aria-label="Dismiss notification" onClick={() => dismissDaxoraNotification(item.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100 focus:opacity-100"><X size={15} /></button>
                    </div>
                  </div>
                </article>
              );
            }) : <div className="px-6 py-14 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCheck size={24} /></div><div className="mt-4 text-sm font-black text-slate-950">{filter === "unread" ? "Everything has been read" : "No retained notifications"}</div><p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Critical errors, warnings and action-required updates will appear here.</p></div>}
          </div>

          {items.some((item) => item.readAt) ? <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-4 py-3"><button type="button" onClick={clearReadDaxoraNotifications} className="inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-rose-700"><Trash2 size={14} /> Clear read</button></div> : null}
        </section>
      ) : null}
    </div>
  );
}
