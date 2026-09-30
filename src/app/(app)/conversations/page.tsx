import type { Metadata } from "next";
import Link from "next/link";
import { requireApp } from "@/lib/context";
import { loadAll, paginate } from "@/lib/data";
import { readParams, type SearchParams } from "@/lib/params";
import { accountOptions } from "@/lib/options";
import { conversationPatterns } from "@/lib/analytics";
import { isGeminiConfigured } from "@/lib/gemini";
import { dateShort } from "@/lib/format";
import type { Account, Conversation, ConversationAnalysis, Opportunity } from "@/lib/types";
import { NewConversationButton } from "@/components/conversation-ui";
import { AutoSubmitForm } from "@/components/forms";
import { Donut } from "@/components/charts";
import { EmptyState, PageHeader, Pager, Panel, ScrollTable, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Conversations" };
export const maxDuration = 120;
const PAGE_SIZE = 20;

export default async function ConversationsPage({ searchParams }: { searchParams: SearchParams }) {
  const app = await requireApp();
  const p = await readParams(searchParams);
  const [convs, analyses, accounts, opps] = await Promise.all([
    loadAll<Conversation>(app.supabase, "conversations", app.org.id, "occurred_at"),
    loadAll<ConversationAnalysis>(app.supabase, "conversation_analyses", app.org.id),
    loadAll<Account>(app.supabase, "accounts", app.org.id, "name"),
    loadAll<Opportunity>(app.supabase, "opportunities", app.org.id, "name"),
  ]);
  const analysisBy = new Map(analyses.map((a) => [a.conversation_id, a]));
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const q = (p.q ?? "").trim().toLowerCase();
  const rows = convs
    .filter((c) => {
      const a = analysisBy.get(c.id);
      if (p.sentiment && a?.sentiment !== p.sentiment) return false;
      if (p.status && c.status !== p.status) return false;
      if (q && !`${c.title} ${accountName.get(c.account_id ?? "") ?? ""} ${a?.summary ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .reverse();
  const pageData = paginate(rows, Number(p.page ?? 1), PAGE_SIZE);
  const params = { q: p.q, sentiment: p.sentiment, status: p.status };
  const pat = conversationPatterns(analyses);

  return (
    <>
      <PageHeader
        title="Conversations"
        description="Calls and transcripts stored in your workspace. Each analysed conversation gets a summary, intent, sentiment, objections, commitments, competitors, decision criteria and a next action."
        actions={
          <NewConversationButton
            accounts={accountOptions(accounts)}
            opportunities={opps.map((o) => ({ value: o.id, label: o.name }))}
            aiReady={isGeminiConfigured()}
            balance={app.credits.balance}
          />
        }
      />

      {pat.total > 0 && (
        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <Panel title="Sentiment" description={`${pat.total} analysed conversations`}>
            <Donut
              height={190}
              data={[
                { name: "Positive", value: pat.sentiments.positive, color: "#2b7a55" },
                { name: "Neutral", value: pat.sentiments.neutral, color: "#8a94a1" },
                { name: "Mixed", value: pat.sentiments.mixed, color: "#f0b429" },
                { name: "Negative", value: pat.sentiments.negative, color: "#b4443a" },
              ].filter((d) => d.value > 0)}
            />
          </Panel>
          <Panel title="Most common objections" flush>
            {pat.objections.length === 0 ? <EmptyState compact title="None recorded" /> : (
              <ul className="divide-y divide-line/70 text-sm">
                {pat.objections.slice(0, 6).map((o) => (
                  <li key={o.label} className="flex justify-between gap-3 px-4 py-2"><span>{o.label}</span><span className="tabular-nums text-mute">{o.count}</span></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Competitors mentioned" flush>
            {pat.competitors.length === 0 ? <EmptyState compact title="None mentioned" /> : (
              <ul className="divide-y divide-line/70 text-sm">
                {pat.competitors.slice(0, 6).map((o) => (
                  <li key={o.label} className="flex justify-between gap-3 px-4 py-2"><span>{o.label}</span><span className="tabular-nums text-mute">{o.count}</span></li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      <Panel flush>
        <div className="border-b border-line p-3">
          <AutoSubmitForm className="flex flex-wrap items-center gap-2">
            <input type="search" name="q" defaultValue={p.q} placeholder="Search title, account or summary" className="input !w-full sm:!w-72" aria-label="Search conversations" />
            <select name="sentiment" defaultValue={p.sentiment ?? ""} className="input !w-auto" aria-label="Filter by sentiment">
              <option value="">All sentiment</option>
              <option value="positive">Positive</option><option value="neutral">Neutral</option><option value="mixed">Mixed</option><option value="negative">Negative</option>
            </select>
            <select name="status" defaultValue={p.status ?? ""} className="input !w-auto" aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="analyzed">Analysed</option><option value="pending">Not analysed</option><option value="failed">Failed</option>
            </select>
          </AutoSubmitForm>
        </div>
        {convs.length === 0 ? (
          <EmptyState title="No conversations yet" body="Add a call recording or transcript. The analysis and follow-up actions are produced from the conversation itself — nothing is invented." />
        ) : rows.length === 0 ? (
          <EmptyState compact title="No conversations match these filters" />
        ) : (
          <ScrollTable>
            <table className="tbl min-w-[760px]">
              <thead><tr><th>Conversation</th><th>Account</th><th>Date</th><th>Type</th><th>Status</th><th>Sentiment</th><th>Next action</th></tr></thead>
              <tbody>
                {pageData.rows.map((c) => {
                  const a = analysisBy.get(c.id);
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/conversations/${c.id}`} className="font-medium hover:underline">{c.title}</Link></td>
                      <td>{c.account_id ? accountName.get(c.account_id) : <span className="text-mute">—</span>}</td>
                      <td className="whitespace-nowrap">{dateShort(c.occurred_at)}</td>
                      <td>{c.source_type === "audio" ? "Recording" : "Transcript"}</td>
                      <td><StatusBadge value={c.status} /></td>
                      <td>{a?.sentiment ? <StatusBadge value={a.sentiment} /> : <span className="text-mute">—</span>}</td>
                      <td className="max-w-xs truncate text-mute">{a?.next_action ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
        )}
        <Pager page={pageData.page} pageSize={PAGE_SIZE} total={pageData.total} basePath="/conversations" params={params} />
      </Panel>
    </>
  );
}
