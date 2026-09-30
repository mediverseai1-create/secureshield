import type { PlanId } from "./types";

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number;
  credits: number;
  blurb: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", name: "Free", priceUsd: 0, credits: 200, blurb: "Try the full platform on a small amount of your own data." },
  starter: { id: "starter", name: "Starter", priceUsd: 47, credits: 4000, blurb: "For a small team running briefings and call analysis regularly." },
  pro: { id: "pro", name: "Pro", priceUsd: 57, credits: 7000, blurb: "For teams analysing conversations and asking questions every day." },
  scale: { id: "scale", name: "Scale", priceUsd: 97, credits: 11000, blurb: "For the heaviest usage across a larger pipeline." },
};

export const PAID_PLANS: Plan[] = [PLANS.starter, PLANS.pro, PLANS.scale];
export const ALL_PLANS: Plan[] = [PLANS.free, ...PAID_PLANS];

/** Credits consumed per AI operation. Everything else (scoring, insights, actions, reports) is computed from your data and is free. */
export const CREDIT_COSTS = {
  conversation_analysis: 50,
  briefing: 100,
  assistant_question: 10,
  followup_draft: 10,
} as const;
export type CreditAction = keyof typeof CREDIT_COSTS;

export const CREDIT_ACTION_LABELS: Record<string, string> = {
  conversation_analysis: "Conversation analysis",
  briefing: "AI briefing",
  assistant_question: "AI Assistant question",
  followup_draft: "Follow-up draft",
  plan_allocation: "Plan credits",
  monthly_refresh: "Monthly refresh",
};

/** Whole-number capacity for a plan, e.g. 4,000 credits ≈ 40 briefings. */
export function capacity(plan: Plan) {
  return {
    briefings: Math.floor(plan.credits / CREDIT_COSTS.briefing),
    analyses: Math.floor(plan.credits / CREDIT_COSTS.conversation_analysis),
    questions: Math.floor(plan.credits / CREDIT_COSTS.assistant_question),
  };
}

export const LOW_CREDIT_THRESHOLD = 0.2;

export function creditState(balance: number, allocation: number) {
  const ratio = allocation > 0 ? balance / allocation : 0;
  if (balance <= 0) return "empty" as const;
  if (ratio <= LOW_CREDIT_THRESHOLD) return "low" as const;
  return "ok" as const;
}

/** What every plan includes. All modules are on every plan; only the credit allowance differs. */
export const INCLUDED_FEATURES = [
  "All five modules: pipeline, briefings, actions, lead scoring, conversations",
  "Workspace isolation enforced by Row Level Security",
  "Owner, admin and member roles",
  "CSV import for accounts, leads and opportunities",
  "Report generation with CSV and JSON export",
];
