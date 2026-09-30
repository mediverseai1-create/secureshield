import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApp } from "@/lib/context";
import { loadAll, loadMembers, memberName } from "@/lib/data";
import { accountOptions, memberOptions } from "@/lib/options";
import { dateShort, dateTime, money, titleCase } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";
import type { Account, Activity, Conversation, Opportunity, StageHistory } from "@/lib/types";
import { ActivityFormModal, DeleteButton, OpportunityFormModal } from "@/components/record-forms";
import { DataLabel, EmptyState, PageHeader, Panel, StageBadge, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Opportunity" };

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await requireApp();
  const { data: opp } = await app.supabase.from("opportunities").select("*").eq("id", id).eq("org_id", app.org.id).maybeSingle<Opportunity>();
  if (!opp) notFound();

  const [accounts, members, history, activities, conversations] = await Promise.all([
    loadAll<Account>(app.supabase, "accounts", app.org.id, "name"),
    loadMembers(app.supabase, app.org.id),
    app.supabase.from("opportunity_stage_history").select("*").eq("opportunity_id", id).order("changed_at", { ascending: false }).then((r) => (r.data ?? []) as StageHistory[]),
    app.supabase.from("activities").select("*").eq("opportunity_id", id).order("occurred_at", { ascending: false }).limit(50).then((r) => (r.data ?? []) as Activity[]),
    app.supabase.from("conversations").select("id,title,occurred_at,status").eq("opportunity_id", id).order("occurred_at", { ascending: false }).then((r) => (r.data ?? []) as Pick<Conversation, "id" | "title" | "occurred_at" | "status">[]),
  ]);
  const account = accounts.find((a) => a.id === opp.account_id);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/pipeline" className="link">← Pipeline</Link></p>
      <PageHeader
        title={opp.name}
        description={account ? `Account: ${account.name}` : "No account linked"}
        actions={
          <>
            <ActivityFormModal opportunityId={opp.id} accountId={opp.account_id ?? undefined} />
            <OpportunityFormModal opp={opp} accounts={accountOptions(accounts)} members={memberOptions(members)} />
            {isAdmin(app.role) && <DeleteButton table="opportunities" id={opp.id} label={opp.name} redirectTo="/pipeline" />}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Details" actions={<DataLabel />}>
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
              <div><dt className="label">Stage</dt><dd><StageBadge stage={opp.stage} /></dd></div>
              <div><dt className="label">Amount</dt><dd className="font-serif text-lg font-semibold">{money(Number(opp.amount), opp.currency)}</dd></div>
              <div><dt className="label">Probability</dt><dd>{opp.probability}%</dd></div>
              <div><dt className="label">Expected close</dt><dd>{dateShort(opp.expected_close_date)}</dd></div>
              <div><dt className="label">Owner</dt><dd>{memberName(members, opp.owner_id)}</dd></div>
              <div><dt className="label">Source</dt><dd>{opp.source ?? "—"}</dd></div>
              <div className="sm:col-span-3"><dt className="label">Next step</dt><dd>{opp.next_step ?? <span className="text-mute">None recorded</span>}</dd></div>
              {opp.lost_reason && <div className="sm:col-span-3"><dt className="label">Loss reason</dt><dd>{opp.lost_reason}</dd></div>}
              {opp.notes && <div className="sm:col-span-3"><dt className="label">Notes</dt><dd className="whitespace-pre-wrap">{opp.notes}</dd></div>}
            </dl>
          </Panel>

          <Panel title="Activity" flush>
            {activities.length === 0 ? (
              <EmptyState compact title="No activity logged" body="Log calls, emails and meetings against this deal. Stalled-deal detection uses these dates." />
            ) : (
              <ul className="divide-y divide-line/70">
                {activities.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{a.subject}</span>
                      <span className="badge-neutral">{titleCase(a.type)}</span>
                    </div>
                    <p className="text-xs text-mute">{dateShort(a.occurred_at)}</p>
                    {a.notes && <p className="mt-1 whitespace-pre-wrap text-mute">{a.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Stage history" flush>
            {history.length === 0 ? (
              <EmptyState compact title="No history yet" />
            ) : (
              <ol className="divide-y divide-line/70">
                {history.map((h) => (
                  <li key={h.id} className="px-4 py-2.5 text-sm">
                    {h.from_stage ? `${titleCase(h.from_stage)} → ${titleCase(h.to_stage)}` : `Created in ${titleCase(h.to_stage)}`}
                    <p className="text-xs text-mute">{dateTime(h.changed_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          <Panel title="Related conversations" flush>
            {conversations.length === 0 ? (
              <EmptyState compact title="No conversations linked" />
            ) : (
              <ul className="divide-y divide-line/70">
                {conversations.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <Link href={`/conversations/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                    <StatusBadge value={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
