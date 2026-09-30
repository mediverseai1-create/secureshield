import { addDays, daysBetween, isoDay } from "./format";
import {
  OPEN_STAGES,
  STAGES,
  type Account,
  type Activity,
  type Conversation,
  type ConversationAnalysis,
  type Lead,
  type Opportunity,
  type Stage,
  type StageHistory,
} from "./types";

/** Everything the intelligence layer reads. Always loaded through the signed-in user's session (RLS applies). */
export interface Snapshot {
  now: Date;
  accounts: Account[];
  opportunities: Opportunity[];
  leads: Lead[];
  activities: Activity[];
  conversations: Conversation[];
  analyses: ConversationAnalysis[];
  history: StageHistory[];
}

export const isOpen = (o: Opportunity) => OPEN_STAGES.includes(o.stage);
export const STALE_DAYS = 14;

export function pipelineSummary(opps: Opportunity[]) {
  const open = opps.filter(isOpen);
  const won = opps.filter((o) => o.stage === "closed_won");
  const lost = opps.filter((o) => o.stage === "closed_lost");
  const sum = (list: Opportunity[]) => list.reduce((s, o) => s + Number(o.amount), 0);
  const closedCount = won.length + lost.length;
  const byStage = STAGES.map((stage) => {
    const list = opps.filter((o) => o.stage === stage);
    return { stage, count: list.length, value: sum(list) };
  });
  return {
    openCount: open.length,
    openValue: sum(open),
    weightedValue: open.reduce((s, o) => s + (Number(o.amount) * o.probability) / 100, 0),
    wonCount: won.length,
    wonValue: sum(won),
    lostCount: lost.length,
    lostValue: sum(lost),
    winRate: closedCount ? (won.length / closedCount) * 100 : null,
    avgWonSize: won.length ? sum(won) / won.length : null,
    byStage,
  };
}

/** Latest meaningful touch on an opportunity: logged activity on it (or its account), or its last stage change. */
export function lastTouch(o: Opportunity, activities: Activity[]): Date {
  let latest = new Date(o.stage_changed_at).getTime();
  for (const a of activities) {
    if (a.opportunity_id === o.id || (o.account_id && a.account_id === o.account_id && !a.opportunity_id)) {
      const t = new Date(a.occurred_at).getTime();
      if (t > latest) latest = t;
    }
  }
  return new Date(latest);
}

export function staleOpportunities(snap: Snapshot, days = STALE_DAYS) {
  return snap.opportunities
    .filter(isOpen)
    .map((o) => ({ opp: o, touched: lastTouch(o, snap.activities) }))
    .map((x) => ({ ...x, idleDays: daysBetween(snap.now, x.touched) }))
    .filter((x) => x.idleDays >= days)
    .sort((a, b) => Number(b.opp.amount) - Number(a.opp.amount));
}

export function overdueOpportunities(snap: Snapshot) {
  const today = isoDay(snap.now);
  return snap.opportunities
    .filter((o) => isOpen(o) && o.expected_close_date && o.expected_close_date < today)
    .map((o) => ({ opp: o, overdueDays: daysBetween(snap.now, new Date(`${o.expected_close_date}T00:00:00Z`)) }))
    .sort((a, b) => Number(b.opp.amount) - Number(a.opp.amount));
}

export function inRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export interface PeriodDelta {
  current: number;
  previous: number;
  change: number | null; // percent, null when no baseline
}

export function delta(current: number, previous: number): PeriodDelta {
  return { current, previous, change: previous > 0 ? ((current - previous) / previous) * 100 : null };
}

export function periodMetrics(snap: Snapshot, days: number) {
  const end = addDays(snap.now, 1);
  const start = addDays(snap.now, -days + 1);
  const prevStart = addDays(start, -days);
  const createdIn = (s: Date, e: Date) => snap.opportunities.filter((o) => inRange(o.created_at, s, e));
  const sum = (l: Opportunity[]) => l.reduce((t, o) => t + Number(o.amount), 0);
  const wonIn = (s: Date, e: Date) => snap.opportunities.filter((o) => o.stage === "closed_won" && inRange(o.closed_at, s, e));
  const actIn = (s: Date, e: Date) => snap.activities.filter((a) => inRange(a.occurred_at, s, e));
  const leadsIn = (s: Date, e: Date) => snap.leads.filter((l) => inRange(l.created_at, s, e));
  return {
    start,
    end,
    newPipeline: delta(sum(createdIn(start, end)), sum(createdIn(prevStart, start))),
    newOpportunities: delta(createdIn(start, end).length, createdIn(prevStart, start).length),
    wonValue: delta(sum(wonIn(start, end)), sum(wonIn(prevStart, start))),
    activities: delta(actIn(start, end).length, actIn(prevStart, start).length),
    newLeads: delta(leadsIn(start, end).length, leadsIn(prevStart, start).length),
  };
}

/** Monthly series used by trend charts. */
export function monthlySeries(snap: Snapshot, months = 6) {
  const out: { month: string; created: number; won: number; activities: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(snap.now.getUTCFullYear(), snap.now.getUTCMonth() - i, 1));
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    out.push({
      month: d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
      created: snap.opportunities.filter((o) => inRange(o.created_at, d, next)).reduce((s, o) => s + Number(o.amount), 0),
      won: snap.opportunities.filter((o) => o.stage === "closed_won" && inRange(o.closed_at, d, next)).reduce((s, o) => s + Number(o.amount), 0),
      activities: snap.activities.filter((a) => inRange(a.occurred_at, d, next)).length,
    });
  }
  return out;
}

export function weeklyActivity(snap: Snapshot, weeks = 8) {
  const out: { week: string; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = addDays(snap.now, -i * 7 + 1);
    const start = addDays(end, -7);
    out.push({
      week: start.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      count: snap.activities.filter((a) => inRange(a.occurred_at, start, end)).length,
    });
  }
  return out;
}

export function accountRollup(snap: Snapshot) {
  return snap.accounts.map((acc) => {
    const opps = snap.opportunities.filter((o) => o.account_id === acc.id);
    const open = opps.filter(isOpen);
    const acts = snap.activities.filter((a) => a.account_id === acc.id);
    const lastActivity = acts.reduce<string | null>((m, a) => (!m || a.occurred_at > m ? a.occurred_at : m), null);
    return {
      account: acc,
      openValue: open.reduce((s, o) => s + Number(o.amount), 0),
      openCount: open.length,
      wonValue: opps.filter((o) => o.stage === "closed_won").reduce((s, o) => s + Number(o.amount), 0),
      activityCount: acts.length,
      recentActivityCount: acts.filter((a) => daysBetween(snap.now, new Date(a.occurred_at)) <= 30).length,
      lastActivity,
      conversationCount: snap.conversations.filter((c) => c.account_id === acc.id).length,
    };
  });
}

function tally(values: string[]): { label: string; count: number }[] {
  const map = new Map<string, { label: string; count: number }>();
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key) continue;
    const cur = map.get(key);
    if (cur) cur.count++;
    else map.set(key, { label: v.trim(), count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function conversationPatterns(analyses: ConversationAnalysis[]) {
  const sentiments = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  for (const a of analyses) if (a.sentiment) sentiments[a.sentiment]++;
  return {
    total: analyses.length,
    sentiments,
    objections: tally(analyses.flatMap((a) => a.objections ?? [])),
    competitors: tally(analyses.flatMap((a) => a.competitors ?? [])),
    decisionCriteria: tally(analyses.flatMap((a) => a.decision_criteria ?? [])),
  };
}

export function lostReasons(opps: Opportunity[]) {
  return tally(opps.filter((o) => o.stage === "closed_lost" && o.lost_reason).map((o) => o.lost_reason as string));
}

export function stageMovement(snap: Snapshot, days: number) {
  const start = addDays(snap.now, -days);
  const moves = snap.history.filter((h) => new Date(h.changed_at) >= start && h.from_stage !== null);
  const oppById = new Map(snap.opportunities.map((o) => [o.id, o]));
  return moves
    .map((h) => ({ ...h, opp: oppById.get(h.opportunity_id) }))
    .filter((h): h is typeof h & { opp: Opportunity } => Boolean(h.opp))
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at));
}

export function hasAnyData(snap: Snapshot): boolean {
  return snap.opportunities.length + snap.leads.length + snap.accounts.length + snap.conversations.length > 0;
}

export const stageIndex = (s: Stage) => STAGES.indexOf(s);
