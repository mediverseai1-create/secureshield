import Link from "next/link";
import { getPaymentLinks } from "@/lib/env";
import { ALL_PLANS, PAID_PLANS, PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/types";

/**
 * Upgrade buttons. They open the owner's payment link for the plan in a new tab.
 * Opening a payment link does not change the workspace's plan: the plan changes only after payment is confirmed
 * and applied server-side (see /api/billing/webhook).
 */
export function UpgradeButtons({ current, size = "sm" }: { current: PlanId; size?: "sm" | "md" }) {
  const links = getPaymentLinks();
  const rank = ALL_PLANS.findIndex((p) => p.id === current);
  const targets = PAID_PLANS.filter((p) => ALL_PLANS.findIndex((x) => x.id === p.id) > rank);
  if (!targets.length) return <span className="text-xs text-mute">You are on the highest plan.</span>;
  const cls = size === "sm" ? "btn-sm" : "";
  return (
    <div className="flex flex-wrap gap-2">
      {targets.map((p, i) => {
        const href = links[p.id as "starter" | "pro" | "scale"];
        const label = `Upgrade to ${p.name} · $${p.priceUsd}/mo`;
        return href ? (
          <a key={p.id} href={href} target="_blank" rel="noopener noreferrer" className={`${i === 0 ? "btn-primary" : "btn-outline"} ${cls}`}>
            {label}
          </a>
        ) : (
          <span key={p.id} className={`btn-outline ${cls} cursor-not-allowed opacity-60`} title="The payment link for this plan has not been configured yet.">
            {label} (link not configured)
          </span>
        );
      })}
    </div>
  );
}

export function LowCreditBanner({ balance, allocation, plan }: { balance: number; allocation: number; plan: PlanId }) {
  const empty = balance <= 0;
  return (
    <div className="no-print mb-6 flex flex-col gap-3 border border-gold-deep/50 bg-gold-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="status">
      <p className="text-sm text-ink">
        <strong>{empty ? "You have used all of your monthly AI credits." : "You are running low on monthly AI credits."}</strong>{" "}
        {balance.toLocaleString("en-US")} of {allocation.toLocaleString("en-US")} credits remain on the {PLANS[plan].name} plan.{" "}
        {empty ? "AI features are paused until credits refresh or you upgrade." : "Briefings, conversation analysis and assistant questions use credits."}{" "}
        <Link href="/usage" className="link">
          View usage
        </Link>
      </p>
      <UpgradeButtons current={plan} />
    </div>
  );
}
