"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApp } from "@/lib/context";
import { loadMembers, loadSnapshot, logActivity } from "@/lib/data";
import { withCredits } from "@/lib/credits";
import { CREDIT_COSTS } from "@/lib/plans";
import { GEMINI_MODEL, UNTRUSTED_DATA_RULE, generateJson, generateText, isGeminiConfigured } from "@/lib/gemini";
import { BRIEFING_SYSTEM, buildBriefingMetrics } from "@/lib/briefing";
import { generateInsights } from "@/lib/insights";
import { generateActions } from "@/lib/action-rules";
import { buildReport, REPORT_TYPES, type ReportType } from "@/lib/reports";
import { hasAnyData } from "@/lib/analytics";
import { CADENCE_DAYS, blank, briefingSchema, manualActionSchema, type ManualActionValues } from "@/lib/schemas";
import { isoDay } from "@/lib/format";
import type { ActionResult, BriefingContent } from "@/lib/types";

const pair = z.array(z.object({ title: z.string(), detail: z.string() })).default([]);
const briefingOut = z.object({
  headline: z.string().min(1),
  what_changed: z.array(z.string()).default([]),
  needs_attention: pair,
  important_opportunities: pair,
  risks: pair,
  recommended_actions: z.array(z.object({ title: z.string(), reason: z.string() })).default([]),
  strategy: z.string().default(""),
  data_gaps: z.array(z.string()).default([]),
});

export async function generateBriefing(cadence: string): Promise<ActionResult<{ id: string }>> {
  const parsed = briefingSchema.safeParse({ cadence });
  if (!parsed.success) return { ok: false, error: "Choose a briefing cadence." };
  const app = await requireApp();
  if (!isGeminiConfigured()) return { ok: false, error: "AI briefings are not configured for this deployment yet." };

  const days = CADENCE_DAYS[parsed.data.cadence];
  const snap = await loadSnapshot(app.supabase, app.org.id);
  if (!hasAnyData(snap)) return { ok: false, error: "There is no pipeline data to brief on yet. Add opportunities, leads or accounts first." };
  const metrics = buildBriefingMetrics(snap, days);

  const result = await withCredits(
    app.supabase,
    app.org.id,
    "briefing",
    () =>
      generateJson(
        {
          system: BRIEFING_SYSTEM,
          prompt: `Write the ${parsed.data.cadence} briefing for ${app.org.name} covering ${metrics.period.start} to ${metrics.period.end}.\n\n<workspace_data>\n${JSON.stringify(metrics)}\n</workspace_data>`,
          temperature: 0.2,
        },
        briefingOut,
      ),
    { description: `${parsed.data.cadence} briefing` },
  );
  if (!result.ok) return { ok: false, error: result.error };

  const content: BriefingContent = result.data;
  const { data, error } = await app.supabase
    .from("briefings")
    .insert({
      org_id: app.org.id,
      title: `${parsed.data.cadence[0].toUpperCase()}${parsed.data.cadence.slice(1)} briefing — ${metrics.period.end}`,
      cadence: parsed.data.cadence,
      period_start: metrics.period.start,
      period_end: metrics.period.end,
      content,
      metrics,
      model: GEMINI_MODEL,
      credits_used: CREDIT_COSTS.briefing,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "The briefing was generated but could not be saved. Please try again." };
  await logActivity(app.supabase, app.org.id, app.userId, "briefing.generated", `Generated a ${parsed.data.cadence} briefing`, "briefing", data.id, { credits: CREDIT_COSTS.briefing });
  revalidatePath("/briefings");
  revalidatePath("/overview");
  revalidatePath("/usage");
  return { ok: true, id: data.id as string };
}

export async function refreshInsights(): Promise<ActionResult<{ count: number }>> {
  const app = await requireApp();
  const snap = await loadSnapshot(app.supabase, app.org.id);
  const items = generateInsights(snap);
  const { error: delError } = await app.supabase.from("insights").delete().eq("org_id", app.org.id);
  if (delError) return { ok: false, error: "Could not refresh insights." };
  if (items.length) {
    const { error } = await app.supabase.from("insights").insert(items.map((i) => ({ ...i, org_id: app.org.id })));
    if (error) return { ok: false, error: "Could not save insights." };
  }
  revalidatePath("/insights");
  revalidatePath("/overview");
  return { ok: true, count: items.length };
}

export async function generateActionQueue(): Promise<ActionResult<{ created: number }>> {
  const app = await requireApp();
  const snap = await loadSnapshot(app.supabase, app.org.id);
  const items = generateActions(snap);
  if (!items.length) return { ok: true, created: 0 };

  const keys = items.map((i) => i.dedupe_key);
  const { data: existing } = await app.supabase.from("actions").select("dedupe_key").eq("org_id", app.org.id).in("dedupe_key", keys);
  const have = new Set((existing ?? []).map((r) => r.dedupe_key as string));
  const fresh = items.filter((i) => !have.has(i.dedupe_key));
  if (fresh.length) {
    const { error } = await app.supabase.from("actions").upsert(
      fresh.map((i) => ({ ...i, org_id: app.org.id, generated_by: "rules" as const })),
      { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
    );
    if (error) return { ok: false, error: "Could not save actions." };
    await logActivity(app.supabase, app.org.id, app.userId, "actions.generated", `Generated ${fresh.length} actions from workspace data`, "action");
  }
  revalidatePath("/actions");
  revalidatePath("/overview");
  return { ok: true, created: fresh.length };
}

export async function setActionStatus(id: string, status: "open" | "done" | "dismissed"): Promise<ActionResult> {
  if (!["open", "done", "dismissed"].includes(status)) return { ok: false, error: "Invalid status." };
  const app = await requireApp();
  const { data, error } = await app.supabase
    .from("actions")
    .update({
      status,
      completed_at: status === "open" ? null : new Date().toISOString(),
      completed_by: status === "open" ? null : app.userId,
    })
    .eq("id", id)
    .eq("org_id", app.org.id)
    .select("title")
    .maybeSingle();
  if (error) return { ok: false, error: "Could not update the action." };
  if (!data) return { ok: false, error: "That action no longer exists." };
  await logActivity(app.supabase, app.org.id, app.userId, `action.${status}`, `${status === "done" ? "Completed" : status === "dismissed" ? "Dismissed" : "Reopened"} action “${data.title}”`, "action", id);
  revalidatePath("/actions");
  revalidatePath("/overview");
  return { ok: true };
}

export async function createManualAction(values: ManualActionValues): Promise<ActionResult> {
  const parsed = manualActionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  const app = await requireApp();
  const { error } = await app.supabase.from("actions").insert({
    org_id: app.org.id,
    title: v.title,
    description: blank(v.description),
    priority: v.priority,
    due_date: blank(v.due_date),
    type: "other",
    source_type: "manual",
    generated_by: "manual",
    assigned_to: app.userId,
  });
  if (error) return { ok: false, error: "Could not create the action." };
  revalidatePath("/actions");
  return { ok: true };
}

export async function generateReport(type: string, periodDays: number): Promise<ActionResult<{ id: string }>> {
  if (!REPORT_TYPES.some((r) => r.type === type)) return { ok: false, error: "Unknown report type." };
  const days = [30, 90, 180, 365].includes(periodDays) ? periodDays : 90;
  const app = await requireApp();
  const [snap, members] = await Promise.all([loadSnapshot(app.supabase, app.org.id), loadMembers(app.supabase, app.org.id)]);
  if (!hasAnyData(snap)) return { ok: false, error: "There is no data to report on yet." };
  const names = new Map(members.map((m) => [m.user_id, m.profile?.full_name || m.profile?.email || "Member"]));
  const data = buildReport(type as ReportType, snap, days, names);
  const label = REPORT_TYPES.find((r) => r.type === type)!.label;
  const { data: row, error } = await app.supabase
    .from("reports")
    .insert({ org_id: app.org.id, type, title: `${label} — ${isoDay(snap.now)}`, params: { periodDays: days }, data })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Could not save the report." };
  await logActivity(app.supabase, app.org.id, app.userId, "report.generated", `Generated report “${label}”`, "report", row.id);
  revalidatePath("/reports");
  return { ok: true, id: row.id as string };
}

/** Drafts a follow-up message for an action, grounded in the linked records only. */
export async function draftFollowUp(actionId: string): Promise<ActionResult<{ draft: string }>> {
  const app = await requireApp();
  if (!isGeminiConfigured()) return { ok: false, error: "AI drafting is not configured for this deployment yet." };
  const { data: action } = await app.supabase.from("actions").select("*").eq("id", actionId).eq("org_id", app.org.id).maybeSingle();
  if (!action) return { ok: false, error: "Action not found." };

  const ctx: Record<string, unknown> = { action: { title: action.title, reason: action.reason, description: action.description } };
  const sid = action.source_id as string | null;
  if (sid && action.source_type === "opportunity") {
    const { data: opp } = await app.supabase.from("opportunities").select("name,stage,amount,expected_close_date,next_step,account_id").eq("id", sid).maybeSingle();
    ctx.opportunity = opp;
    if (opp?.account_id) {
      const { data: contacts } = await app.supabase.from("contacts").select("full_name,job_title").eq("account_id", opp.account_id).limit(3);
      ctx.contacts = contacts;
    }
    const { data: acts } = await app.supabase.from("activities").select("type,subject,notes,occurred_at").eq("opportunity_id", sid).order("occurred_at", { ascending: false }).limit(5);
    ctx.recent_activity = acts;
  } else if (sid && action.source_type === "lead") {
    const { data: lead } = await app.supabase.from("leads").select("full_name,company,job_title,status,source,notes").eq("id", sid).maybeSingle();
    ctx.lead = lead;
  } else if (sid && action.source_type === "conversation") {
    const { data: a } = await app.supabase.from("conversation_analyses").select("summary,objections,commitments,next_action").eq("conversation_id", sid).maybeSingle();
    const { data: c } = await app.supabase.from("conversations").select("title,participants").eq("id", sid).maybeSingle();
    ctx.conversation = { ...c, analysis: a };
  } else if (sid && action.source_type === "account") {
    const { data: acc } = await app.supabase.from("accounts").select("name,status,industry").eq("id", sid).maybeSingle();
    ctx.account = acc;
  }

  const result = await withCredits(
    app.supabase,
    app.org.id,
    "followup_draft",
    () =>
      generateText({
        system: `You draft short, plain follow-up emails for a salesperson. Use only the facts in <workspace_data>. Do not invent details, prices, dates or promises. Where a detail is missing, leave a clearly marked [placeholder]. Output the email only: a subject line, then the body (under 150 words). ${UNTRUSTED_DATA_RULE}`,
        prompt: `<workspace_data>\n${JSON.stringify(ctx)}\n</workspace_data>`,
        temperature: 0.4,
      }),
    { description: `Follow-up draft: ${String(action.title).slice(0, 80)}` },
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/usage");
  return { ok: true, draft: result.data };
}
