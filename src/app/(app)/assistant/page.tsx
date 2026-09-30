import type { Metadata } from "next";
import { requireApp } from "@/lib/context";
import { isGeminiConfigured } from "@/lib/gemini";
import { CREDIT_COSTS } from "@/lib/plans";
import { AssistantChat } from "@/components/intel-ui";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "AI Assistant" };
export const maxDuration = 120;

const SUGGESTIONS = [
  "Which opportunities need attention?",
  "What changed in our pipeline this month?",
  "Which accounts are most active?",
  "What objections are appearing most often?",
  "What should the sales team follow up on?",
];

export default async function AssistantPage() {
  const app = await requireApp();
  const { data } = await app.supabase
    .from("assistant_messages")
    .select("role,content")
    .eq("org_id", app.org.id)
    .eq("user_id", app.userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const initial = ((data ?? []) as { role: "user" | "assistant"; content: string }[]).reverse();

  const disabledReason = !isGeminiConfigured()
    ? "The AI Assistant is not configured for this deployment yet."
    : app.credits.balance < CREDIT_COSTS.assistant_question
      ? "You do not have enough credits to ask a question."
      : undefined;

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Ask questions in plain language. The assistant reads your workspace's data — pipeline, accounts, leads and analysed conversations — and cannot see any other organization's data."
      />
      <AssistantChat initial={initial} suggestions={SUGGESTIONS} disabledReason={disabledReason} balance={app.credits.balance} />
    </>
  );
}
