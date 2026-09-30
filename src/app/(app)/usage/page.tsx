import type { Metadata } from "next";
import { requireApp } from "@/lib/context";
import { loadMembers, memberName } from "@/lib/data";
import { CREDIT_ACTION_LABELS, CREDIT_COSTS, PLANS, capacity, creditState } from "@/lib/plans";
import { addDays, dateShort, dateTime, isoDay, num } from "@/lib/format";
import type { CreditUsageRow } from "@/lib/types";
import { BarSeries } from "@/components/charts";
import { UpgradeButtons } from "@/components/upgrade";
import { Alert, EmptyState, PageHeader, Panel, ScrollTable, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Usage" };

export default async function UsagePage() {
  const app = await requireApp();
  const [members, { data }] = await Promise.all([
    loadMembers(app.supabase, app.org.id),
    app.supabase.from("credit_usage").select("*").eq("org_id", app.org.id).order("created_at", { ascending: false }).limit(1000),
  ]);
  const rows = (data ?? []) as CreditUsageRow[];
  const c = app.credits;
  const plan = PLANS[c.plan];
  const used = c.monthly_allocation - c.balance;
  const pctUsed = c.monthly_allocation ? Math.min(100, Math.max(0, (used / c.monthly_allocation) * 100)) : 0;
  const state = creditState(c.balance, c.monthly_allocation);

  const periodStart = new Date(c.period_start);
  const inPeriod = rows.filter((r) => new Date(r.created_at) >= periodStart);
  const debits = inPeriod.filter((r) => r.kind === "debit" && !r.refunded);
  const byAction = new Map<string, { credits: number; count: number }>();
  for (const r of debits) {
    const cur = byAction.get(r.action) ?? { credits: 0, count: 0 };
    byAction.set(r.action, { credits: cur.credits + r.credits, count: cur.count + 1 });
  }

  const now = new Date();
  const daily = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(now, -(29 - i));
    const key = isoDay(d);
    return {
      day: d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      credits: rows.filter((r) => r.kind === "debit" && !r.refunded && r.created_at.slice(0, 10) === key).reduce((s, r) => s + r.credits, 0),
    };
  });
  const cap = capacity(plan);

  return (
    <>
      <PageHeader title="Usage" description="Credits are deducted when an AI operation runs and recorded in the ledger below. Scoring, insights, action finding and reports use your data directly and cost nothing." />

      {state !== "ok" && (
        <div className="mb-6">
          <Alert kind="warn" title={state === "empty" ? "You have used all of your credits" : "You are running low on monthly AI credits"}>
            {num(c.balance)} of {num(c.monthly_allocation)} credits remain. Credits refresh on {dateShort(c.period_end)}.
          </Alert>
        </div>
      )}

      <div className="panel mb-6 grid grid-cols-2 lg:grid-cols-4">
        <Stat label="Current balance" value={num(c.balance)} sub="credits" />
        <Stat label="Monthly allocation" value={num(c.monthly_allocation)} sub={`${plan.name} plan`} />
        <Stat label="Used this period" value={num(Math.max(0, used))} sub={`${Math.round(pctUsed)}% of allocation`} />
        <Stat label="Remaining" value={num(c.balance)} sub={`refreshes ${dateShort(c.period_end)}`} />
      </div>

      <div className="panel mb-6 px-4 py-4">
        <div className="mb-2 flex justify-between text-xs text-mute">
          <span>Billing period {dateShort(c.period_start)} – {dateShort(c.period_end)}</span>
          <span className="tabular-nums">{num(Math.max(0, used))} / {num(c.monthly_allocation)} used</span>
        </div>
        <div className="h-2.5 bg-paper-dark" role="progressbar" aria-label="Credits used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pctUsed)}>
          <div className={`h-full ${state === "ok" ? "bg-ink" : "bg-risk"}`} style={{ width: `${pctUsed}%` }} />
        </div>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Credits used per day" description="Last 30 days">
          <BarSeries data={daily} xKey="day" series={[{ key: "credits", label: "Credits used", color: "#0b1f3a" }]} kind="count" height={220} />
        </Panel>
        <Panel title="This period by action" flush>
          {byAction.size === 0 ? (
            <EmptyState compact title="No credits used yet" />
          ) : (
            <table className="tbl">
              <thead><tr><th>Action</th><th className="text-right">Runs</th><th className="text-right">Credits</th></tr></thead>
              <tbody>
                {[...byAction.entries()].sort((a, b) => b[1].credits - a[1].credits).map(([k, v]) => (
                  <tr key={k}><td>{CREDIT_ACTION_LABELS[k] ?? k}</td><td className="text-right tabular-nums">{v.count}</td><td className="text-right tabular-nums">{num(v.credits)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Panel title="What credits pay for" description="Fixed cost per operation">
          <table className="tbl">
            <thead><tr><th>Operation</th><th className="text-right">Credits</th><th className="text-right">Your plan allows about</th></tr></thead>
            <tbody>
              <tr><td>AI briefing</td><td className="text-right tabular-nums">{CREDIT_COSTS.briefing}</td><td className="text-right tabular-nums">{num(cap.briefings)} / month</td></tr>
              <tr><td>Conversation analysis</td><td className="text-right tabular-nums">{CREDIT_COSTS.conversation_analysis}</td><td className="text-right tabular-nums">{num(cap.analyses)} / month</td></tr>
              <tr><td>AI Assistant question</td><td className="text-right tabular-nums">{CREDIT_COSTS.assistant_question}</td><td className="text-right tabular-nums">{num(cap.questions)} / month</td></tr>
              <tr><td>Follow-up draft</td><td className="text-right tabular-nums">{CREDIT_COSTS.followup_draft}</td><td className="text-right tabular-nums">{num(Math.floor(plan.credits / CREDIT_COSTS.followup_draft))} / month</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-mute">Capacity figures are the allocation divided by the cost; you can mix operations. A failed operation is refunded automatically. Unused credits do not roll over.</p>
        </Panel>
        <Panel title="Upgrade" description={`You are on the ${plan.name} plan`}>
          <div id="upgrade" className="space-y-3 text-sm">
            <p className="text-mute">Upgrades open your payment page in a new tab. Your plan and credits change only after the payment is confirmed — opening the page alone changes nothing.</p>
            <UpgradeButtons current={c.plan} size="md" />
          </div>
        </Panel>
      </div>

      <Panel title="Credit history" description="Every debit, refund and allowance — newest first" flush>
        {rows.length === 0 ? (
          <EmptyState compact title="No credit activity yet" />
        ) : (
          <ScrollTable>
            <table className="tbl min-w-[760px]">
              <thead><tr><th>When</th><th>Type</th><th>Action</th><th>Detail</th><th>By</th><th className="text-right">Credits</th><th className="text-right">Balance after</th></tr></thead>
              <tbody>
                {rows.slice(0, 100).map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-mute">{dateTime(r.created_at)}</td>
                    <td><span className={r.kind === "debit" ? "badge-neutral" : r.kind === "refund" ? "badge-ok" : "badge-gold"}>{r.kind}</span></td>
                    <td>{CREDIT_ACTION_LABELS[r.action] ?? r.action}</td>
                    <td className="max-w-xs truncate text-mute">{r.description ?? ""}</td>
                    <td>{r.user_id ? memberName(members, r.user_id) : "System"}</td>
                    <td className={`text-right tabular-nums ${r.kind === "debit" ? "" : "text-ok"}`}>{r.kind === "debit" ? `−${num(r.credits)}` : `+${num(r.credits)}`}</td>
                    <td className="text-right tabular-nums">{num(r.balance_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
      </Panel>
    </>
  );
}
