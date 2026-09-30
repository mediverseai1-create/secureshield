import { z } from "zod";
import { ACCOUNT_STATUSES, ACTIVITY_TYPES, LEAD_STATUSES, STAGES } from "./types";

const optionalText = (max = 500) => z.string().trim().max(max).optional().or(z.literal(""));
const money = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v.replace(/,/g, "")) && Number(v.replace(/,/g, "")) >= 0), "Enter a positive amount");
const dateStr = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use YYYY-MM-DD");
const email = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address");

export const toNumber = (v: string | undefined | null): number | null => {
  if (v === undefined || v === null || v.trim() === "") return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
export const blank = (v: string | undefined | null): string | null => (v && v.trim() !== "" ? v.trim() : null);

export const authSchema = {
  signIn: z.object({ email: z.email("Enter a valid email address"), password: z.string().min(1, "Enter your password") }),
  signUp: z
    .object({
      full_name: z.string().trim().min(2, "Enter your full name"),
      email: z.email("Enter a valid email address"),
      password: z.string().min(10, "Use at least 10 characters"),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" }),
  forgot: z.object({ email: z.email("Enter a valid email address") }),
  reset: z
    .object({ password: z.string().min(10, "Use at least 10 characters"), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" }),
};

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;
export const INDUSTRIES = [
  "Financial services",
  "Legal",
  "Professional services",
  "Enterprise services",
  "Software & technology",
  "Healthcare services",
  "Manufacturing & industrial",
  "Real estate",
  "Education",
  "Other",
] as const;
export const ROLES_IN_ORG = [
  "VP of Sales / Sales leader",
  "Revenue Operations",
  "Sales representative",
  "IT reviewer",
  "Security reviewer",
  "Operations leader",
  "Business owner",
  "Other",
] as const;
export const REVENUE_GOALS = [
  "Increase pipeline coverage",
  "Improve win rate",
  "Shorten sales cycle",
  "Improve forecast accuracy",
  "Grow existing accounts",
  "Reduce churn",
  "Improve follow-up discipline",
  "Coach the sales team",
] as const;

export const onboardingSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  job_title: z.string().trim().min(2, "Enter your job title").max(120),
  role_in_org: z.string().min(1, "Select your role"),
  org_name: z.string().trim().min(2, "Enter your organization name").max(120),
  industry: z.string().min(1, "Select an industry"),
  country: z.string().trim().min(2, "Enter your country").max(80),
  company_size: z.string().min(1, "Select a company size"),
  revenue_goals: z.array(z.string()).min(1, "Select at least one goal").max(8),
});
export type OnboardingValues = z.infer<typeof onboardingSchema>;

export const opportunitySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(200),
  account_id: z.string(),
  stage: z.enum(STAGES),
  amount: money,
  probability: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 100), "Enter 0–100"),
  expected_close_date: dateStr,
  owner_id: z.string(),
  next_step: optionalText(300),
  lost_reason: optionalText(300),
  source: optionalText(120),
  notes: optionalText(4000),
});
export type OpportunityValues = z.infer<typeof opportunitySchema>;

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Enter the account name").max(200),
  domain: optionalText(200),
  industry: optionalText(120),
  company_size: optionalText(40),
  country: optionalText(80),
  status: z.enum(ACCOUNT_STATUSES),
  owner_id: z.string(),
  notes: optionalText(4000),
});
export type AccountValues = z.infer<typeof accountSchema>;

export const contactSchema = z.object({
  account_id: z.string().min(1),
  full_name: z.string().trim().min(1, "Enter a name").max(200),
  email,
  phone: optionalText(60),
  job_title: optionalText(120),
});
export type ContactValues = z.infer<typeof contactSchema>;

export const leadSchema = z.object({
  full_name: z.string().trim().min(1, "Enter the lead's name").max(200),
  email,
  phone: optionalText(60),
  company: optionalText(200),
  job_title: optionalText(120),
  source: optionalText(120),
  status: z.enum(LEAD_STATUSES),
  estimated_value: money,
  owner_id: z.string(),
  notes: optionalText(4000),
});
export type LeadValues = z.infer<typeof leadSchema>;

export const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().trim().min(1, "Enter a subject").max(300),
  notes: optionalText(4000),
  occurred_at: dateStr,
  account_id: z.string().optional(),
  lead_id: z.string().optional(),
  opportunity_id: z.string().optional(),
});
export type ActivityValues = z.infer<typeof activitySchema>;

export const conversationSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  account_id: z.string(),
  opportunity_id: z.string(),
  participants: optionalText(300),
  occurred_at: dateStr,
  transcript: z.string().max(200_000, "Transcript is too long (200,000 characters max)").optional().or(z.literal("")),
});
export type ConversationValues = z.infer<typeof conversationSchema>;

export const inviteSchema = z.object({
  email: z.email("Enter a valid email address"),
  role: z.enum(["member", "admin"]),
});

export const manualActionSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(300),
  description: optionalText(2000),
  priority: z.enum(["high", "medium", "low"]),
  due_date: dateStr,
});
export type ManualActionValues = z.infer<typeof manualActionSchema>;

export const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  industry: optionalText(120),
  country: optionalText(80),
  company_size: optionalText(40),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  job_title: optionalText(120),
  role_in_org: optionalText(120),
});

export const briefingSchema = z.object({
  cadence: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly"]),
});

export const CADENCE_DAYS = { daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90 } as const;
