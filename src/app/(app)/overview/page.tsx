import type { Metadata } from "next";
import Link from "next/link";
import { requireApp } from "@/lib/context";
import { loadMembers, loadSnapshot, memberName } from "@/lib/data";
import { readParams, type SearchParams } from "@/lib/params";
import { accountRollup, hasAnyData, monthlySeries, periodMetrics, pipelineSummary, staleOpportunities, overdueOpportunities, weeklyActivity } from "@/lib/analytics";
import { scoreLead } from "@/lib/scoring";
import { dateShort, money, pct, relative } from "@/lib/format";
import { STAGE_LABELS, type ActionItem, type BriefingRow, type InsightRow } from "@/lib/types";
import { AreaSeries, BarSeries, Donut } from "@/components/charts";
import { AiLabel, DataLabel, EmptyState, PageHeader, Panel, PriorityBadge, ScrollTable, Stat, StatusBadge, StageBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Overview" };

const RANGES = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "12 months" },
];

const SEVERITY_CLASS: Record<string, string> = { risk: "border-risk", watch: "border-gold-deep", positive: "border-ok", info: "border-ink-500" };

export default async function OverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const app = await requireApp();
  const p = await readParams(searchParams);
  const range = RANGES.find((r) => r.value === p.range)?.value ?? "90";
  const days = Number(range);

  const [snap, members, actionsRes, briefingRes, insightsRes] = await Promise.all([
    loadSnapshot(app.supabase, app.org.id),
    loadMembers(app.supabase, app.org.id),
    app.supabase.from("actions").select("*").eq("org_id", app.org.id).eq("status", "open").order("created_at", { ascending: false }).limit(200),
    app.supabase.from("briefings").select("*").eq("org_id", app.org.id).order("created_at", { ascending: false }).limit(1),
    app.supabase.from("insights").select("*").eq("org_id", app.org.id).order("generated_at", { ascending: false }).limit(50),
  ]);
  const openActions = ((actionsRes.data ?? []) as ActionItem[]).sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]);
  const briefing = ((briefingRes.data ?? []) as BriefingRow[])[0];
  const insights = ((insightsRes.data ?? []) as InsightRow[]).sort((a, b) => ({ risk: 0, watch: 1, positive: 2, info: 3 })[a.severity] - ({ risk: 0, watch: 1, positive: 2, info: 3 })[b.severity]);

  const name = app.profile.full_name?.split(" ")[0];

  if (!hasAnyData(snap)) {
    return (
      <>
        <PageHeader title={`Welcome${name ? `, ${name}` : ""}`} description={`${app.org.name} has no data yet. Everything on this page is calculated from records you add — nothing is pre-filled.`} />
        <Panel>
          <EmptyState
            title="Start by adding your pipeline"
            body="Import a CSV export from your CRM or add opportunities, accounts and leads by hand. Once data exists, this page shows pipeline value, trends, deals that need attention and the latest briefing."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/pipeline" className="btn-primary">Open Pipeline</Link>
                <Link href="/accounts" className="btn-outline">Open Accounts</Link>
                <Link href="/leads" className="btn-outline">Open Leads</Link>
              </div>
            }
          />
        </Panel>
      </>
    );
  }

  const summary = pipelineSummary(snap.opportunities);
  const pm = periodMetrics(snap, days);
  const stale = staleOpportunities(snap).slice(0, 6);
  const overdue = overdueOpportunities(snap).length;
  const series = monthlySeries(snap, days >= 365 ? 12 : 6);
  const weekly = weeklyActivity(snap, 8);
  const rollup = accountRollup(snap).filter((r) => r.openValue > 0 || r.wonValue > 0).sort((a, b) => b.openValue + b.wonValue - (a.openValue + a.wonValue)).slice(0, 6);
  const scored = snap.leads.map((l) => scoreLead(l, snap.activities, snap.now));
  const bands = { hot: scored.filter((s) => s.band === "hot").length, warm: scored.filter((s) => s.band === "warm").length, cold: scored.filter((s) => s.band === "cold").length };
  const analysisBy = new Map(snap.analyses.map((a) => [a.conversation_id, a]));
  const recentConvs = snap.conversations.slice(-5).reverse();
  const acctName = new Map(snap.accounts.map((a) => [a.id, a.name]));

  return (
    <>
      <PageHeader
        title={`Overview${name ? ` · ${name}` : ""}`}
        description={`Revenue intelligence for ${app.org.name}. Figures are calculated from your workspace records; AI-generated content is labelled.`}
        actions={
          <div className="flex border border-line text-xs font-semibold" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <Link key={r.value} href={`/overview?range=${r.value}`} aria-current={r.value === range ? "true" : undefined} className={`px-3 py-2 ${r.value === range ? "bg-ink text-paper-light" : "hover:bg-paper-dark"}`}>
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="panel mb-6 grid grid-cols-2 lg:grid-cols-6">
        <Stat label="Open pipeline" value={money(summary.openValue, "USD", true)} sub={`${summary.openCount} deals`} />
        <Stat label="Weighted" value={money(summary.weightedValue, "USD", true)} sub="by probability" />
        <Stat label={`New pipeline (${range === "365" ? "12m" : range + "d"})`} value={money(pm.newPipeline.current, "USD", true)} change={pm.newPipeline.change} sub="vs prior" />
        <Stat label="Won" value={money(pm.wonValue.current, "USD", true)} change={pm.wonValue.change} sub="vs prior" />
        <Stat label="Activities" value={pm.activities.current} change={pm.activities.change} sub="vs prior" />
        <Stat label="Win rate" value={summary.winRate === null ? "—" : pct(summary.winRate)} sub={summary.wonCount + summary.lostCount ? `${summary.wonCount + summary.lostCount} closed` : "no closed deals"} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Pipeline by stage" description="Deal value in each stage" actions={<DataLabel />}>
          <BarSeries data={summary.byStage.map((s) => ({ stage: STAGE_LABELS[s.stage], value: s.value }))} xKey="stage" series={[{ key: "value", label: "Value" }]} height={230} />
        </Panel>
        <Panel title="Pipeline created vs won" description={`Monthly, last ${series.length} months`} actions={<DataLabel />}>
          <AreaSeries data={series} xKey="month" series={[{ key: "created", label: "Created", color: "#3d5a85" }, { key: "won", label: "Won", color: "#f0b429" }]} height={230} />
        </Panel>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Latest briefing" actions={<AiLabel />} flush>
          {briefing ? (
            <div className="p-4 text-sm">
              <p className="font-serif text-base font-semibold">{briefing.content.headline}</p>
              <p className="text-xs text-mute">{briefing.title}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {briefing.content.what_changed.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
              </ul>
              <Link href={`/briefings/${briefing.id}`} className="link mt-3 inline-block">Read the full briefing</Link>
            </div>
          ) : (
            <EmptyState compact title="No briefing yet" body="Generate a briefing to get a written summary of what changed and what needs attention." action={<Link href="/briefings" className="link">Go to Briefings</Link>} />
          )}
        </Panel>

        <Panel title="Recommended actions" description="Open items from your action queue" actions={<Link href="/actions" className="link text-sm">All actions</Link>} flush>
          {openActions.length === 0 ? (
            <EmptyState compact title="No open actions" body="Generate the action queue to find follow-ups from your pipeline and conversations." action={<Link href="/actions" className="link">Go to Actions</Link>} />
          ) : (
            <ul className="divide-y divide-line/70">
              {openActions.slice(0, 5).map((a) => (
                <li key={a.id} className="px-4 py-2.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{a.title}</span>
                    <PriorityBadge value={a.priority} />
                  </div>
                  {a.reason && <p className="mt-0.5 text-xs text-mute">{a.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Insights" description="Patterns found in your data" actions={<Link href="/insights" className="link text-sm">All insights</Link>} flush>
          {insights.length === 0 ? (
            <EmptyState compact title="No insights yet" body="Open Insights and refresh to analyse your data." action={<Link href="/insights" className="link">Go to Insights</Link>} />
          ) : (
            <ul className="divide-y divide-line/70">
              {insights.slice(0, 4).map((i) => (
                <li key={i.id} className={`border-l-4 px-4 py-2.5 text-sm ${SEVERITY_CLASS[i.severity]}`}>
                  <p className="font-medium">{i.title}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Deals requiring attention" description={`${stale.length ? "No activity in 14+ days" : "Nothing stalled"}${overdue ? ` · ${overdue} past close date` : ""}`} flush>
          {stale.length === 0 ? (
            <EmptyState compact title="No stalled deals" body="Every open deal has had activity or a stage change in the last 14 days." />
          ) : (
            <ScrollTable>
              <table className="tbl">
                <thead><tr><th>Deal</th><th>Stage</th><th className="text-right">Amount</th><th className="text-right">Idle</th><th>Owner</th></tr></thead>
                <tbody>
                  {stale.map(({ opp, idleDays }) => (
                    <tr key={opp.id}>
                      <td><Link href={`/pipeline/${opp.id}`} className="font-medium hover:underline">{opp.name}</Link><p className="text-xs text-mute">{acctName.get(opp.account_id ?? "") ?? ""}</p></td>
                      <td><StageBadge stage={opp.stage} /></td>
                      <td className="text-right tabular-nums">{money(Number(opp.amount))}</td>
                      <td className="text-right tabular-nums text-watch">{idleDays}d</td>
                      <td>{memberName(members, opp.owner_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          )}
        </Panel>

        <Panel title="Important accounts" description="By open and won value" flush>
          {rollup.length === 0 ? (
            <EmptyState compact title="No account pipeline yet" body="Link opportunities to accounts to see them here." />
          ) : (
            <ScrollTable>
              <table className="tbl">
                <thead><tr><th>Account</th><th>Status</th><th className="text-right">Open</th><th className="text-right">Won</th><th>Last activity</th></tr></thead>
                <tbody>
                  {rollup.map((r) => (
                    <tr key={r.account.id}>
                      <td><Link href={`/accounts/${r.account.id}`} className="font-medium hover:underline">{r.account.name}</Link></td>
                      <td><StatusBadge value={r.account.status} /></td>
                      <td className="text-right tabular-nums">{money(r.openValue, "USD", true)}</td>
                      <td className="text-right tabular-nums">{money(r.wonValue, "USD", true)}</td>
                      <td className="text-mute">{relative(r.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Recent conversations" actions={<Link href="/conversations" className="link text-sm">All</Link>} flush>
          {recentConvs.length === 0 ? (
            <EmptyState compact title="No conversations" body="Add a call recording or transcript." />
          ) : (
            <ul className="divide-y divide-line/70">
              {recentConvs.map((c) => {
                const a = analysisBy.get(c.id);
                return (
                  <li key={c.id} className="px-4 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/conversations/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                      {a?.sentiment ? <StatusBadge value={a.sentiment} /> : <StatusBadge value={c.status} />}
                    </div>
                    <p className="text-xs text-mute">{dateShort(c.occurred_at)}{c.account_id ? ` · ${acctName.get(c.account_id)}` : ""}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Lead score overview" description={snap.leads.length ? `${snap.leads.length} leads` : undefined} actions={<Link href="/leads" className="link text-sm">Leads</Link>}>
          {snap.leads.length === 0 ? (
            <EmptyState compact title="No leads" body="Add leads to see score bands." />
          ) : (
            <Donut height={190} data={[{ name: "Hot", value: bands.hot, color: "#2b7a55" }, { name: "Warm", value: bands.warm, color: "#f0b429" }, { name: "Cold", value: bands.cold, color: "#8a94a1" }].filter((d) => d.value > 0)} />
          )}
        </Panel>
        <Panel title="Sales activity" description="Logged activities per week" actions={<DataLabel />}>
          <BarSeries data={weekly} xKey="week" series={[{ key: "count", label: "Activities", color: "#3d5a85" }]} kind="count" height={190} />
        </Panel>
      </div>
    </>
  );
}
