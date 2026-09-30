import type { Metadata } from "next";
import { requireApp } from "@/lib/context";
import { getPaymentLinks } from "@/lib/env";
import { ALL_PLANS, INCLUDED_FEATURES, PLANS, capacity } from "@/lib/plans";
import { dateShort, num, titleCase } from "@/lib/format";
import { readParams, type SearchParams } from "@/lib/params";
import { Alert, PageHeader, Panel, Stat, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Subscription" };

export default async function SubscriptionPage({ searchParams }: { searchParams: SearchParams }) {
  const app = await requireApp();
  const p = await readParams(searchParams);
  const links = getPaymentLinks();
  const current = PLANS[app.credits.plan];
  const status = app.subscription?.status ?? "free";
  const rank = ALL_PLANS.findIndex((x) => x.id === current.id);
  const highlight = p.plan;

  return (
    <>
      <PageHeader title="Subscription" description="Your plan, its monthly credits and the options to change it." />

      {highlight && highlight !== current.id && (
        <div className="mb-6"><Alert kind="info" title={`You chose the ${PLANS[highlight as keyof typeof PLANS]?.name ?? ""} plan`}>Use the upgrade button below to open the payment page. Your plan changes only after the payment is confirmed.</Alert></div>
      )}

      <div className="panel mb-6 grid grid-cols-2 lg:grid-cols-5">
        <Stat label="Current plan" value={current.name} />
        <Stat label="Price" value={current.priceUsd === 0 ? "$0" : `$${current.priceUsd}/mo`} />
        <Stat label="Monthly credits" value={num(app.credits.monthly_allocation)} />
        <Stat label="Credits remaining" value={num(app.credits.balance)} sub={`refresh ${dateShort(app.credits.period_end)}`} />
        <div className="border-l border-line px-4 py-3">
          <p className="text-xs font-semibold tracking-wide text-mute uppercase">Status</p>
          <div className="mt-2"><StatusBadge value={status} /></div>
          {app.subscription?.current_period_end && <p className="mt-1 text-xs text-mute">Period ends {dateShort(app.subscription.current_period_end)}</p>}
        </div>
      </div>

      <div className="mb-6 grid gap-px border border-line bg-line lg:grid-cols-4">
        {ALL_PLANS.map((pl, i) => {
          const isCurrent = pl.id === current.id;
          const href = pl.id === "free" ? null : links[pl.id as "starter" | "pro" | "scale"];
          const cap = capacity(pl);
          return (
            <div key={pl.id} className={`flex flex-col bg-paper-light p-5 ${isCurrent ? "ring-2 ring-inset ring-gold" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold">{pl.name}</h2>
                {isCurrent && <span className="badge-gold">Current</span>}
              </div>
              <p className="mt-2 font-serif text-3xl font-semibold">{pl.priceUsd === 0 ? "$0" : `$${pl.priceUsd}`}<span className="text-sm font-normal text-mute">/month</span></p>
              <p className="mt-1 text-sm font-semibold">{num(pl.credits)} credits / month</p>
              <p className="mt-1 text-xs text-mute">≈ {num(cap.briefings)} briefings or {num(cap.analyses)} call analyses</p>
              <div className="mt-auto pt-5">
                {isCurrent ? (
                  <span className="text-xs text-mute">Your current plan</span>
                ) : i < rank ? (
                  <span className="text-xs text-mute">Lower than your current plan</span>
                ) : href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">Upgrade to {pl.name}</a>
                ) : (
                  <span className="btn-outline w-full cursor-not-allowed opacity-60" title="The payment link for this plan has not been configured yet.">Payment link not configured</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Included on every plan">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">{INCLUDED_FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
          <p className="mt-3 text-xs text-mute">The only difference between plans is the monthly credit allowance. Credits refresh every billing period; unused credits do not roll over.</p>
        </Panel>
        <Panel title="How upgrades are applied">
          <div className="space-y-2 text-sm text-mute">
            <p>Upgrade buttons open your payment page in a new tab. SecureShield AI does not process payments itself.</p>
            <p>A plan change is applied to your workspace only when the payment is confirmed and recorded server-side. Until then this page continues to show <strong className="text-ink">{titleCase(current.id)}</strong>.</p>
            {app.subscription?.provider && <p>Billing provider on record: {app.subscription.provider}.</p>}
          </div>
        </Panel>
      </div>
    </>
  );
}
