import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApp } from "@/lib/context";
import { loadMembers, memberName } from "@/lib/data";
import { accountOptions, memberOptions } from "@/lib/options";
import { dateShort, money, titleCase } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";
import { isOpen } from "@/lib/analytics";
import type { Account, Activity, Contact, Conversation, ConversationAnalysis, Opportunity } from "@/lib/types";
import { AccountFormModal, ActivityFormModal, ContactFormModal, DeleteButton, OpportunityFormModal } from "@/components/record-forms";
import { DataLabel, EmptyState, PageHeader, Panel, StageBadge, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await requireApp();
  const { data: account } = await app.supabase.from("accounts").select("*").eq("id", id).eq("org_id", app.org.id).maybeSingle<Account>();
  if (!account) notFound();

  const [members, contacts, opps, activities, conversations] = await Promise.all([
    loadMembers(app.supabase, app.org.id),
    app.supabase.from("contacts").select("*").eq("account_id", id).order("created_at").then((r) => (r.data ?? []) as Contact[]),
    app.supabase.from("opportunities").select("*").eq("account_id", id).order("created_at", { ascending: false }).then((r) => (r.data ?? []) as Opportunity[]),
    app.supabase.from("activities").select("*").eq("account_id", id).order("occurred_at", { ascending: false }).limit(50).then((r) => (r.data ?? []) as Activity[]),
    app.supabase.from("conversations").select("id,title,occurred_at,status").eq("account_id", id).order("occurred_at", { ascending: false }).then((r) => (r.data ?? []) as Pick<Conversation, "id" | "title" | "occurred_at" | "status">[]),
  ]);
  const { data: analyses } = conversations.length
    ? await app.supabase.from("conversation_analyses").select("conversation_id,sentiment,next_action").in("conversation_id", conversations.map((c) => c.id))
    : { data: [] as Pick<ConversationAnalysis, "conversation_id" | "sentiment" | "next_action">[] };
  const analysisBy = new Map((analyses ?? []).map((a) => [a.conversation_id, a]));
  const openValue = opps.filter(isOpen).reduce((s, o) => s + Number(o.amount), 0);
  const wonValue = opps.filter((o) => o.stage === "closed_won").reduce((s, o) => s + Number(o.amount), 0);
  const memOpts = memberOptions(members);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/accounts" className="link">← Accounts</Link></p>
      <PageHeader
        title={account.name}
        description={[account.industry, account.country, account.domain].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <ActivityFormModal accountId={account.id} />
            <OpportunityFormModal accounts={accountOptions([account])} members={memOpts} defaultAccountId={account.id} triggerLabel="New opportunity" triggerClassName="btn-outline btn-sm" />
            <AccountFormModal account={account} members={memOpts} />
            {isAdmin(app.role) && <DeleteButton table="accounts" id={account.id} label={account.name} redirectTo="/accounts" />}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {[
          ["Status", <StatusBadge key="s" value={account.status} />],
          ["Owner", memberName(members, account.owner_id)],
          ["Open pipeline", money(openValue)],
          ["Won to date", money(wonValue)],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-paper-light px-4 py-3">
            <p className="label !mb-0.5">{label}</p>
            <div className="font-serif text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Opportunities" actions={<DataLabel />} flush>
            {opps.length === 0 ? (
              <EmptyState compact title="No opportunities" body="Create an opportunity to start tracking revenue for this account." />
            ) : (
              <table className="tbl">
                <thead><tr><th>Name</th><th>Stage</th><th className="text-right">Amount</th><th>Close</th></tr></thead>
                <tbody>
                  {opps.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/pipeline/${o.id}`} className="font-medium hover:underline">{o.name}</Link></td>
                      <td><StageBadge stage={o.stage} /></td>
                      <td className="text-right tabular-nums">{money(Number(o.amount), o.currency)}</td>
                      <td>{dateShort(o.expected_close_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Activity" flush>
            {activities.length === 0 ? (
              <EmptyState compact title="No activity logged" body="Log calls, emails and meetings to track engagement with this account." />
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
          <Panel title="Contacts" actions={<ContactFormModal accountId={account.id} />} flush>
            {contacts.length === 0 ? (
              <EmptyState compact title="No contacts" />
            ) : (
              <ul className="divide-y divide-line/70">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{c.full_name}</p>
                      <p className="truncate text-xs text-mute">{[c.job_title, c.email, c.phone].filter(Boolean).join(" · ")}</p>
                    </div>
                    {isAdmin(app.role) && <DeleteButton table="contacts" id={c.id} label={c.full_name} />}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Related conversations" flush>
            {conversations.length === 0 ? (
              <EmptyState compact title="No conversations linked" body="Link a call or transcript to this account from the Conversations page." />
            ) : (
              <ul className="divide-y divide-line/70">
                {conversations.map((c) => {
                  const a = analysisBy.get(c.id);
                  return (
                    <li key={c.id} className="px-4 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/conversations/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                        {a?.sentiment ? <StatusBadge value={a.sentiment} /> : <StatusBadge value={c.status} />}
                      </div>
                      <p className="text-xs text-mute">{dateShort(c.occurred_at)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {account.notes && (
            <Panel title="Notes">
              <p className="text-sm whitespace-pre-wrap">{account.notes}</p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
