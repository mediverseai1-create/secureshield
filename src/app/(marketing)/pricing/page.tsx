import type { Metadata } from "next";
import { CreditCostTable, GetStarted, PlanCards, Section, SectionHead, SignIn, Tick } from "@/components/marketing";
import { ALL_PLANS, INCLUDED_FEATURES } from "@/lib/plans";
import { isSignedIn } from "@/lib/session";

export const metadata: Metadata = {
  title: "Pricing",
  description: "One platform. Credits for how much you use it. Starter $47, Pro $57 and Scale $97 per month, with monthly credit allowances.",
};

const FAQ = [
  ["What is a credit?", "A unit that pays for AI operations. Each operation has a fixed cost, listed above. Features calculated directly from your data — lead scores, insights, action finding, reports and imports — cost no credits."],
  ["What happens when credits run low?", "You see a warning well before the balance reaches zero, with an upgrade option. If credits run out, AI features pause until the next refresh or an upgrade; everything else keeps working."],
  ["Do unused credits roll over?", "No. Credits refresh at the start of each billing period."],
  ["What if an AI operation fails?", "The credits for that operation are refunded automatically and the refund appears in your usage history."],
  ["How do upgrades work?", "Upgrade buttons open a payment page in a new tab. Your plan and credits change only once the payment is confirmed and applied to your workspace."],
];

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const signedIn = await isSignedIn();
  return (
    <>
      <Section tone="paper" className="!pb-0">
        <div className="max-w-4xl pb-14 lg:pb-20">
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">One platform. Credits for how much you use it.</h1>
          <p className="mt-6 text-lg leading-relaxed text-mute">
            Every plan includes every module. The only difference between plans is the monthly credit allowance: plan, price, credits.
          </p>
        </div>
      </Section>

      <Section tone="light" className="!pt-10">
        <PlanCards signedIn={signedIn} tone="light" />
        <div className="mt-8 border border-line bg-paper p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl font-semibold">Free</h2>
              <p className="mt-1 text-sm text-mute">$0/month · {ALL_PLANS[0].credits.toLocaleString("en-US")} credits/month. Every new workspace starts here, with the same modules and a small credit allowance — enough to try briefings, call analysis and the assistant on your own data. When the credits are used, AI features pause until the next refresh or an upgrade.</p>
            </div>
            <GetStarted />
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <SectionHead eyebrow="Included on every plan" title="The same platform at every size." />
        <ul className="grid gap-3 text-base md:grid-cols-2">
          {INCLUDED_FEATURES.map((f) => <li key={f} className="flex gap-2 border-b border-line pb-3"><Tick />{f}</li>)}
          <li className="flex gap-2 border-b border-line pb-3"><Tick />Unlimited team members — credits are the only meter</li>
        </ul>
      </Section>

      <Section tone="light">
        <SectionHead eyebrow="Plan → price → monthly credits" title="What credits pay for.">
          <p>Fixed credit costs per operation. A plan&apos;s monthly credits can be spent on any mix.</p>
        </SectionHead>
        <CreditCostTable />
      </Section>

      <Section tone="paper">
        <SectionHead eyebrow="Questions" title="Credits, limits and upgrades." />
        <div className="max-w-4xl divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-serif text-lg font-semibold">
                {q}<span aria-hidden className="mt-1 text-gold-deep transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-mute">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section tone="ink">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl leading-tight font-semibold sm:text-4xl">Put AI on every sales call and every follow-up.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><GetStarted size="lg" /><SignIn tone="dark" size="lg" /></div>
        </div>
      </Section>
    </>
  );
}
