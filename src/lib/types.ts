export type Role = "owner" | "admin" | "member";
export type PlanId = "free" | "starter" | "pro" | "scale";

export const STAGES = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ["prospecting", "qualification", "proposal", "negotiation"];

export const STAGE_LABELS: Record<Stage, string> = {
  prospecting: "Prospecting",
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

/** Default win probability applied when a user picks a stage and has not set a custom value. */
export const STAGE_DEFAULT_PROBABILITY: Record<Stage, number> = {
  prospecting: 10,
  qualification: 25,
  proposal: 50,
  negotiation: 75,
  closed_won: 100,
  closed_lost: 0,
};

export const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "converted"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const ACCOUNT_STATUSES = ["prospect", "customer", "at_risk", "former"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export const ACTIVITY_TYPES = ["call", "email", "meeting", "note", "task"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  job_title: string | null;
  role_in_org: string | null;
  industry: string | null;
  country: string | null;
  company_size: string | null;
  revenue_goals: string[];
  onboarding_completed: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  country: string | null;
  company_size: string | null;
  created_at: string;
}

export interface Account {
  id: string;
  org_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  company_size: string | null;
  country: string | null;
  status: AccountStatus;
  owner_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  org_id: string;
  account_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  is_primary: boolean;
}

export interface Lead {
  id: string;
  org_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  source: string | null;
  status: LeadStatus;
  estimated_value: number | null;
  owner_id: string | null;
  account_id: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  org_id: string;
  name: string;
  account_id: string | null;
  lead_id: string | null;
  stage: Stage;
  amount: number;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  owner_id: string | null;
  next_step: string | null;
  lost_reason: string | null;
  source: string | null;
  notes: string | null;
  stage_changed_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StageHistory {
  id: string;
  opportunity_id: string;
  from_stage: string | null;
  to_stage: string;
  amount: number | null;
  changed_at: string;
}

export interface Activity {
  id: string;
  org_id: string;
  type: ActivityType;
  subject: string;
  notes: string | null;
  account_id: string | null;
  lead_id: string | null;
  opportunity_id: string | null;
  occurred_at: string;
  created_by: string | null;
}

export interface Conversation {
  id: string;
  org_id: string;
  title: string;
  source_type: "transcript" | "audio";
  transcript?: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  account_id: string | null;
  opportunity_id: string | null;
  participants: string | null;
  occurred_at: string;
  status: "pending" | "analyzed" | "failed";
  error: string | null;
  created_at: string;
}

export type Sentiment = "positive" | "neutral" | "negative" | "mixed";

export interface ConversationAnalysis {
  id: string;
  conversation_id: string;
  summary: string;
  intent: string | null;
  sentiment: Sentiment | null;
  sentiment_reasoning: string | null;
  objections: string[];
  commitments: string[];
  competitors: string[];
  decision_criteria: string[];
  next_action: string | null;
  model: string | null;
  credits_used: number;
  created_at: string;
}

export interface ActionItem {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  reason: string | null;
  type: string;
  priority: "high" | "medium" | "low";
  status: "open" | "done" | "dismissed";
  due_date: string | null;
  source_type: string | null;
  source_id: string | null;
  generated_by: "rules" | "ai" | "manual";
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface InsightRow {
  id: string;
  kind: string;
  severity: "info" | "watch" | "risk" | "positive";
  title: string;
  body: string;
  evidence: Record<string, unknown>;
  generated_at: string;
}

export interface BriefingContent {
  headline: string;
  what_changed: string[];
  needs_attention: { title: string; detail: string }[];
  important_opportunities: { title: string; detail: string }[];
  risks: { title: string; detail: string }[];
  recommended_actions: { title: string; reason: string }[];
  strategy: string;
  data_gaps: string[];
}

export interface BriefingRow {
  id: string;
  title: string;
  cadence: string;
  period_start: string;
  period_end: string;
  content: BriefingContent;
  metrics: Record<string, unknown>;
  model: string | null;
  credits_used: number;
  created_at: string;
}

export interface CreditBalance {
  org_id: string;
  plan: PlanId;
  monthly_allocation: number;
  balance: number;
  period_start: string;
  period_end: string;
}

export interface CreditUsageRow {
  id: string;
  kind: "debit" | "refund" | "grant" | "reset";
  action: string;
  credits: number;
  balance_after: number;
  description: string | null;
  created_at: string;
  user_id: string | null;
  refunded: boolean;
}

export interface Subscription {
  org_id: string;
  plan: PlanId;
  status: "free" | "active" | "past_due" | "canceled";
  provider: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

export interface Member {
  user_id: string;
  role: Role;
  created_at: string;
  profile: { full_name: string | null; email: string | null; job_title: string | null } | null;
}

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
