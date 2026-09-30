import type { Metadata } from "next";
import { Section } from "@/components/marketing";
import { COMPANY_NAME, CONTACT_EMAIL } from "@/lib/env";

export const metadata: Metadata = { title: "Terms" };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-10 font-serif text-2xl font-semibold">{children}</h2>;

export default function TermsPage() {
  return (
    <Section tone="paper">
      <article className="max-w-3xl space-y-4 text-base leading-relaxed text-mute">
        <p className="eyebrow">Legal</p>
        <h1 className="text-4xl font-semibold text-ink">Terms</h1>
        <p>These terms govern your use of SecureShield AI, provided by {COMPANY_NAME}. By creating an account or using the service you agree to them. Questions: <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

        <H>The service</H>
        <p>SecureShield AI is a sales and revenue intelligence platform. It analyses data you add to your workspace and produces briefings, actions, scores and answers. It is not a cybersecurity product and makes no guarantee of any security outcome beyond the controls described on the Security &amp; Governance page.</p>

        <H>Your account and workspace</H>
        <p>You are responsible for the activity of the members you invite and for keeping sign-in details confidential. Workspace owners decide who is an admin or member.</p>

        <H>Your data</H>
        <p>You retain ownership of the data you add. You grant us permission to process it only to provide the service to you, including sending the data needed for an AI request to our AI provider. You are responsible for having the right to upload the data, including any call recordings, and for any notices or consents that recording requires.</p>

        <H>AI output</H>
        <p>AI-generated output may be incomplete or wrong. It is produced from your data and is labelled as AI-generated. Review it before acting; decisions remain yours.</p>

        <H>Plans, credits and payment</H>
        <p>The Free, Starter, Pro and Scale plans include a monthly credit allowance that is used by AI operations. Credits refresh each billing period and do not roll over. Payments are made through the payment link for your chosen plan and are handled by the payment provider. A plan change takes effect in your workspace when payment is confirmed.</p>

        <H>Acceptable use</H>
        <p>Do not use the service to break the law, to upload data you have no right to use, to attempt to access another organization&apos;s data, or to interfere with the service.</p>

        <H>Availability and liability</H>
        <p>We work to keep the service available but do not guarantee uninterrupted operation. To the extent permitted by law, the service is provided as is and our liability is limited to the fees you paid for the period in which the claim arose.</p>

        <H>Changes and termination</H>
        <p>We may update these terms and will publish the update on this page. You can stop using the service at any time; we may suspend accounts that breach these terms.</p>
      </article>
    </Section>
  );
}
