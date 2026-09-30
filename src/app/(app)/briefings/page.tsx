import type { Metadata } from "next";
import Link from "next/link";
import { requireApp } from "@/lib/context";
import { isGeminiConfigured } from "@/lib/gemini";
import { CREDIT_COSTS } from "@/lib/plans";
import { dateTime, titleCase } from "@/lib/format";
import type { BriefingRow } from "@/lib/types";
import { GenerateBriefingForm } from "@/components/intel-ui";
import { AiLabel, EmptyState, PageHeader, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Briefings" };
export const maxDuration = 120;

export default async function BriefingsPage() {
  const app = await requireApp();
  const { data } = await app.supabase.from("briefings").select("id,title,cadence,period_start,period_end,content,credits_used,created_at").eq("org_id", app.org.id).order("created_at", { ascending: false }).limit(100);
  const briefings = (data ?? []) as Pick<BriefingRow, "id" | "title" | "cadence" | "period_start" | "period_end" | "content" | "credits_used" | "created_at">[];

  const disabledReason = !isGeminiConfigured()
    ? "AI briefings are not configured for this deployment yet."
    : app.credits.balance < CREDIT_COSTS.briefing
      ? `A briefing needs ${CREDIT_COSTS.briefing} credits; you have ${app.credits.balance}.`
      : undefined;

  return (
    <>
      <PageHeader
        title="Briefings"
        description="A written briefing on your pipeline: what changed, what needs attention, important opportunities, risks and recommended actions. The AI writes from your workspace figures, which are stored beside every briefing so each statement can be checked."
        actions={<GenerateBriefingForm disabledReason={disabledReason} />}
      />
      <Panel title="History" description="Every briefing is kept and visible to your whole team" flush>
        {briefings.length === 0 ? (
          <EmptyState title="No briefings yet" body="Choose a period and generate your first briefing. You need some pipeline data first — a briefing never fills gaps with invented numbers." />
        ) : (
          <ul className="divide-y divide-line/70">
            {briefings.map((b) => (
              <li key={b.id} className="px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/briefings/${b.id}`} className="font-serif text-lg font-semibold hover:underline">{b.title}</Link>
                  <div className="flex items-center gap-2"><AiLabel /><span className="badge-neutral">{titleCase(b.cadence)}</span></div>
                </div>
                <p className="mt-1 text-sm">{b.content.headline}</p>
                <p className="mt-1 text-xs text-mute">{b.period_start} to {b.period_end} · generated {dateTime(b.created_at)} · {b.credits_used} credits</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
