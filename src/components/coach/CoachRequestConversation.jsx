import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, RefreshCw, Send, X } from "lucide-react";
import { toast } from "sonner";
import { DB } from "../../lib/supabase.js";
import { buildRequestConversation } from "../../lib/coach/coachHubPilotEngine.js";

const LIVE_REFRESH_MS = 6000;

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function entriesSignature(rows = []) {
  return rows.map((row) => `${row.id || ""}:${row.created_at || row.createdAt || ""}:${row.read_at || row.readAt || ""}:${row.body || ""}`).join("|");
}

export default function CoachRequestConversation({ clubId, request, role = "coach", onClose, embedded = false, onUpdated }) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(true);
  const entriesRef = useRef([]);
  const scrollRef = useRef(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!request?.id) return;
    if (!quiet) setStatus("loading");
    try {
      const payload = await DB.listCoachHubRequestThread(clubId, request.id);
      const next = Array.isArray(payload?.messages) ? payload.messages : [];
      if (entriesSignature(next) !== entriesSignature(entriesRef.current)) {
        entriesRef.current = next;
        setEntries(next);
        onUpdated?.(payload);
      }
      setStatus("ready");
      setLive(true);
    } catch (error) {
      if (!quiet) {
        setStatus("error");
        toast.error("Request conversation could not be loaded", { description: error?.message });
      }
      setLive(false);
    }
  }, [clubId, request?.id, onUpdated]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let timer = null;
    const refresh = () => {
      if (document.visibilityState === "visible") load({ quiet: true });
    };
    const start = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(refresh, LIVE_REFRESH_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    start();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const conversation = useMemo(() => buildRequestConversation(entries, role), [entries, role]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: entries.length > 1 ? "smooth" : "auto" });
  }, [entries.length]);

  async function send() {
    const body = message.trim();
    if (!body) return;
    setSending(true);
    try {
      await DB.postCoachHubRequestMessage(clubId, request.id, body);
      setMessage("");
      await load({ quiet: true });
      toast.success("Reply sent");
    } catch (error) {
      toast.error("Reply could not be sent", { description: error?.message });
    } finally {
      setSending(false);
    }
  }

  const content = (
    <section className={`${embedded ? "rounded-2xl border border-slate-200" : "max-h-[92vh] w-full max-w-2xl rounded-[28px]"} flex min-h-[420px] flex-col overflow-hidden bg-white shadow-2xl`}>
      <header className="flex items-start gap-3 border-b border-slate-200 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><MessageSquareText size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-700">Request conversation</div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${live ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`} /> {live ? "Live" : "Reconnecting"}
            </span>
          </div>
          <h2 className="mt-1 truncate text-lg font-black text-slate-950">{request?.title || "Booking request"}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{request?.teamName || request?.team_name || "Team"} · new replies appear automatically</p>
        </div>
        <button type="button" onClick={() => load()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200" aria-label="Refresh conversation"><RefreshCw size={16} /></button>
        {!embedded ? <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200" aria-label="Close conversation"><X size={17} /></button> : null}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-5">
        {status === "loading" ? <div className="py-16 text-center text-sm font-bold text-slate-500">Loading conversation…</div> : null}
        {status === "error" ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">Conversation is temporarily unavailable.</div> : null}
        {status === "ready" && !conversation.rows.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><MessageSquareText className="mx-auto text-slate-400" size={24} /><div className="mt-3 text-sm font-black">No replies yet</div><div className="mt-1 text-xs font-semibold text-slate-500">Start the conversation here instead of switching to WhatsApp.</div></div> : null}
        {conversation.rows.map((entry) => {
          const own = entry.authorRole === role;
          return <article key={entry.id} className={`max-w-[88%] rounded-2xl p-4 shadow-sm ${own ? "ml-auto bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-900"}`}><div className={`text-[10px] font-black uppercase tracking-[0.14em] ${own ? "text-emerald-300" : "text-violet-700"}`}>{entry.authorName || (entry.authorRole === "coach" ? "Coach" : "Club")}</div><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6">{entry.body}</p><div className="mt-2 text-[10px] font-bold text-slate-400">{formatDate(entry.createdAt)}</div></article>;
        })}
      </div>

      <footer className="border-t border-slate-200 bg-white p-4 sm:p-5">
        <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Reply</label>
        <div className="mt-2 flex items-end gap-2">
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") send(); }} rows="3" maxLength="5000" className="min-h-[86px] flex-1 resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" placeholder="Ask a question, clarify the request or confirm an arrangement…" />
          <button type="button" disabled={sending || !message.trim()} onClick={send} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-violet-700 px-4 text-sm font-black text-white disabled:opacity-40"><Send size={16} /> {sending ? "Sending…" : "Send"}</button>
        </div>
      </footer>
    </section>
  );

  if (embedded) return content;
  return <div className="fixed inset-0 z-[250] flex items-end justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>{content}</div>;
}
