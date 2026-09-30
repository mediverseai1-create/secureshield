import type { Metadata } from "next";
import Link from "next/link";
import { GetStarted, Section, SectionHead, SignIn } from "@/components/marketing";

export const metadata: Metadata = {
  title: "About",
  description: "Why SecureShield AI exists: revenue intelligence for organizations that will not trade control of their data for insight.",
};

export default function AboutPage() {
  return (
    <>
      <Section tone="paper">
        <div className="max-w-3xl">
          <p className="eyebrow">About</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">Insight on the pipeline, without giving up the data.</h1>
          <div className="mt-6 space-y-5 text-lg leading-relaxed text-mute">
            <p>
              Sales teams in finance, legal, professional services and enterprise services hold some of the most sensitive information their organizations have: who the clients are, what is being negotiated and what was said on the call. Those are exactly the teams that stand to gain most from AI that can read the whole pipeline — and the teams least able to accept a tool that mixes their data with anyone else&apos;s.
            </p>
            <p>
              SecureShield AI is built for that position. It is a revenue intelligence platform that reads your pipeline, calls and accounts and turns them into briefings and next actions. Governance is part of its architecture rather than a feature added later: each workspace is isolated in the database, access depends on role, and the files, calls and conversations inside a workspace belong to it.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="light">
        <SectionHead eyebrow="How we work" title="Principles we build to." />
        <dl className="grid gap-px border border-line bg-line md:grid-cols-2">
          {[
            ["Say only what is true", "If a control is not implemented, it is not claimed. We hold no third-party certifications and do not suggest otherwise."],
            ["Show the evidence", "AI output is labelled, separate from raw data, and briefings keep the figures they were written from."],
            ["Keep people in charge", "The AI reads, remembers and writes. Your team reviews and decides. Nothing is sent or changed on your behalf."],
            ["Enforce it in the database", "Access rules that only live in the interface can be bypassed. Ours live where the data does."],
          ].map(([t, d]) => (
            <div key={t} className="bg-paper-light p-7">
              <dt className="font-serif text-xl font-semibold">{t}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-mute">{d}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section tone="paper">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold">What SecureShield AI is not</h2>
          <p className="mt-3 text-base leading-relaxed text-mute">
            It is a sales and revenue platform, not a cybersecurity product: it does not monitor networks, detect threats or test for vulnerabilities. Its security story is narrow and specific — isolation, access control and data ownership inside the application — and is described in full on the <Link href="/governance" className="link">Security &amp; Governance</Link> page.
          </p>
          <div className="mt-8 flex flex-wrap gap-3"><GetStarted /><SignIn /></div>
        </div>
      </Section>
    </>
  );
}
