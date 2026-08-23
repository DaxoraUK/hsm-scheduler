import { useEffect } from "react";
import { ArrowRight, BadgePoundSterling, Check, LockKeyhole, Mail, Scale, ShieldCheck } from "lucide-react";
import { buildDaxoraAppEntry } from "../lib/platform/platformUrls.js";
import { applyPublicMetadata } from "../lib/platform/publicMetadata.js";

const PAGE_CONTENT = Object.freeze({
  pricing: {
    title: "Pricing",
    description: "Clear Ground Control packages for grassroots clubs, with Coach Hub included in eligible plans and bespoke league arrangements available separately.",
  },
  security: {
    title: "Security",
    description: "How Daxora separates organisations, applies role-aware access and protects operational data across its platform.",
  },
  privacy: {
    title: "Privacy",
    description: "A plain-English overview of how Daxora handles account, organisation and operational information.",
  },
  terms: {
    title: "Terms",
    description: "The operating principles and commercial documents that govern use of Daxora products.",
  },
  contact: {
    title: "Contact",
    description: "Talk to Daxora about Ground Control, Coach Hub, League Manager, support or a future product requirement.",
  },
});

const PLANS = [
  ["Core", "£149", "per month", "Single-site club operations", ["Up to 15 teams", "Matchday scheduling", "Officials, reports and communications"]],
  ["Pro", "£249", "per month", "Larger and multi-venue clubs", ["Up to 40 teams", "Annual Planner and Coach Hub", "Advanced operations, analytics and reporting"]],
  ["Elite", "£399", "from per month", "Complex organisations", ["Up to 60 teams", "Organisation command and governance", "Bespoke capacity available by agreement"]],
];

function Header() {
  return <header className="border-b border-white/10 bg-[#050816]/90 backdrop-blur-xl"><div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8"><a href="/" className="text-xl font-black uppercase tracking-[0.2em]">Daxora<span className="text-emerald-400">.</span></a><nav className="hidden gap-6 text-xs font-black text-slate-400 md:flex"><a href="/pricing">Pricing</a><a href="/security">Security</a><a href="/contact">Contact</a></nav><a href={buildDaxoraAppEntry("signin")} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-slate-950">Sign in <ArrowRight size={15} /></a></div></header>;
}

function Footer() {
  return <footer className="border-t border-white/10 px-5 py-10 sm:px-8"><div className="mx-auto grid max-w-7xl gap-8 text-xs font-bold text-slate-500 sm:grid-cols-[1fr_auto]"><div><div className="uppercase tracking-[0.2em] text-slate-300">Daxora</div><div className="mt-2">Connected operations for grassroots sport.</div></div><nav className="flex flex-wrap gap-x-5 gap-y-3"><a href="/pricing">Pricing</a><a href="/security">Security</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/contact">Contact</a></nav></div></footer>;
}

function Pricing() {
  return <><Intro icon={BadgePoundSterling} eyebrow="Ground Control packages" title="Commercial clarity before commitment" copy="Package prices exclude VAT where applicable. Provider usage, onboarding, storage and bespoke capacity are confirmed before paid activation, so clubs know the complete scope before committing." /><div className="grid gap-5 lg:grid-cols-3">{PLANS.map(([name, price, suffix, audience, features]) => <article key={name} className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6"><div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">{name}</div><div className="mt-5 text-4xl font-black">{price}</div><div className="mt-1 text-xs font-bold text-slate-500">{suffix}</div><p className="mt-5 text-sm font-bold text-slate-300">{audience}</p><ul className="mt-5 space-y-3">{features.map((feature) => <li key={feature} className="flex gap-2 text-sm font-semibold text-slate-400"><Check size={16} className="mt-0.5 shrink-0 text-emerald-300" />{feature}</li>)}</ul></article>)}</div><Notice>League Manager is currently operated through controlled pilot access. Daxora Pay remains in development and is not offered for purchase yet.</Notice></>;
}

function Security() {
  return <><Intro icon={ShieldCheck} eyebrow="Security by design" title="Access follows the organisation and the person" copy="Daxora applies security at the interface, service and database layers. Product access never replaces package entitlement or role permission checks." /><Grid items={[["Organisation isolation","Club and league records remain separated. Database row-level security rejects cross-organisation access."],["Role-aware permissions","Owners, administrators, schedulers, coaches and viewers receive only the actions their responsibilities require."],["Audited administration","Sensitive platform changes require explicit authority and create an audit record."],["Protected operations","HTTPS, restrictive browser headers, guarded API operations and server-side validation protect live workflows."]]} /><Notice>No online service can promise absolute security. Suspected vulnerabilities or account concerns should be reported promptly to support@daxora.co.uk.</Notice></>;
}

function Privacy() {
  return <><Intro icon={LockKeyhole} eyebrow="Privacy overview" title="Operational data is used to deliver the service" copy="Daxora processes account identity, organisation membership, team responsibilities, fixtures, facilities, communications records and related operational evidence where a customer uses those features." /><Grid items={[["Why information is used","To authenticate users, enforce access, run requested workflows, provide support and maintain security and audit records."],["Who controls club data","The subscribing organisation controls the club information it enters. Daxora operates the platform and processes that information to provide the contracted service."],["Service providers","Infrastructure, database, email, payment and monitoring providers may process limited information where needed to deliver enabled services."],["Your choices","Account and contact corrections should normally be requested through the organisation that granted access, or escalated to Daxora support."]]} /><Notice>This public overview does not replace the versioned Privacy Notice and Data Processing Addendum supplied during commercial onboarding.</Notice></>;
}

function Terms() {
  return <><Intro icon={Scale} eyebrow="Terms overview" title="Clear authority, responsible use and controlled activation" copy="Daxora products are supplied under versioned commercial documents accepted by an authorised organisation representative before paid activation." /><Grid items={[["Authorised access","Users must keep credentials secure and use only organisations, teams and products they are authorised to access."],["Customer responsibility","Organisations remain responsible for the accuracy, lawfulness and operational use of information they enter or distribute."],["Service boundaries","Availability, package limits, provider allowances, onboarding scope and support arrangements are confirmed in the applicable order and service documents."],["Responsible operation","The platform must not be used to harm others, bypass security, send unlawful communications or process information without an appropriate basis."]]} /><Notice>The binding Business Service Terms, Data Processing Addendum and Acceptable Use Policy are supplied and version-recorded during onboarding. This page is a summary, not the contract.</Notice></>;
}

function Contact() {
  return <><Intro icon={Mail} eyebrow="Contact Daxora" title="Start with the outcome you need" copy="Tell us about your club, league or operational challenge. We can then confirm the right product, realistic onboarding scope and any dependencies before you commit." /><div className="grid gap-5 md:grid-cols-2"><a href="mailto:support@daxora.co.uk?subject=Daxora%20product%20enquiry" className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-7"><Mail className="text-emerald-300" /><h2 className="mt-5 text-2xl font-black">Product and onboarding</h2><p className="mt-3 text-sm font-semibold leading-6 text-slate-300">support@daxora.co.uk</p></a><a href={buildDaxoraAppEntry("signin")} className="rounded-[28px] border border-white/10 bg-white/[0.05] p-7"><LockKeyhole className="text-sky-300" /><h2 className="mt-5 text-2xl font-black">Existing customer</h2><p className="mt-3 text-sm font-semibold leading-6 text-slate-300">Sign in to open your organisation and product workspace.</p></a></div></>;
}

function Intro({ icon: Icon, eyebrow, title, copy }) { return <div className="mb-12 max-w-4xl"><div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300"><Icon size={16} />{eyebrow}</div><h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">{title}</h1><p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-slate-300">{copy}</p></div>; }
function Grid({ items }) { return <div className="grid gap-5 md:grid-cols-2">{items.map(([title, copy]) => <article key={title} className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6"><h2 className="text-lg font-black">{title}</h2><p className="mt-3 text-sm font-semibold leading-6 text-slate-400">{copy}</p></article>)}</div>; }
function Notice({ children }) { return <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm font-semibold leading-6 text-amber-100">{children}</div>; }

export default function DaxoraPublicPage({ page = "contact" }) {
  const content = PAGE_CONTENT[page] || PAGE_CONTENT.contact;
  useEffect(() => applyPublicMetadata({ ...content, path: `/${page}` }), [content, page]);
  const Body = { pricing: Pricing, security: Security, privacy: Privacy, terms: Terms, contact: Contact }[page] || Contact;
  return <div className="min-h-screen bg-[#050816] text-white"><Header /><main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-20 sm:px-8 lg:py-24"><Body /></main><Footer /></div>;
}
