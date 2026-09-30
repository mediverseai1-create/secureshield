import type { Metadata } from "next";
import Link from "next/link";
import { requireApp } from "@/lib/context";
import { loadMembers, loadSnapshot, memberName, paginate } from "@/lib/data";
import { compare, readParams, type SearchParams } from "@/lib/params";
import { memberOptions } from "@/lib/options";
import { accountRollup } from "@/lib/analytics";
import { ACCOUNT_STATUSES } from "@/lib/types";
import { money, relative, titleCase } from "@/lib/format";
import { AccountFormModal } from "@/components/record-forms";
import { ImportButton } from "@/components/import-wizard";
import { AutoSubmitForm } from "@/components/forms";
import { EmptyState, PageHeader, Pager, Panel, ScrollTable, SortLink, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Accounts" };
const PAGE_SIZE = 25;

export default async function AccountsPage({ searchParams }: { searchParams: SearchParams }) {
  const app = await requireApp();
  const p = await readParams(searchParams);
  const [snap, members] = await Promise.all([loadSnapshot(app.supabase, app.org.id), loadMembers(app.supabase, app.org.id)]);
  const sort = p.sort ?? "name";
  const dir = p.dir === "desc" ? "desc" : "asc";
  const q = (p.q ?? "").trim().toLowerCase();

  const rollup = accountRollup(snap)
    .filter((r) => (!p.status || r.account.status === p.status) && (!q || `${r.account.name} ${r.account.domain ?? ""} ${r.account.industry ?? ""}`.toLowerCase().includes(q)))
    .sort((a, b) => {
      switch (sort) {
        case "pipeline": return compare(a.openValue, b.openValue, dir);
        case "won": return compare(a.wonValue, b.wonValue, dir);
        case "activity": return compare(a.lastActivity ?? "", b.lastActivity ?? "", dir);
        case "status": return compare(a.account.status, b.account.status, dir);
        default: return compare(a.account.name, b.account.name, dir);
      }
    });
  const pageData = paginate(rollup, Number(p.page ?? 1), PAGE_SIZE);
  const params = { q: p.q, status: p.status, sort: p.sort, dir: p.dir };

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Companies you sell to, with their pipeline, activity and conversations. Everything here belongs to your workspace."
        actions={
          <>
            <ImportButton kind="accounts" memberEmails={members.map((m) => m.profile?.email ?? "").filter(Boolean)} accountNames={snap.accounts.map((a) => a.name)} />
            <AccountFormModal members={memberOptions(members)} />
          </>
        }
      />
      <Panel flush>
        <div className="border-b border-line p-3">
          <AutoSubmitForm className="flex flex-wrap items-center gap-2">
            <input type="search" name="q" defaultValue={p.q} placeholder="Search accounts" className="input !w-full sm:!w-64" aria-label="Search accounts" />
            <select name="status" defaultValue={p.status ?? ""} className="input !w-auto" aria-label="Filter by status">
              <option value="">All statuses</option>
              {ACCOUNT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
          </AutoSubmitForm>
        </div>
        {snap.accounts.length === 0 ? (
          <EmptyState title="No accounts yet" body="Add an account, or import a CSV. Opportunities, contacts, activity and conversations can then be linked to it." />
        ) : rollup.length === 0 ? (
          <EmptyState compact title="No accounts match" body="Clear the search or filter to see every account." />
        ) : (
          <ScrollTable>
            <table className="tbl min-w-[860px]">
              <thead>
                <tr>
                  <th><SortLink label="Account" field="name" basePath="/accounts" params={params} sort={sort} dir={dir} /></th>
                  <th><SortLink label="Status" field="status" basePath="/accounts" params={params} sort={sort} dir={dir} /></th>
                  <th>Owner</th>
                  <th className="text-right"><SortLink label="Open pipeline" field="pipeline" basePath="/accounts" params={params} sort={sort} dir={dir} /></th>
                  <th className="text-right"><SortLink label="Won" field="won" basePath="/accounts" params={params} sort={sort} dir={dir} /></th>
                  <th className="text-right">Calls</th>
                  <th><SortLink label="Last activity" field="activity" basePath="/accounts" params={params} sort={sort} dir={dir} /></th>
                </tr>
              </thead>
              <tbody>
                {pageData.rows.map((r) => (
                  <tr key={r.account.id}>
                    <td>
                      <Link href={`/accounts/${r.account.id}`} className="font-medium hover:underline">{r.account.name}</Link>
                      {r.account.industry && <p className="text-xs text-mute">{r.account.industry}</p>}
                    </td>
                    <td><StatusBadge value={r.account.status} /></td>
                    <td>{memberName(members, r.account.owner_id)}</td>
                    <td className="text-right tabular-nums">{r.openCount ? `${money(r.openValue)} · ${r.openCount}` : "—"}</td>
                    <td className="text-right tabular-nums">{r.wonValue ? money(r.wonValue) : "—"}</td>
                    <td className="text-right tabular-nums">{r.conversationCount || "—"}</td>
                    <td className="text-mute">{relative(r.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
        <Pager page={pageData.page} pageSize={PAGE_SIZE} total={pageData.total} basePath="/accounts" params={params} />
      </Panel>
    </>
  );
}
