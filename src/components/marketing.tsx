import Link from "next/link";
import type { ReactNode } from "react";
import { COMPANY_NAME, CONTACT_EMAIL, getPaymentLinks } from "@/lib/env";
import { ALL_PLANS, CREDIT_COSTS, INCLUDED_FEATURES, PAID_PLANS, capacity } from "@/lib/plans";
import { Logo } from "./logo";

/* The only two button labels on the marketing site. */
export function GetStarted({ href = "/signup", className = "", size = "md" }: { href?: string; className?: string; size?: "md" | "lg" }) {
  return (
    <Link href={href} className={`btn-primary ${size === "lg" ? "btn-lg" : ""} ${className}`}>
      Get started
    </Link>
  );
}

export function SignIn({ tone = "light", size = "md", className = "" }: { tone?: "light" | "dark"; size?: "md" | "lg"; className?: string }) {
  const toneCls = tone === "dark" ? "border border-paper-light/70 text-paper-light hover:bg-paper-light hover:text-ink" : "btn-outline";
  return (
    <Link href="/signin" className={`btn ${toneCls} ${size === "lg" ? "btn-lg" : ""} ${className}`}>
      Sign in
    </Link>
  );
}

const NAV = [
  { href: "/governance", label: "Governance" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-ink hover:text-gold-deep">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <SignIn />
          <GetStarted />
        </div>
        <details className="relative md:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center border border-line" aria-label="Menu">
            <span className="block h-0.5 w-5 bg-ink shadow-[0_6px_0_var(--color-ink),0_-6px_0_var(--color-ink)]" />
          </summary>
          <div className="absolute right-0 mt-2 w-64 border border-line bg-paper-light p-4 shadow-lg">
            <nav className="flex flex-col gap-3" aria-label="Mobile">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-base font-medium">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              <GetStarted className="w-full" />
              <SignIn className="w-full" />
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-ink text-paper-light">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="dark" />
          <p className="mt-4 max-w-sm text-sm text-ink-100/75">
            An AI platform that listens to sales calls, helps with follow-up and helps companies grow sales.
          </p>
          <p className="mt-4 text-sm">
            <a className="underline decoration-gold underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
        <FooterCol title="Product" links={[["/features", "Features"], ["/pricing", "Pricing"], ["/governance", "Security & Governance"]]} />
        <FooterCol title="Company" links={[["/about", "About"], ["/contact", "Contact"]]} />
        <FooterCol title="Legal" links={[["/privacy", "Privacy"], ["/terms", "Terms"], ["/governance", "Security"]]} />
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-ink-100/60 sm:flex-row sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.</p>
          <p>SecureShield AI is a sales and revenue intelligence platform. It is not a cybersecurity product.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-gold uppercase">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={label}>
            <Link href={href} className="text-ink-100/80 hover:text-white">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Section({ children, tone = "paper", id, className = "" }: { children: ReactNode; tone?: "paper" | "light" | "ink"; id?: string; className?: string }) {
  const bg = { paper: "bg-paper text-ink", light: "bg-paper-light text-ink", ink: "bg-ink text-paper-light" }[tone];
  return (
    <section id={id} className={`${bg} ${className}`}>
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">{children}</div>
    </section>
  );
}

export function SectionHead({ eyebrow, title, children, tone = "paper" }: { eyebrow?: string; title: string; children?: ReactNode; tone?: "paper" | "ink" }) {
  return (
    <div className="mb-10 max-w-3xl sm:mb-14">
      {eyebrow && <p className={`eyebrow ${tone === "ink" ? "!text-gold" : ""}`}>{eyebrow}</p>}
      <h2 className="mt-2 text-3xl leading-tight font-semibold sm:text-4xl">{title}</h2>
      {children && <div className={`mt-4 text-base leading-relaxed ${tone === "ink" ? "text-ink-100/80" : "text-mute"}`}>{children}</div>}
    </div>
  );
}

/** Conceptual illustration of workspace isolation. Built as markup, not a screenshot; contains no customer data. */
export function IsolationDiagram() {
  const box = (name: string, tag: string) => (
    <div className="border border-ink/25 bg-paper-light p-4">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-gold-deep uppercase">{tag}</p>
      <p className="mt-0.5 font-serif text-lg font-semibold">{name}</p>
      <ul className="mt-3 space-y-1.5 text-xs text-mute">
        {["Pipeline & opportunities", "Accounts & leads", "Calls & conversations", "Briefings & actions"].map((i) => (
          <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 bg-ink" />{i}</li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-2 font-mono text-[11px] text-ink-700">org_id = this organization</p>
    </div>
  );
  return (
    <figure className="border border-line bg-paper-dark/40 p-5 sm:p-6" aria-label="Illustration: two organizations' workspaces separated by a database boundary">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        {box("Organization A", "Workspace")}
        <div className="flex items-center justify-center sm:flex-col" aria-hidden>
          <div className="h-px w-full bg-gold sm:h-full sm:w-px" />
          <span className="mx-2 my-2 shrink-0 bg-gold px-2 py-1 text-[10px] font-bold tracking-widest whitespace-nowrap text-ink-900 uppercase sm:mx-0 sm:[writing-mode:vertical-rl]">Row Level Security</span>
          <div className="h-px w-full bg-gold sm:h-full sm:w-px" />
        </div>
        {box("Organization B", "Workspace")}
      </div>
      <figcaption className="mt-4 text-xs text-mute">
        Illustration. Each query runs under the signed-in user&apos;s identity and the database only returns rows whose organization matches one the user belongs to.
      </figcaption>
    </figure>
  );
}

/** Illustration of the sales loop the platform runs. Markup only; no customer data. */
export function LoopDiagram() {
  const steps = [
    ["Listen", "Upload a call recording or transcript. The AI extracts the summary, objections, commitments and next action."],
    ["Understand", "It reads your pipeline, accounts and leads and scores which deals and leads need attention."],
    ["Follow up", "It drafts the follow-up and adds it to a queue with the reason behind it."],
    ["Close", "Your team works the queue, and the weekly briefing shows what moved and what stalled."],
  ];
  return (
    <figure className="border border-line bg-paper-dark/40 p-5 sm:p-6" aria-label="Illustration: the loop from call to follow-up to closed deal">
      <ol className="space-y-3">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex gap-4 border border-ink/20 bg-paper-light p-4">
            <span className="font-mono text-sm text-gold-deep">0{i + 1}</span>
            <div>
              <p className="font-serif text-lg font-semibold">{t}</p>
              <p className="mt-0.5 text-sm text-mute">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <figcaption className="mt-4 text-xs text-mute">Illustration of the workflow. Your team reviews every AI output and makes the decisions.</figcaption>
    </figure>
  );
}

export const MODULES = [
  { name: "Pipeline intelligence", body: "Opportunities, accounts and leads with stages, values, owners and dates. Pipeline value, weighted value, win rate and stalled deals are calculated from your records, never estimated." },
  { name: "Briefings", body: "A written briefing on what changed, what needs attention, important opportunities, risks and recommended actions. The figures behind each briefing are stored beside it so every statement can be checked." },
  { name: "Actions", body: "A queue of follow-ups found in your pipeline and conversations. Each states its reason and links to its source record. Work them, complete them, dismiss them." },
  { name: "Lead scoring", body: "A 100-point score from five published criteria — contact completeness, progress, recent engagement, estimated value and record hygiene — with the breakdown shown on every lead." },
  { name: "Conversations", body: "Upload a recording or transcript. The AI reads it and extracts the summary, intent, sentiment, objections, commitments, competitors, decision criteria and next action — from what was actually said." },
];

export const CONVERSATION_OUTPUTS = ["Summary", "Intent", "Sentiment", "Objections", "Commitments", "Competitors", "Decision criteria", "Next action"];

export function PlanCards({ signedIn, tone = "light" }: { signedIn: boolean; tone?: "light" | "paper" }) {
  const links = getPaymentLinks();
  return (
    <div className="grid gap-px border border-line bg-line md:grid-cols-3">
      {PAID_PLANS.map((p) => {
        const cap = capacity(p);
        const pay = signedIn ? links[p.id as "starter" | "pro" | "scale"] : null;
        const featured = p.id === "pro";
        return (
          <div key={p.id} className={`flex flex-col p-7 ${tone === "light" ? "bg-paper-light" : "bg-paper"} ${featured ? "ring-2 ring-inset ring-gold" : ""}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-2xl font-semibold">{p.name}</h3>
            </div>
            <p className="mt-4 font-serif text-4xl font-semibold">${p.priceUsd}<span className="text-base font-normal text-mute">/month</span></p>
            <p className="mt-2 text-base font-semibold">{p.credits.toLocaleString("en-US")} credits/month</p>
            <p className="mt-1 text-sm text-mute">{p.blurb}</p>
            <ul className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
              {INCLUDED_FEATURES.slice(0, 3).map((f) => (
                <li key={f} className="flex gap-2"><Tick />{f}</li>
              ))}
              <li className="flex gap-2"><Tick />Roughly {cap.briefings.toLocaleString("en-US")} briefings, or {cap.analyses.toLocaleString("en-US")} call analyses, or {cap.questions.toLocaleString("en-US")} assistant questions a month — or a mix</li>
            </ul>
            <p className="mt-4 text-xs text-mute">Limit: {p.credits.toLocaleString("en-US")} credits per billing period. Credits refresh each period and do not roll over.</p>
            <div className="mt-auto pt-6">
              {pay ? (
                <a href={pay} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">Get started</a>
              ) : (
                <GetStarted href={signedIn ? "/subscription" : `/signup?plan=${p.id}`} className="w-full" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden>
      <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function CreditCostTable() {
  return (
    <div className="overflow-x-auto border border-line bg-paper-light">
      <table className="tbl min-w-[520px]">
        <thead><tr><th>Operation</th><th className="text-right">Credits</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td>AI briefing</td><td className="text-right tabular-nums">{CREDIT_COSTS.briefing}</td><td className="text-mute">One briefing for the period you choose</td></tr>
          <tr><td>Conversation analysis</td><td className="text-right tabular-nums">{CREDIT_COSTS.conversation_analysis}</td><td className="text-mute">Per recording or transcript analysed</td></tr>
          <tr><td>AI Assistant question</td><td className="text-right tabular-nums">{CREDIT_COSTS.assistant_question}</td><td className="text-mute">Per question asked</td></tr>
          <tr><td>Follow-up draft</td><td className="text-right tabular-nums">{CREDIT_COSTS.followup_draft}</td><td className="text-mute">Per message drafted</td></tr>
          <tr><td>Lead scoring, insights, action finding, reports, imports</td><td className="text-right tabular-nums">0</td><td className="text-mute">Calculated from your data; no credits used</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export { ALL_PLANS };
