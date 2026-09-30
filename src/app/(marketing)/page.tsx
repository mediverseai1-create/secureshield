import Link from "next/link";
import { CONVERSATION_OUTPUTS, GetStarted, IsolationDiagram, MODULES, PlanCards, Section, SectionHead, SignIn } from "@/components/marketing";
import { PermissionsTable } from "@/components/permissions-table";
import { isSignedIn } from "@/lib/session";

const PRINCIPLES = [
  { n: "01", t: "Isolation", d: "Every query is scoped to your organization through Row Level Security in the database." },
  { n: "02", t: "Access", d: "Owners, admins and members work in the same system with the appropriate level of control." },
  { n: "03", t: "Ownership", d: "Files, calls and conversations belong to your workspace and are not mixed with another organization's data." },
];

const QA = [
  ["Where does our data live?", "Workspace records live in a PostgreSQL database managed through Supabase. Uploaded call recordings and transcript files live in a private Supabase Storage bucket, in a folder named for your organization."],
  ["Who can access it?", "Through the application, only signed-in members of your organization, at the level their role allows. The server-side credential that can bypass Row Level Security is used for one purpose only: applying a confirmed plan change to a workspace."],
  ["How is workspace isolation enforced?", "Row Level Security policies on every table check the requesting user's organization membership before any row is returned or changed. This runs inside the database, so it does not depend on the interface hiding anything."],
  ["What is our data used for?", "Running your workspace: the screens, calculations, briefings and answers you ask for. When you run an AI feature, the workspace data needed for that request is sent to Google's Gemini API to produce the result."],
  ["Is customer data used to train shared models?", "No. SecureShield AI does not train or fine-tune models on customer data, and does not combine data across workspaces."],
  ["How are user roles handled?", "Each member is an owner, admin or member of a workspace. Role checks run in the database: row policies for records, and database functions for inviting, removing and changing members."],
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const signedIn = await isSignedIn();
  return (
    <>
      <Section tone="paper" className="!pb-0">
        <div className="grid items-center gap-12 pb-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:pb-24">
          <div>
            <p className="eyebrow">Governed revenue intelligence</p>
            <h1 className="mt-4 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-[3.5rem]">
              AI that reads your entire pipeline, inside a boundary only your organization can cross.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mute">
              SecureShield AI analyses your sales data, calls and accounts and turns them into briefings and next actions, with every workspace isolated at the database level and your data never used to train shared models.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <GetStarted size="lg" />
              <SignIn size="lg" />
            </div>
            <p className="mt-5 text-sm font-medium tracking-wide text-ink-700">Workspace isolation · Role-based access · Data ownership</p>
          </div>
          <IsolationDiagram />
        </div>
      </Section>

      <Section tone="ink">
        <SectionHead tone="ink" eyebrow="Three principles" title="Governed by design, not bolted on afterward." />
        <div className="grid gap-10 md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.t} className="border-t border-gold pt-5">
              <p className="font-mono text-sm text-gold">{p.n}</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold">{p.t}</h3>
              <p className="mt-3 text-base leading-relaxed text-ink-100/80">{p.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm">
          The mechanics are documented on the <Link href="/governance" className="underline decoration-gold decoration-2 underline-offset-4">Security &amp; Governance</Link> page.
        </p>
      </Section>

      <Section tone="paper">
        <SectionHead eyebrow="Who sees what" title="Three roles, enforced in the database.">
          <p>This table is generated from the same permission list the application enforces through Row Level Security policies and database functions.</p>
        </SectionHead>
        <PermissionsTable />
      </Section>

      <Section tone="light" id="platform">
        <SectionHead eyebrow="The platform" title="The full revenue loop, on your terms.">
          <p>Five modules that work from one governed set of records. Each result is labelled as either your data or AI-generated, so your team always knows which is which.</p>
        </SectionHead>
        <div className="grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <article key={m.name} className={`bg-paper-light p-7 ${i === 4 ? "lg:col-span-1" : ""}`}>
              <p className="font-mono text-xs text-gold-deep">0{i + 1}</p>
              <h3 className="mt-2 font-serif text-xl font-semibold">{m.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mute">{m.body}</p>
            </article>
          ))}
          <article className="bg-ink p-7 text-paper-light">
            <p className="font-mono text-xs text-gold">Conversation intelligence</p>
            <h3 className="mt-2 font-serif text-xl font-semibold">What a call analysis contains</h3>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {CONVERSATION_OUTPUTS.map((o) => <li key={o} className="flex items-center gap-2"><span className="h-1.5 w-1.5 bg-gold" />{o}</li>)}
            </ul>
            <p className="mt-4 text-xs text-ink-100/70">Produced from the conversation itself. Fields the conversation does not support are left empty, not filled in.</p>
          </article>
        </div>
      </Section>

      <Section tone="paper">
        <SectionHead eyebrow="For security and IT reviewers" title="Questions your security team will ask." />
        <div className="max-w-4xl divide-y divide-line border-y border-line">
          {QA.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-serif text-lg font-semibold">
                {q}
                <span aria-hidden className="mt-1 text-gold-deep transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-mute">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm text-mute">More detail, including what we do not claim, is on the <Link href="/governance" className="link">Security &amp; Governance</Link> page.</p>
      </Section>

      <Section tone="light" id="pricing">
        <SectionHead eyebrow="Pricing" title="One platform. Credits for how much you use it.">
          <p>Every plan includes every module. The only difference is the monthly credit allowance. The <Link href="/pricing" className="link">pricing page</Link> lists what each operation costs.</p>
        </SectionHead>
        <PlanCards signedIn={signedIn} tone="light" />
      </Section>

      <Section tone="ink">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl leading-tight font-semibold sm:text-4xl">Put AI on your pipeline without opening your data to anyone else.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <GetStarted size="lg" />
            <SignIn tone="dark" size="lg" />
          </div>
        </div>
      </Section>
    </>
  );
}
