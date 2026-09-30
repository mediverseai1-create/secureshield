import type { Metadata } from "next";
import { requireApp } from "@/lib/context";
import { loadMembers, memberName } from "@/lib/data";
import { readParams, type SearchParams } from "@/lib/params";
import { dateTime } from "@/lib/format";
import { AutoSubmitForm } from "@/components/forms";
import { EmptyState, PageHeader, Pager, Panel, ScrollTable } from "@/components/ui";

export const metadata: Metadata = { title: "Activity" };
const PAGE_SIZE = 50;

interface Log {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  summary: string;
  created_at: string;
}

export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const app = await requireApp();
  const p = await readParams(searchParams);
  const page = Math.max(1, Number(p.page ?? 1));
  const members = await loadMembers(app.supabase, app.org.id);

  let query = app.supabase.from("activity_logs").select("*", { count: "exact" }).eq("org_id", app.org.id).order("created_at", { ascending: false });
  if (p.user) query = query.eq("user_id", p.user);
  if (p.kind) query = query.like("action", `${p.kind}.%`);
  if (p.q) query = query.ilike("summary", `%${p.q.replace(/[%_]/g, "")}%`);
  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const logs = (data ?? []) as Log[];

  return (
    <>
      <PageHeader title="Activity" description="A record of changes made in your workspace: who did what and when. Entries are append-only for members." />
      <Panel flush>
        <div className="border-b border-line p-3">
          <AutoSubmitForm className="flex flex-wrap items-center gap-2">
            <input type="search" name="q" defaultValue={p.q} placeholder="Search activity" className="input !w-full sm:!w-64" aria-label="Search activity" />
            <select name="user" defaultValue={p.user ?? ""} className="input !w-auto" aria-label="Filter by member">
              <option value="">Everyone</option>
              {members.map((m) => <option key={m.user_id} value={m.user_id}>{memberName(members, m.user_id)}</option>)}
            </select>
            <select name="kind" defaultValue={p.kind ?? ""} className="input !w-auto" aria-label="Filter by type">
              <option value="">All types</option>
              {["opportunity", "account", "lead", "conversation", "briefing", "report", "actions", "action", "member", "subscription", "data"].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </AutoSubmitForm>
        </div>
        {logs.length === 0 ? (
          <EmptyState title="No activity yet" body="Changes to records, AI runs, imports and team changes appear here." />
        ) : (
          <ScrollTable>
            <table className="tbl min-w-[600px]">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Type</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-mute">{dateTime(l.created_at)}</td>
                    <td>{l.user_id ? memberName(members, l.user_id) : "System"}</td>
                    <td>{l.summary}</td>
                    <td><span className="badge-neutral">{l.action}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
        <Pager page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/activity" params={{ q: p.q, user: p.user, kind: p.kind }} />
      </Panel>
    </>
  );
}
