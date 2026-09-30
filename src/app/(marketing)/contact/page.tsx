import type { Metadata } from "next";
import { GetStarted, Section, SignIn } from "@/components/marketing";
import { COMPANY_NAME, CONTACT_EMAIL } from "@/lib/env";

export const metadata: Metadata = { title: "Contact", description: "Contact SecureShield AI for security reviews, questions and support." };

export default function ContactPage() {
  return (
    <Section tone="paper">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <div>
          <p className="eyebrow">Contact</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">Talk to us.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-mute">
            Questions from a security or IT review, questions about how a control works, or help with your workspace — write to us and a person will reply.
          </p>
          <p className="mt-8">
            <a className="font-serif text-2xl font-semibold underline decoration-gold decoration-2 underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="mt-2 text-sm text-mute">{COMPANY_NAME}</p>
        </div>
        <div className="border border-line bg-paper-light p-7">
          <h2 className="font-serif text-xl font-semibold">Helpful to include</h2>
          <ul className="mt-4 space-y-3 text-sm text-mute">
            <li><strong className="text-ink">For a security review:</strong> the questions on your checklist. We will answer from what is implemented and say plainly when something is not.</li>
            <li><strong className="text-ink">For support:</strong> your organization name and the email address you sign in with. Please never send passwords or API keys.</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3"><GetStarted /><SignIn /></div>
        </div>
      </div>
    </Section>
  );
}
