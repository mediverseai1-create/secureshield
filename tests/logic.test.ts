// Pure-logic tests for scoring, analytics, insights, action rules, CSV import validation and reports.
// Run: npm run test:logic
import test from "node:test";
import assert from "node:assert/strict";
import { scoreLead } from "../src/lib/scoring";
import { pipelineSummary, staleOpportunities, overdueOpportunities, periodMetrics, type Snapshot } from "../src/lib/analytics";
import { generateInsights } from "../src/lib/insights";
import { generateActions } from "../src/lib/action-rules";
import { mapHeaders, validateRows } from "../src/lib/csv";
import { buildReport } from "../src/lib/reports";
import { CREDIT_COSTS, PLANS, capacity, creditState } from "../src/lib/plans";
import { PERMISSIONS } from "../src/lib/permissions";
import type { Lead, Opportunity } from "../src/lib/types";

const now = new Date("2026-09-30T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const opp = (o: Partial<Opportunity>): Opportunity => ({
  id: crypto.randomUUID(), org_id: "o", name: "Deal", account_id: null, lead_id: null, stage: "proposal", amount: 10000, currency: "USD",
  probability: 50, expected_close_date: null, owner_id: null, next_step: null, lost_reason: null, source: null, notes: null,
  stage_changed_at: daysAgo(1), closed_at: null, created_at: daysAgo(5), updated_at: daysAgo(1), ...o,
});
const lead = (l: Partial<Lead>): Lead => ({
  id: crypto.randomUUID(), org_id: "o", full_name: "Lee", email: null, phone: null, company: null, job_title: null, source: null, status: "new",
  estimated_value: null, owner_id: null, account_id: null, last_contacted_at: null, notes: null, created_at: daysAgo(10), updated_at: daysAgo(10), ...l,
});
const snap = (p: Partial<Snapshot>): Snapshot => ({ now, accounts: [], opportunities: [], leads: [], activities: [], conversations: [], analyses: [], history: [], ...p });

test("lead score: an empty lead scores low and is explained", () => {
  const s = scoreLead(lead({}), [], now);
  assert.equal(s.score, 5); // only 'new' status points
  assert.equal(s.band, "cold");
  assert.equal(s.components.reduce((t, c) => t + c.max, 0), 100);
});

test("lead score: a complete, engaged, qualified lead is hot", () => {
  const s = scoreLead(
    lead({ email: "a@b.co", phone: "1", company: "Co", job_title: "VP", source: "Referral", owner_id: "u", status: "qualified", estimated_value: 60000, last_contacted_at: daysAgo(2) }),
    [], now,
  );
  assert.equal(s.score, 20 + 25 + 30 + 15 + 10);
  assert.equal(s.band, "hot");
});

test("pipeline summary uses amount x probability and closed deals only for win rate", () => {
  const s = pipelineSummary([
    opp({ amount: 1000, probability: 50 }),
    opp({ stage: "closed_won", amount: 3000, probability: 100 }),
    opp({ stage: "closed_lost", amount: 500, probability: 0 }),
  ]);
  assert.equal(s.openValue, 1000);
  assert.equal(s.weightedValue, 500);
  assert.equal(s.winRate, 50);
  assert.equal(s.avgWonSize, 3000);
});

test("stale and overdue detection", () => {
  const stale = opp({ name: "Stale", stage_changed_at: daysAgo(30) });
  const fresh = opp({ name: "Fresh", stage_changed_at: daysAgo(2) });
  const late = opp({ name: "Late", expected_close_date: "2026-09-01" });
  const sn = snap({ opportunities: [stale, fresh, late] });
  assert.deepEqual(staleOpportunities(sn).map((x) => x.opp.name), ["Stale"]);
  assert.deepEqual(overdueOpportunities(sn).map((x) => x.opp.name), ["Late"]);
});

test("period metrics give no baseline instead of inventing one", () => {
  const m = periodMetrics(snap({ opportunities: [opp({ created_at: daysAgo(3) })] }), 30);
  assert.equal(m.newPipeline.current, 10000);
  assert.equal(m.newPipeline.change, null);
});

test("insights are only produced when data supports them", () => {
  assert.equal(generateInsights(snap({})).length, 0);
  const ins = generateInsights(snap({ opportunities: [opp({ stage_changed_at: daysAgo(40), name: "Old" })] }));
  assert.ok(ins.some((i) => i.kind === "stalled_opportunities"));
  assert.ok(ins.every((i) => Object.keys(i.evidence).length > 0));
});

test("actions state their reason and have stable dedupe keys", () => {
  const o = opp({ stage_changed_at: daysAgo(20), name: "Stuck" });
  const a = generateActions(snap({ opportunities: [o] }));
  assert.ok(a.length >= 1);
  assert.ok(a.every((x) => x.reason.length > 10 && x.dedupe_key.includes(x.source_id)));
  assert.deepEqual(a.map((x) => x.dedupe_key), generateActions(snap({ opportunities: [o] })).map((x) => x.dedupe_key));
  assert.equal(generateActions(snap({})).length, 0);
});

test("csv: headers map by alias and required columns are enforced", () => {
  const m = mapHeaders("leads", ["Name", "E-mail", "Company Name", "Weird"]);
  assert.equal(m.map["Name"], "full_name");
  assert.equal(m.map["Company Name"], "company");
  assert.deepEqual(m.unmapped, ["E-mail", "Weird"].filter((h) => !(h in m.map)));
  assert.deepEqual(mapHeaders("opportunities", ["Amount"]).missingRequired, ["Name"]);
});

test("csv: invalid rows are reported with line numbers, not silently accepted", () => {
  const r = validateRows(
    "opportunities",
    [
      { name: "Good", stage: "proposal", amount: "$12,500", expected_close_date: "2026-12-01" },
      { name: "", amount: "abc", stage: "nope", expected_close_date: "12/01/2026" },
      { name: "Owner", owner_email: "x@y.com" },
    ],
    { memberEmails: new Set(["rep@co.com"]) },
  );
  assert.equal(r.clean.length, 1);
  assert.equal(r.clean[0].row.amount, 12500);
  assert.equal(r.invalidCount, 2);
  assert.ok(r.issues.every((i) => i.line >= 3));
  assert.ok(r.issues.some((i) => i.field === "Owner email"));
});

test("reports are built from records only", () => {
  const rep = buildReport("pipeline_overview", snap({ opportunities: [opp({ amount: 2500 })] }), 90, new Map());
  assert.equal(rep.sections[0].kpis?.[0].value, "$2,500");
  assert.ok(rep.basis.includes("No AI"));
});

test("plans, credits and permissions match the published model", () => {
  assert.deepEqual([PLANS.starter.priceUsd, PLANS.starter.credits], [47, 4000]);
  assert.deepEqual([PLANS.pro.priceUsd, PLANS.pro.credits], [57, 7000]);
  assert.deepEqual([PLANS.scale.priceUsd, PLANS.scale.credits], [97, 11000]);
  assert.equal(capacity(PLANS.starter).briefings, Math.floor(4000 / CREDIT_COSTS.briefing));
  assert.equal(creditState(30, 200), "low");
  assert.equal(creditState(0, 200), "empty");
  assert.equal(creditState(150, 200), "ok");
  assert.ok(PERMISSIONS.every((p) => p.owner), "owner can do everything listed");
  assert.equal(PERMISSIONS.find((p) => p.key === "admins")?.admin, false);
});
