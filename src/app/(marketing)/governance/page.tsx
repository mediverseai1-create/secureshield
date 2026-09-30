import type { Metadata } from "next";
import Link from "next/link";
import { GetStarted, Section, SectionHead, SignIn, Tick } from "@/components/marketing";
import { PermissionsTable } from "@/components/permissions-table";

export const metadata: Metadata = {
  title: "Security & Governance",
  description: "How SecureShield AI isolates workspaces at the database level, controls access by role, and keeps customer data with the customer.",
};

const TABLES = [
  "accounts", "contacts", "leads", "opportunities", "opportunity stage history", "sales activities", "conversations", "conversation analyses",
  "briefings", "actions", "insights", "reports", "assistant history", "data imports", "activity log", "credit balances and usage", "subscriptions",
];

const CHECKLIST: [string, string][] = [
  ["Workspace isolation", "Row Level Security is enabled on every table that holds customer data. Policies compare each row's organization to the organizations the signed-in user belongs to."],
  ["Isolation of references", "Links between records (an opportunity to its account, for example) use composite foreign keys that include the organization, so a record cannot point at another organization's record."],
  ["Immutable ownership", "The organization on a record cannot be changed after creation; a database trigger rejects the update."],
  ["Role-based access", "Owner, admin and member roles are stored per workspace. Deleting records, managing members and changing roles are restricted by policy and by database functions."],
  ["File isolation", "Call recordings are stored in a private bucket. Storage policies allow access only to objects in a folder named for an organization the user belongs to."],
  ["Authentication", "Sign-up, sign-in, sign-out and password reset are handled by Supabase Auth. Sessions are maintained with cookies, and every application route except the public pages requires a signed-in user."],
  ["Secrets", "The Gemini API key and the service-role key are read on the server only and are never sent to the browser or committed to the repository."],
  ["Credit and plan integrity", "Credit balances and subscriptions cannot be written by users. Credits are deducted by a database function, and plan changes can only be applied by a server-side call authenticated with a secret."],
  ["Audit trail", "Changes to records, AI runs, imports and team changes are written to an activity log visible to workspace members. Members cannot edit or delete entries."],
];

export default function GovernancePage() {
  return (
    <>
      <Section tone="paper" className="!pb-0">
        <div className="max-w-4xl pb-14 lg:pb-20">
          <p className="eyebrow">Security &amp; Governance</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">A boundary enforced where the data lives.</h1>
          <p className="mt-6 text-lg leading-relaxed text-mute">
            SecureShield AI is a sales and revenue intelligence platform. Its governance is part of how it is built: each workspace is isolated in the database, access depends on role, and files, calls and conversations belong to the workspace that created them. This page describes only what is implemented.
          </p>
          <div className="mt-8 flex flex-wrap gap-3"><GetStarted size="lg" /><SignIn size="lg" /></div>
        </div>
      </Section>

      <Section tone="ink">
        <div className="grid gap-12 md:grid-cols-3">
          <div className="border-t border-gold pt-5">
            <h2 className="font-serif text-2xl font-semibold">Isolation</h2>
            <p className="mt-3 text-ink-100/80">Every query is scoped to your organization through Row Level Security in the database. The checks run in PostgreSQL on every read and write, not only in the screens.</p>
          </div>
          <div className="border-t border-gold pt-5">
            <h2 className="font-serif text-2xl font-semibold">Access</h2>
            <p className="mt-3 text-ink-100/80">Owners, admins and members work in the same system with the appropriate level of control. Role checks are made by the database.</p>
          </div>
          <div className="border-t border-gold pt-5">
            <h2 className="font-serif text-2xl font-semibold">Ownership</h2>
            <p className="mt-3 text-ink-100/80">Files, calls and conversations belong to your workspace and are not mixed with another organization&apos;s data. SecureShield AI does not train models on them.</p>
          </div>
        </div>
      </Section>

      <Section tone="light">
        <SectionHead eyebrow="How isolation works" title="Row Level Security, on every customer table.">
          <p>
            Row Level Security (RLS) is a PostgreSQL feature that attaches a rule to a table. Whenever anyone queries that table, the database applies the rule to every row. SecureShield AI&apos;s rule for customer data is simple: a row is visible only if its organization is one the signed-in user belongs to.
          </p>
        </SectionHead>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 font-serif text-xl font-semibold">Tables covered</h3>
            <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {TABLES.map((t) => <li key={t} className="flex gap-2"><Tick />{t}</li>)}
            </ul>
            <p className="mt-4 text-sm text-mute">Organization membership, invitations and profiles are also protected by policy; a user can only see people who share a workspace with them.</p>
          </div>
          <div className="border border-line bg-paper p-6">
            <h3 className="font-serif text-xl font-semibold">What this means in practice</h3>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-mute">
              <li>A user in Organization A cannot read, change or delete Organization B&apos;s rows — even by calling the database API directly.</li>
              <li>The AI Assistant and every AI feature load data through the signed-in user&apos;s session, so they only ever see that user&apos;s workspace.</li>
              <li>Hiding a button is never the only control. If the interface were bypassed, the database would still refuse.</li>
            </ul>
            <p className="mt-4 text-xs text-mute">The repository includes an automated test that applies the migrations to a database and verifies these properties, including cross-organization reads, writes, deletes and file access.</p>
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <SectionHead eyebrow="Access control" title="Who sees what.">
          <p>Three roles. The table below is generated from the permission list used by the application; the right-hand column names the mechanism that enforces each row.</p>
        </SectionHead>
        <PermissionsTable showEnforcement />
        <p className="mt-4 max-w-3xl text-sm text-mute">
          Members join by invitation tied to a specific email address. The owner role cannot be removed or reassigned in the application.
        </p>
      </Section>

      <Section tone="light">
        <SectionHead eyebrow="Your data and AI" title="What happens when you run an AI feature." />
        <div className="grid gap-10 md:grid-cols-2">
          <div className="space-y-4 text-base leading-relaxed text-mute">
            <p>Briefings, conversation analysis, drafted follow-ups and AI Assistant answers are produced by Google&apos;s Gemini API. The request is made from SecureShield AI&apos;s server, never from your browser, and includes only the workspace data needed for that request.</p>
            <p>SecureShield AI does not train or fine-tune models on customer data and does not pool data across workspaces. Briefings store the exact figures they were written from, so each statement can be checked against raw data.</p>
            <p>AI output is labelled as AI-generated everywhere it appears, and is always separate from the records themselves.</p>
          </div>
          <div className="border border-line bg-paper p-6">
            <h3 className="font-serif text-lg font-semibold">Infrastructure used</h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="font-semibold">Supabase</dt><dd className="text-mute">Authentication, PostgreSQL database and private file storage.</dd></div>
              <div><dt className="font-semibold">Google Gemini API</dt><dd className="text-mute">Generates AI output for the features above, when you run them.</dd></div>
            </dl>
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <SectionHead eyebrow="Checklist" title="Controls implemented." />
        <div className="overflow-x-auto border border-line bg-paper-light">
          <table className="tbl min-w-[640px]">
            <thead><tr><th className="w-56">Control</th><th>How it works</th></tr></thead>
            <tbody>
              {CHECKLIST.map(([c, d]) => <tr key={c}><td className="font-medium">{c}</td><td className="text-mute">{d}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Section>

      <Section tone="light">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold">What this page does not claim</h2>
          <p className="mt-3 text-base leading-relaxed text-mute">
            SecureShield AI is a revenue intelligence platform, not a cybersecurity product. It does not perform threat detection, security monitoring or penetration testing, and this page makes no claim of third-party security certification or regulatory compliance. If your review requires specific evidence, <Link href="/contact" className="link">contact us</Link> and ask.
          </p>
        </div>
      </Section>

      <Section tone="ink">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl leading-tight font-semibold sm:text-4xl">Put AI on your pipeline without opening your data to anyone else.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><GetStarted size="lg" /><SignIn tone="dark" size="lg" /></div>
        </div>
      </Section>
    </>
  );
}
