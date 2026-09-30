import { isoDay, money, pct, titleCase } from "./format";
import {
  accountRollup,
  conversationPatterns,
  isOpen,
  lastTouch,
  lostReasons,
  monthlySeries,
  periodMetrics,
  pipelineSummary,
  type Snapshot,
} from "./analytics";
import { scoreLead } from "./scoring";
import { STAGE_LABELS } from "./types";

export type ReportType = "pipeline_overview" | "revenue_intelligence" | "lead_performance" | "account_activity" | "conversation_intelligence";

export const REPORT_TYPES: { type: ReportType; label: string; description: string }[] = [
  { type: "pipeline_overview", label: "Pipeline overview", description: "Open pipeline by stage, weighted value and every open deal." },
  { type: "revenue_intelligence", label: "Revenue intelligence", description: "Period-over-period creation, wins, losses, monthly trend and loss reasons." },
  { type: "lead_performance", label: "Lead performance", description: "Leads by status and source with transparent scores." },
  { type: "account_activity", label: "Account activity", description: "Pipeline, wins and logged engagement for every account." },
  { type: "conversation_intelligence", label: "Conversation intelligence", description: "Sentiment, objections, competitors and decision criteria across analysed conversations." },
];

export interface ReportSection {
  title: string;
  description?: string;
  kpis?: { label: string; value: string }[];
  columns?: string[];
  rows?: (string | number)[][];
}

export interface ReportData {
  generatedAt: string;
  periodDays: number;
  basis: string;
  sections: ReportSection[];
}

const BASIS = "Calculated directly from records in this workspace at the time of generation. No AI model is used.";

export function buildReport(type: ReportType, snap: Snapshot, periodDays: number, names: Map<string, string>): ReportData {
  const acct = new Map(snap.accounts.map((a) => [a.id, a.name]));
  const owner = (id: string | null) => (id ? names.get(id) ?? "Former member" : "Unassigned");
  const sections: ReportSection[] = [];
  const summary = pipelineSummary(snap.opportunities);

  if (type === "pipeline_overview") {
    sections.push({
      title: "Headline figures",
      kpis: [
        { label: "Open pipeline", value: money(summary.openValue) },
        { label: "Weighted pipeline", value: money(summary.weightedValue) },
        { label: "Open deals", value: String(summary.openCount) },
        { label: "Win rate (closed deals)", value: summary.winRate === null ? "n/a" : pct(summary.winRate) },
        { label: "Average won deal", value: summary.avgWonSize === null ? "n/a" : money(summary.avgWonSize) },
      ],
    });
    sections.push({
      title: "By stage",
      columns: ["Stage", "Deals", "Value", "Weighted value"],
      rows: summary.byStage.map((s) => {
        const list = snap.opportunities.filter((o) => o.stage === s.stage);
        return [STAGE_LABELS[s.stage], s.count, s.value, Math.round(list.reduce((t, o) => t + (Number(o.amount) * o.probability) / 100, 0))];
      }),
    });
    sections.push({
      title: "Open deals",
      columns: ["Deal", "Account", "Stage", "Amount", "Probability %", "Expected close", "Owner", "Last touch", "Next step"],
      rows: snap.opportunities
        .filter(isOpen)
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .map((o) => [o.name, acct.get(o.account_id ?? "") ?? "", STAGE_LABELS[o.stage], Number(o.amount), o.probability, o.expected_close_date ?? "", owner(o.owner_id), isoDay(lastTouch(o, snap.activities)), o.next_step ?? ""]),
    });
  }

  if (type === "revenue_intelligence") {
    const m = periodMetrics(snap, periodDays);
    const row = (label: string, d: { current: number; previous: number; change: number | null }, money_ = false) => [
      label,
      money_ ? money(d.current) : d.current,
      money_ ? money(d.previous) : d.previous,
      d.change === null ? "no baseline" : `${d.change >= 0 ? "+" : ""}${d.change.toFixed(0)}%`,
    ];
    sections.push({
      title: `Last ${periodDays} days versus the previous ${periodDays} days`,
      columns: ["Measure", "This period", "Previous period", "Change"],
      rows: [
        row("New pipeline created", m.newPipeline, true),
        row("Opportunities created", m.newOpportunities),
        row("Revenue won", m.wonValue, true),
        row("Activities logged", m.activities),
        row("New leads", m.newLeads),
      ],
    });
    sections.push({
      title: "Monthly trend (last 6 months)",
      columns: ["Month", "Pipeline created", "Revenue won", "Activities"],
      rows: monthlySeries(snap, 6).map((s) => [s.month, s.created, s.won, s.activities]),
    });
    sections.push({
      title: "Won deals",
      columns: ["Deal", "Account", "Amount", "Closed"],
      rows: snap.opportunities.filter((o) => o.stage === "closed_won").sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? "")).slice(0, 100).map((o) => [o.name, acct.get(o.account_id ?? "") ?? "", Number(o.amount), o.closed_at ? isoDay(new Date(o.closed_at)) : ""]),
    });
    const reasons = lostReasons(snap.opportunities);
    sections.push({ title: "Recorded loss reasons", columns: ["Reason", "Deals"], rows: reasons.map((r) => [r.label, r.count]) });
  }

  if (type === "lead_performance") {
    const scored = snap.leads.map((l) => ({ l, s: scoreLead(l, snap.activities, snap.now) }));
    const bySource = new Map<string, typeof scored>();
    for (const x of scored) bySource.set(x.l.source ?? "(no source)", [...(bySource.get(x.l.source ?? "(no source)") ?? []), x]);
    sections.push({
      title: "Headline figures",
      kpis: [
        { label: "Leads", value: String(snap.leads.length) },
        { label: "Qualified or converted", value: String(snap.leads.filter((l) => l.status === "qualified" || l.status === "converted").length) },
        { label: "Average score", value: scored.length ? String(Math.round(scored.reduce((s, x) => s + x.s.score, 0) / scored.length)) : "n/a" },
        { label: "Hot leads (70+)", value: String(scored.filter((x) => x.s.band === "hot").length) },
      ],
    });
    sections.push({
      title: "By source",
      columns: ["Source", "Leads", "Qualified or converted", "Qualification rate", "Average score"],
      rows: [...bySource.entries()].map(([src, list]) => {
        const q = list.filter((x) => x.l.status === "qualified" || x.l.status === "converted").length;
        return [src, list.length, q, pct((q / list.length) * 100), Math.round(list.reduce((s, x) => s + x.s.score, 0) / list.length)];
      }).sort((a, b) => Number(b[1]) - Number(a[1])),
    });
    sections.push({
      title: "Leads by score",
      description: "Score criteria: contact completeness 20, progress 25, recent engagement 30, estimated value 15, record hygiene 10.",
      columns: ["Lead", "Company", "Status", "Score", "Band", "Source", "Owner", "Estimated value"],
      rows: scored.sort((a, b) => b.s.score - a.s.score).slice(0, 200).map(({ l, s }) => [l.full_name, l.company ?? "", titleCase(l.status), s.score, titleCase(s.band), l.source ?? "", owner(l.owner_id), l.estimated_value ? Number(l.estimated_value) : ""]),
    });
  }

  if (type === "account_activity") {
    sections.push({
      title: "Accounts",
      columns: ["Account", "Status", "Owner", "Open pipeline", "Open deals", "Won to date", "Activities (30 days)", "Last activity", "Conversations"],
      rows: accountRollup(snap)
        .sort((a, b) => b.openValue - a.openValue)
        .map((r) => [r.account.name, titleCase(r.account.status), owner(r.account.owner_id), r.openValue, r.openCount, r.wonValue, r.recentActivityCount, r.lastActivity ? isoDay(new Date(r.lastActivity)) : "", r.conversationCount]),
    });
  }

  if (type === "conversation_intelligence") {
    const pat = conversationPatterns(snap.analyses);
    const analysisBy = new Map(snap.analyses.map((a) => [a.conversation_id, a]));
    sections.push({
      title: "Headline figures",
      kpis: [
        { label: "Conversations", value: String(snap.conversations.length) },
        { label: "Analysed", value: String(pat.total) },
        { label: "Positive", value: String(pat.sentiments.positive) },
        { label: "Neutral / mixed", value: String(pat.sentiments.neutral + pat.sentiments.mixed) },
        { label: "Negative", value: String(pat.sentiments.negative) },
      ],
    });
    sections.push({ title: "Objections", columns: ["Objection", "Conversations"], rows: pat.objections.map((o) => [o.label, o.count]) });
    sections.push({ title: "Competitors mentioned", columns: ["Competitor", "Conversations"], rows: pat.competitors.map((o) => [o.label, o.count]) });
    sections.push({ title: "Decision criteria", columns: ["Criterion", "Conversations"], rows: pat.decisionCriteria.map((o) => [o.label, o.count]) });
    sections.push({
      title: "Conversations",
      columns: ["Title", "Account", "Date", "Sentiment", "Next action"],
      rows: snap.conversations.slice().reverse().slice(0, 200).map((c) => { const a = analysisBy.get(c.id); return [c.title, acct.get(c.account_id ?? "") ?? "", isoDay(new Date(c.occurred_at)), a?.sentiment ? titleCase(a.sentiment) : "Not analysed", a?.next_action ?? ""]; }),
    });
  }

  return { generatedAt: snap.now.toISOString(), periodDays, basis: BASIS, sections };
}
