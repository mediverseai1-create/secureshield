import { daysBetween } from "./format";
import type { Activity, Lead } from "./types";

/**
 * Lead scoring — fully transparent, rule-based, computed from the lead's own stored data.
 * No model is involved and nothing is stored: the score is recalculated from the records each time,
 * and the breakdown is shown next to it.
 */
export interface ScoreComponent {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface LeadScore {
  score: number;
  band: "hot" | "warm" | "cold";
  components: ScoreComponent[];
}

export const SCORING_CRITERIA: { label: string; max: number; rule: string }[] = [
  { label: "Contact completeness", max: 20, rule: "Email 8, phone 4, company 4, job title 4" },
  { label: "Progress", max: 25, rule: "New 5, contacted 12, qualified 25, converted 25, unqualified 0" },
  { label: "Recent engagement", max: 30, rule: "Last contact or logged activity: within 7 days 30, 14 days 22, 30 days 12, older 4, none 0" },
  { label: "Estimated value", max: 15, rule: "$50k+ 15, $10k+ 10, $1k+ 5, any value 2, none 0" },
  { label: "Record hygiene", max: 10, rule: "Source recorded 5, owner assigned 5" },
];

const STATUS_POINTS: Record<Lead["status"], number> = { new: 5, contacted: 12, qualified: 25, unqualified: 0, converted: 25 };

export function scoreLead(lead: Lead, activities: Activity[], now = new Date()): LeadScore {
  const c: ScoreComponent[] = [];

  const completeness =
    (lead.email ? 8 : 0) + (lead.phone ? 4 : 0) + (lead.company ? 4 : 0) + (lead.job_title ? 4 : 0);
  c.push({
    key: "completeness",
    label: "Contact completeness",
    points: completeness,
    max: 20,
    detail: [lead.email && "email", lead.phone && "phone", lead.company && "company", lead.job_title && "title"].filter(Boolean).join(", ") || "no contact details",
  });

  c.push({
    key: "status",
    label: "Progress",
    points: STATUS_POINTS[lead.status],
    max: 25,
    detail: `status is ${lead.status}`,
  });

  const touches = [lead.last_contacted_at, ...activities.filter((a) => a.lead_id === lead.id).map((a) => a.occurred_at)]
    .filter((x): x is string => Boolean(x))
    .map((x) => new Date(x).getTime());
  let engagement = 0;
  let engagementDetail = "never contacted";
  if (touches.length) {
    const idle = daysBetween(now, new Date(Math.max(...touches)));
    engagement = idle <= 7 ? 30 : idle <= 14 ? 22 : idle <= 30 ? 12 : 4;
    engagementDetail = `last touch ${Math.max(idle, 0)} day${idle === 1 ? "" : "s"} ago`;
  }
  c.push({ key: "engagement", label: "Recent engagement", points: engagement, max: 30, detail: engagementDetail });

  const v = Number(lead.estimated_value ?? 0);
  const value = v >= 50_000 ? 15 : v >= 10_000 ? 10 : v >= 1_000 ? 5 : v > 0 ? 2 : 0;
  c.push({
    key: "value",
    label: "Estimated value",
    points: value,
    max: 15,
    detail: lead.estimated_value ? `$${v.toLocaleString("en-US")}` : "no estimate",
  });

  const hygiene = (lead.source ? 5 : 0) + (lead.owner_id ? 5 : 0);
  c.push({
    key: "hygiene",
    label: "Record hygiene",
    points: hygiene,
    max: 10,
    detail: [lead.source ? "source recorded" : "no source", lead.owner_id ? "owner assigned" : "no owner"].join(", "),
  });

  const score = c.reduce((s, x) => s + x.points, 0);
  return { score, band: score >= 70 ? "hot" : score >= 40 ? "warm" : "cold", components: c };
}
