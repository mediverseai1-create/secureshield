import { daysBetween, money, pct } from "./format";
import {
  STALE_DAYS,
  accountRollup,
  conversationPatterns,
  isOpen,
  lostReasons,
  overdueOpportunities,
  periodMetrics,
  pipelineSummary,
  staleOpportunities,
  type Snapshot,
} from "./analytics";

export interface GeneratedInsight {
  kind: string;
  severity: "info" | "watch" | "risk" | "positive";
  title: string;
  body: string;
  evidence: Record<string, unknown>;
}

/**
 * Deterministic pattern detection. Every insight is computed from stored records and carries the
 * numbers it was derived from in `evidence`. Nothing is generated when the data does not support it.
 */
export function generateInsights(snap: Snapshot): GeneratedInsight[] {
  const out: GeneratedInsight[] = [];
  const summary = pipelineSummary(snap.opportunities);

  const stale = staleOpportunities(snap);
  if (stale.length) {
    const value = stale.reduce((s, x) => s + Number(x.opp.amount), 0);
    out.push({
      kind: "stalled_opportunities",
      severity: stale.length >= 3 || (summary.openValue > 0 && value / summary.openValue > 0.3) ? "risk" : "watch",
      title: `${stale.length} open ${stale.length === 1 ? "opportunity has" : "opportunities have"} had no activity for ${STALE_DAYS}+ days`,
      body: `${money(value)} of open pipeline${summary.openValue ? ` (${pct((value / summary.openValue) * 100)} of the open total)` : ""} shows no logged activity or stage change in at least ${STALE_DAYS} days. Largest: ${stale
        .slice(0, 3)
        .map((x) => `${x.opp.name} (${money(Number(x.opp.amount))}, idle ${x.idleDays}d)`)
        .join("; ")}.`,
      evidence: { count: stale.length, value, ids: stale.slice(0, 10).map((x) => x.opp.id) },
    });
  }

  const overdue = overdueOpportunities(snap);
  if (overdue.length) {
    const value = overdue.reduce((s, x) => s + Number(x.opp.amount), 0);
    out.push({
      kind: "overdue_close_dates",
      severity: "watch",
      title: `${overdue.length} open ${overdue.length === 1 ? "deal is" : "deals are"} past the expected close date`,
      body: `${money(value)} is tied to opportunities whose expected close date has passed. Either the date needs updating or the deal needs attention: ${overdue
        .slice(0, 3)
        .map((x) => `${x.opp.name} (${x.overdueDays}d overdue)`)
        .join("; ")}.`,
      evidence: { count: overdue.length, value, ids: overdue.slice(0, 10).map((x) => x.opp.id) },
    });
  }

  const open = snap.opportunities.filter(isOpen);
  if (open.length >= 3 && summary.openValue > 0) {
    const byAccount = new Map<string, number>();
    for (const o of open) {
      const key = o.account_id ?? `none:${o.id}`;
      byAccount.set(key, (byAccount.get(key) ?? 0) + Number(o.amount));
    }
    const [topKey, topValue] = [...byAccount.entries()].sort((a, b) => b[1] - a[1])[0];
    const share = (topValue / summary.openValue) * 100;
    if (share >= 40 && !topKey.startsWith("none:")) {
      const name = snap.accounts.find((a) => a.id === topKey)?.name ?? "one account";
      out.push({
        kind: "concentration",
        severity: "risk",
        title: `${pct(share)} of open pipeline sits with ${name}`,
        body: `${money(topValue)} of ${money(summary.openValue)} in open pipeline belongs to a single account. Losing or delaying it would move the total materially.`,
        evidence: { account_id: topKey, value: topValue, share },
      });
    }
  }

  const p30 = periodMetrics(snap, 30);
  if (p30.newPipeline.previous > 0 && p30.newPipeline.change !== null && Math.abs(p30.newPipeline.change) >= 20) {
    const up = p30.newPipeline.change > 0;
    out.push({
      kind: "pipeline_creation_change",
      severity: up ? "positive" : "watch",
      title: `New pipeline created is ${up ? "up" : "down"} ${pct(Math.abs(p30.newPipeline.change))} on the previous 30 days`,
      body: `${money(p30.newPipeline.current)} of opportunities were created in the last 30 days, against ${money(p30.newPipeline.previous)} in the 30 days before.`,
      evidence: { ...p30.newPipeline },
    });
  }

  if (p30.activities.previous >= 5 && p30.activities.change !== null && Math.abs(p30.activities.change) >= 25) {
    const up = p30.activities.change > 0;
    out.push({
      kind: "activity_change",
      severity: up ? "positive" : "watch",
      title: `Logged sales activity is ${up ? "up" : "down"} ${pct(Math.abs(p30.activities.change))} month on month`,
      body: `${p30.activities.current} activities were logged in the last 30 days versus ${p30.activities.previous} in the 30 days before.`,
      evidence: { ...p30.activities },
    });
  }

  const recent = snap.leads.filter((l) => daysBetween(snap.now, new Date(l.created_at)) <= 30);
  const earlier = snap.leads.filter((l) => {
    const d = daysBetween(snap.now, new Date(l.created_at));
    return d > 30 && d <= 90;
  });
  if (recent.length >= 5 && earlier.length >= 5) {
    const rate = (list: typeof recent) =>
      (list.filter((l) => l.status === "qualified" || l.status === "converted").length / list.length) * 100;
    const r = rate(recent);
    const e = rate(earlier);
    if (Math.abs(r - e) >= 10) {
      out.push({
        kind: "lead_quality_change",
        severity: r > e ? "positive" : "watch",
        title: `Qualification rate on new leads is ${r > e ? "higher" : "lower"} than the prior cohort`,
        body: `${pct(r)} of the ${recent.length} leads created in the last 30 days are qualified or converted, compared with ${pct(e)} of the ${earlier.length} leads created 31–90 days ago. Newer leads have had less time to progress, so read this as a signal, not a verdict.`,
        evidence: { recent: r, earlier: e, recentCount: recent.length, earlierCount: earlier.length },
      });
    }
  }

  const quiet = accountRollup(snap).filter(
    (r) =>
      (r.account.status === "customer" || r.account.status === "at_risk") &&
      (!r.lastActivity || daysBetween(snap.now, new Date(r.lastActivity)) > 30),
  );
  if (quiet.length) {
    out.push({
      kind: "account_engagement",
      severity: "watch",
      title: `${quiet.length} customer ${quiet.length === 1 ? "account has" : "accounts have"} no logged activity in 30+ days`,
      body: `Existing customers with no recorded contact for over a month: ${quiet
        .slice(0, 5)
        .map((r) => r.account.name)
        .join(", ")}${quiet.length > 5 ? ` and ${quiet.length - 5} more` : ""}.`,
      evidence: { count: quiet.length, ids: quiet.slice(0, 10).map((r) => r.account.id) },
    });
  }

  const pat = conversationPatterns(snap.analyses);
  if (pat.total >= 3) {
    const topObj = pat.objections.filter((o) => o.count >= 2).slice(0, 3);
    if (topObj.length) {
      out.push({
        kind: "objection_pattern",
        severity: "info",
        title: `Most repeated objection: "${topObj[0].label}"`,
        body: `Across ${pat.total} analysed conversations: ${topObj.map((o) => `"${o.label}" (${o.count})`).join("; ")}.`,
        evidence: { objections: topObj, conversations: pat.total },
      });
    }
    const topComp = pat.competitors.filter((o) => o.count >= 2).slice(0, 3);
    if (topComp.length) {
      out.push({
        kind: "competitor_pattern",
        severity: "info",
        title: `${topComp[0].label} is the competitor mentioned most often`,
        body: `Competitors named in analysed conversations: ${topComp.map((o) => `${o.label} (${o.count})`).join("; ")}.`,
        evidence: { competitors: topComp },
      });
    }
    if (pat.sentiments.negative + pat.sentiments.mixed >= Math.ceil(pat.total / 2)) {
      out.push({
        kind: "sentiment_pattern",
        severity: "watch",
        title: "Half or more of analysed conversations carry negative or mixed sentiment",
        body: `${pat.sentiments.negative} negative and ${pat.sentiments.mixed} mixed out of ${pat.total} analysed conversations.`,
        evidence: { ...pat.sentiments, total: pat.total },
      });
    }
  }

  const reasons = lostReasons(snap.opportunities).filter((r) => r.count >= 2);
  if (reasons.length) {
    out.push({
      kind: "loss_reasons",
      severity: "info",
      title: `Top recorded loss reason: "${reasons[0].label}"`,
      body: `Closed-lost deals with a recorded reason: ${reasons.slice(0, 3).map((r) => `"${r.label}" (${r.count})`).join("; ")}.`,
      evidence: { reasons: reasons.slice(0, 5) },
    });
  }

  if (summary.winRate !== null && summary.wonCount + summary.lostCount >= 5) {
    out.push({
      kind: "win_rate",
      severity: summary.winRate >= 50 ? "positive" : "info",
      title: `Win rate is ${pct(summary.winRate)} across ${summary.wonCount + summary.lostCount} closed deals`,
      body: `${summary.wonCount} won (${money(summary.wonValue)}) and ${summary.lostCount} lost (${money(summary.lostValue)}).${
        summary.avgWonSize ? ` Average won deal: ${money(summary.avgWonSize)}.` : ""
      }`,
      evidence: { winRate: summary.winRate, won: summary.wonCount, lost: summary.lostCount },
    });
  }

  return out;
}
