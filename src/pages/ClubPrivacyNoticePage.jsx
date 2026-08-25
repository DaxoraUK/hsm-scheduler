import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { getPublicClubPrivacyNotice } from "../lib/communications/publicPrivacyNotice.js";

const BASIS_LABELS = { legitimate_interests: "Legitimate interests", contract: "Contract", consent: "Consent", legal_obligation: "Legal obligation", public_task: "Public task", vital_interests: "Vital interests" };

function Section({ title, children }) {
  return <section className="border-t border-slate-200 py-7 first:border-t-0"><h2 className="text-xl font-black text-slate-950">{title}</h2><div className="mt-3 space-y-3 text-sm font-semibold leading-7 text-slate-600">{children}</div></section>;
}

export default function ClubPrivacyNoticePage({ slug }) {
  const [notice, setNotice] = useState(null);
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    let active = true;
    getPublicClubPrivacyNotice(slug).then((value) => {
      if (!active) return;
      setNotice(value);
      setStatus(value ? "ready" : "missing");
    }).catch(() => active && setStatus("error"));
    return () => { active = false; };
  }, [slug]);
  useEffect(() => {
    document.title = notice?.club_name ? `${notice.club_name} Privacy Notice · Daxora` : "Club Privacy Notice · Daxora";
  }, [notice?.club_name]);

  if (status === "loading") return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><LoaderCircle className="animate-spin" size={32} /><span className="ml-3 font-black">Loading privacy notice…</span></main>;
  if (!notice) return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5"><div className="max-w-lg rounded-[32px] bg-white p-8 text-center"><ShieldCheck className="mx-auto text-rose-600" /><h1 className="mt-5 text-2xl font-black">Privacy notice unavailable</h1><p className="mt-3 text-sm font-semibold leading-6 text-slate-600">This club has not published its notice yet, or the address is incorrect.</p><a href="https://www.daxora.co.uk" className="mt-6 inline-flex items-center gap-2 font-black text-emerald-700"><ArrowLeft size={16} /> Return to Daxora</a></div></main>;

  const reviewed = notice.last_reviewed_at ? new Date(notice.last_reviewed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Not recorded";
  return <div className="min-h-screen bg-slate-100 text-slate-950">
    <header className="bg-[#050816] text-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6"><a href="https://www.daxora.co.uk" className="text-lg font-black uppercase tracking-[0.18em]">Daxora<span className="text-emerald-400">.</span></a><div className="flex items-center gap-2 text-xs font-black text-emerald-300"><ShieldCheck size={16} /> Club privacy</div></div></header>
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-16"><article className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl shadow-slate-300/30">
      <div className="bg-gradient-to-br from-slate-950 to-emerald-950 px-6 py-10 text-white sm:px-10"><div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Adult coach and manager information</div><h1 className="mt-4 text-4xl font-black tracking-tight">{notice.club_name} privacy notice</h1><p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-300">This notice explains how {notice.controller_name} uses adult coach and team-manager contact information within Daxora Ground Control.</p><div className="mt-6 text-xs font-bold text-slate-400">Last reviewed: {reviewed}</div></div>
      <div className="px-6 sm:px-10">
        <Section title="Who controls your information"><p><strong className="text-slate-900">{notice.controller_name}</strong> is the data controller and decides why this club information is used. Daxora provides the software and processes it to deliver the service.</p><p>Privacy enquiries can be sent to <a className="font-black text-emerald-700" href={`mailto:${notice.privacy_contact_email}`}>{notice.privacy_contact_email}</a>.</p></Section>
        <Section title="Why the club uses it"><p>{notice.purpose}</p><p>The recorded lawful basis is <strong className="text-slate-900">{BASIS_LABELS[notice.lawful_basis] || notice.lawful_basis}</strong>. The information must not be reused for unrelated marketing without a separate lawful basis and appropriate notice.</p></Section>
        <Section title="Information covered"><p>This notice covers adult coach, manager and assistant names, email addresses, telephone numbers, team responsibilities, communication preferences, access status and records showing that operational information was prepared or delivered.</p><p>Player or child contact information must not be entered into this feature.</p></Section>
        <Section title="Who may receive it"><p>Authorised club users can access information according to their role. Daxora and its contracted infrastructure, database and communications providers may process the minimum information required to operate, secure and support the service. Information is not sold.</p></Section>
        <Section title="How long it is retained"><p>Communications audit and provider-delivery history is retained for up to <strong className="text-slate-900">{notice.retention_days} days</strong>, unless the club must retain a particular record for a documented legal or dispute-related reason. Contact details should be corrected or removed when the role ends and they are no longer needed.</p></Section>
        <Section title="Your rights"><p>Depending on the circumstances, you may ask for access, correction, deletion or restriction, object to certain uses, or request information about how your details are handled. Contact the club first using the address above.</p><p>If you remain concerned, you may complain to the UK Information Commissioner’s Office. <a href="https://ico.org.uk/make-a-complaint/data-protection-complaints/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-black text-emerald-700">ICO complaints guidance <ExternalLink size={14} /></a>.</p></Section>
      </div>
    </article><div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-slate-500"><Mail size={14} /> Published securely through Daxora Ground Control</div></main>
  </div>;
}
