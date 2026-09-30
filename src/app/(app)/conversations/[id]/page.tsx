import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApp } from "@/lib/context";
import { isGeminiConfigured, GEMINI_MODEL } from "@/lib/gemini";
import { CREDIT_COSTS } from "@/lib/plans";
import { isAdmin } from "@/lib/permissions";
import { dateShort } from "@/lib/format";
import type { Conversation, ConversationAnalysis } from "@/lib/types";
import { AnalyzeButton, DeleteConversationButton } from "@/components/conversation-ui";
import { AiLabel, Alert, DataLabel, EmptyState, PageHeader, Panel, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Conversation" };
export const maxDuration = 120;

function Bullets({ items, empty }: { items: string[]; empty: string }) {
  if (!items?.length) return <p className="text-sm text-mute">{empty}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((i, n) => <li key={n}>{i}</li>)}
    </ul>
  );
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await requireApp();
  const { data: conv } = await app.supabase.from("conversations").select("*").eq("id", id).eq("org_id", app.org.id).maybeSingle<Conversation>();
  if (!conv) notFound();
  const { data: analysis } = await app.supabase.from("conversation_analyses").select("*").eq("conversation_id", id).maybeSingle<ConversationAnalysis>();
  const [{ data: account }, { data: opp }] = await Promise.all([
    conv.account_id ? app.supabase.from("accounts").select("id,name").eq("id", conv.account_id).maybeSingle() : Promise.resolve({ data: null }),
    conv.opportunity_id ? app.supabase.from("opportunities").select("id,name").eq("id", conv.opportunity_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  let audioUrl: string | null = null;
  if (conv.storage_path) {
    const { data } = await app.supabase.storage.from("conversation-files").createSignedUrl(conv.storage_path, 3600);
    audioUrl = data?.signedUrl ?? null;
  }

  const disabledReason = !isGeminiConfigured()
    ? "AI analysis is not configured for this deployment."
    : app.credits.balance < CREDIT_COSTS.conversation_analysis
      ? "Not enough credits for an analysis."
      : undefined;

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/conversations" className="link">← Conversations</Link></p>
      <PageHeader
        title={conv.title}
        description={[dateShort(conv.occurred_at), conv.participants, conv.source_type === "audio" ? "Recording" : "Transcript"].filter(Boolean).join(" · ")}
        actions={
          <>
            <AnalyzeButton id={conv.id} hasAnalysis={Boolean(analysis)} disabledReason={disabledReason} />
            {isAdmin(app.role) && <DeleteConversationButton id={conv.id} title={conv.title} />}
          </>
        }
      />
      {conv.status === "failed" && conv.error && <div className="mb-4"><Alert kind="error" title="The last analysis did not complete">{conv.error}</Alert></div>}

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-mute">
        <span>Status: <StatusBadge value={conv.status} /></span>
        {account && <span>Account: <Link className="link" href={`/accounts/${account.id}`}>{account.name}</Link></span>}
        {opp && <span>Opportunity: <Link className="link" href={`/pipeline/${opp.id}`}>{opp.name}</Link></span>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          {analysis ? (
            <Panel title="Analysis" actions={<AiLabel>AI-generated · {analysis.model ?? GEMINI_MODEL}</AiLabel>}>
              <div className="space-y-5">
                <section>
                  <h3 className="label">Summary</h3>
                  <p className="text-sm whitespace-pre-wrap">{analysis.summary}</p>
                </section>
                <div className="grid gap-5 sm:grid-cols-2">
                  <section>
                    <h3 className="label">Intent</h3>
                    <p className="text-sm">{analysis.intent ?? <span className="text-mute">Not stated in the conversation</span>}</p>
                  </section>
                  <section>
                    <h3 className="label">Sentiment</h3>
                    {analysis.sentiment ? <StatusBadge value={analysis.sentiment} /> : <span className="text-sm text-mute">Not determined</span>}
                    {analysis.sentiment_reasoning && <p className="mt-1 text-sm text-mute">{analysis.sentiment_reasoning}</p>}
                  </section>
                  <section><h3 className="label">Objections</h3><Bullets items={analysis.objections} empty="None raised" /></section>
                  <section><h3 className="label">Commitments</h3><Bullets items={analysis.commitments} empty="None recorded" /></section>
                  <section><h3 className="label">Competitors mentioned</h3><Bullets items={analysis.competitors} empty="None mentioned" /></section>
                  <section><h3 className="label">Decision criteria</h3><Bullets items={analysis.decision_criteria} empty="None stated" /></section>
                </div>
                <section className="border-l-2 border-gold bg-gold-soft/50 px-4 py-3">
                  <h3 className="label">Recommended next action</h3>
                  <p className="text-sm">{analysis.next_action ?? <span className="text-mute">No next action identified</span>}</p>
                </section>
                <p className="text-xs text-mute">
                  Generated from the conversation text only. Review before acting — the team makes the decisions. Follow-up actions appear on the <Link href="/actions" className="link">Actions</Link> page.
                </p>
              </div>
            </Panel>
          ) : (
            <Panel>
              <EmptyState
                title="Not analysed yet"
                body={`Run the analysis to extract the summary, intent, sentiment, objections, commitments, competitors, decision criteria and next action. It uses ${CREDIT_COSTS.conversation_analysis} credits.`}
              />
            </Panel>
          )}
        </div>
        <div className="space-y-6">
          {audioUrl && (
            <Panel title="Recording" actions={<DataLabel />}>
              <audio controls src={audioUrl} className="w-full" preload="none" />
              <p className="mt-2 text-xs text-mute">{conv.file_name}. The link is private to signed-in members of this workspace and expires after an hour.</p>
            </Panel>
          )}
          <Panel title="Transcript" actions={<DataLabel>{conv.source_type === "audio" && analysis ? "AI transcription" : "Source text"}</DataLabel>}>
            {conv.transcript ? (
              <pre className="max-h-[560px] overflow-auto font-sans text-sm whitespace-pre-wrap">{conv.transcript}</pre>
            ) : (
              <p className="text-sm text-mute">The transcript of this recording is produced when you run the analysis.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
