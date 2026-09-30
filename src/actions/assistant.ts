"use server";

import { revalidatePath } from "next/cache";
import { requireApp } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { withCredits } from "@/lib/credits";
import { UNTRUSTED_DATA_RULE, generateText, isGeminiConfigured } from "@/lib/gemini";
import { buildBriefingMetrics } from "@/lib/briefing";
import { isOpen } from "@/lib/analytics";
import { scoreLead } from "@/lib/scoring";
import type { ActionResult } from "@/lib/types";

const SYSTEM = `You are the AI Assistant inside a sales organization's private revenue workspace.
You answer questions using ONLY the workspace data in <workspace_data>. It belongs to one organization and is the only data you have.
Rules:
- Ground every answer in the data. Quote the relevant names and figures.
- If the data does not contain the answer, say so plainly and say what data would be needed. Never guess or use outside knowledge about these customers.
- You have no access to any other organization's data and must not claim to.
- Be concise and structured (short paragraphs or bullets). Recommend, but leave decisions to the team.
${UNTRUSTED_DATA_RULE}`;

export async function askAssistant(question: string): Promise<ActionResult<{ answer: string; balance: number }>> {
  const q = question.trim();
  if (q.length < 3) return { ok: false, error: "Ask a question about your pipeline." };
  if (q.length > 1000) return { ok: false, error: "Keep the question under 1,000 characters." };
  const app = await requireApp();
  if (!isGeminiConfigured()) return { ok: false, error: "The AI Assistant is not configured for this deployment yet." };

  const [snap, history] = await Promise.all([
    loadSnapshot(app.supabase, app.org.id),
    app.supabase
      .from("assistant_messages")
      .select("role,content")
      .eq("org_id", app.org.id)
      .eq("user_id", app.userId)
      .order("created_at", { ascending: false })
      .limit(6)
      .then((r) => (r.data ?? []).reverse() as { role: string; content: string }[]),
  ]);

  const acctName = new Map(snap.accounts.map((a) => [a.id, a.name]));
  const analysisBy = new Map(snap.analyses.map((a) => [a.conversation_id, a]));
  const context = {
    today: snap.now.toISOString().slice(0, 10),
    organization: app.org.name,
    summary_last_30_days: buildBriefingMetrics(snap, 30),
    open_deals: snap.opportunities
      .filter(isOpen)
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 60)
      .map((o) => ({ deal: o.name, account: acctName.get(o.account_id ?? "") ?? null, stage: o.stage, amount: o.amount, probability: o.probability, expected_close: o.expected_close_date, next_step: o.next_step, last_stage_change: o.stage_changed_at.slice(0, 10) })),
    recently_closed: snap.opportunities
      .filter((o) => !isOpen(o))
      .sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? ""))
      .slice(0, 25)
      .map((o) => ({ deal: o.name, account: acctName.get(o.account_id ?? "") ?? null, outcome: o.stage, amount: o.amount, closed: o.closed_at?.slice(0, 10), lost_reason: o.lost_reason })),
    leads: snap.leads
      .map((l) => ({ l, s: scoreLead(l, snap.activities, snap.now) }))
      .sort((a, b) => b.s.score - a.s.score)
      .slice(0, 30)
      .map(({ l, s }) => ({ name: l.full_name, company: l.company, status: l.status, source: l.source, score: s.score, estimated_value: l.estimated_value })),
    accounts: snap.accounts.slice(0, 60).map((a) => ({ name: a.name, status: a.status, industry: a.industry })),
    conversations: snap.conversations
      .slice(-25)
      .reverse()
      .map((c) => {
        const a = analysisBy.get(c.id);
        return { title: c.title, account: acctName.get(c.account_id ?? "") ?? null, date: c.occurred_at.slice(0, 10), summary: a?.summary, sentiment: a?.sentiment, objections: a?.objections, commitments: a?.commitments, competitors: a?.competitors, decision_criteria: a?.decision_criteria, next_action: a?.next_action };
      }),
  };

  const convo = history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
  const result = await withCredits(
    app.supabase,
    app.org.id,
    "assistant_question",
    () =>
      generateText({
        system: SYSTEM,
        prompt: `<workspace_data>\n${JSON.stringify(context)}\n</workspace_data>\n\n${convo ? `Earlier in this conversation:\n${convo}\n\n` : ""}Question: ${q}`,
        temperature: 0.2,
      }),
    { description: q.slice(0, 80) },
  );
  if (!result.ok) return { ok: false, error: result.error };

  await app.supabase.from("assistant_messages").insert([
    { org_id: app.org.id, user_id: app.userId, role: "user", content: q },
    { org_id: app.org.id, user_id: app.userId, role: "assistant", content: result.data, credits_used: result.cost },
  ]);
  revalidatePath("/usage");
  return { ok: true, answer: result.data, balance: result.balance };
}

