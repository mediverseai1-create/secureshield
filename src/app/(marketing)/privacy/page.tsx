import type { Metadata } from "next";
import { Section } from "@/components/marketing";
import { COMPANY_NAME, CONTACT_EMAIL } from "@/lib/env";

export const metadata: Metadata = { title: "Privacy" };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-10 font-serif text-2xl font-semibold">{children}</h2>;

export default function PrivacyPage() {
  return (
    <Section tone="paper">
      <article className="max-w-3xl space-y-4 text-base leading-relaxed text-mute">
        <p className="eyebrow">Legal</p>
        <h1 className="text-4xl font-semibold text-ink">Privacy</h1>
        <p>This page explains what information SecureShield AI handles, why, and who it is shared with. “We” means {COMPANY_NAME}. Questions: <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

        <H>Information we handle</H>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-ink">Account information:</strong> your name, work email address, job title, role, organization details and the goals you choose during setup.</li>
          <li><strong className="text-ink">Workspace data you add:</strong> accounts, contacts, leads, opportunities, activities, call recordings, transcripts and notes, together with the analyses, briefings, actions, insights and reports produced from them.</li>
          <li><strong className="text-ink">Usage records:</strong> credit usage, activity logs of changes made in a workspace, and subscription status.</li>
        </ul>

        <H>How we use it</H>
        <p>Workspace data is used to run your workspace: to display it, calculate figures from it and, when you run an AI feature, to produce the output you asked for. We do not use customer data to train or fine-tune models, and we do not combine data across workspaces. We do not sell customer data.</p>

        <H>Who it is shared with</H>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-ink">Supabase</strong> provides authentication, the database and file storage on which the service runs.</li>
          <li><strong className="text-ink">Google (Gemini API)</strong> receives the workspace data needed for a specific request when you run an AI feature, in order to generate the result.</li>
          <li>Payments are handled by the payment provider behind the payment link you choose. We do not collect card details.</li>
        </ul>

        <H>Isolation and access</H>
        <p>Each workspace is isolated from every other at the database level, and access within a workspace depends on role. Details are on the Security &amp; Governance page.</p>

        <H>Retention and deletion</H>
        <p>Workspace data is kept while the workspace exists. Owners and admins can delete records, conversations and recordings inside the application. To request deletion of a workspace or an account, write to us at the address above.</p>

        <H>Your choices</H>
        <p>You can update your profile in Settings. To ask about, correct or delete personal information we hold, contact us and we will respond.</p>

        <H>Changes</H>
        <p>We will update this page when our practices change.</p>
      </article>
    </Section>
  );
}
