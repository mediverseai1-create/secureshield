import type { Metadata } from "next";
import Link from "next/link";
import { requireApp } from "@/lib/context";
import { loadAll, loadMembers, memberName, paginate } from "@/lib/data";
import { compare, readParams, type SearchParams } from "@/lib/params";
import { accountOptions, memberOptions } from "@/lib/options";
import { isOpen, lastTouch, pipelineSummary } from "@/lib/analytics";
import { money, pct, dateShort, relative, daysBetween } from "@/lib/format";
import { STAGES, STAGE_LABELS, type Account, type Activity, type Opportunity } from "@/lib/types";
import { AlertTriangle } from "lucide-react";
import { AutoSubmitForm } from "@/components/forms";
import { BarSeries } from "@/components/charts";
import { ImportButton } from "@/components/import-wizard";
import { DeleteButton, OpportunityFormModal, StageSelect, ActivityFormModal } from "@/components/record-forms";
import { EmptyState, PageHeader, Pager, Panel, ScrollTable, SortLink, Stat, StageBadge } from "@/components/ui";
import { isAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: "Pipeline" };
const PAGE_SIZE = 25;

export default async function PipelinePage({ searchParams }: { searchParams: SearchParams }) {
  const app = await requireApp();
  const p = await readParams(searchParams);
  const [opps, accounts, activities, members] = await Promise.all([
    loadAll<Opportunity>(app.supabase, "opportunities", app.org.id),
    loadAll<Account>(app.supabase, "accounts", app.org.id, "name"),
    loadAll<Activity>(app.supabase, "activities", app.org.id, "occurred_at"),
    loadMembers(app.supabase, app.org.id),
  ]);
  const now = new Date();
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const summary = pipelineSummary(opps);
  const view = p.view === "table" ? "table" : "board";
  const sort = p.sort ?? "updated";
  const dir = p.dir === "asc" ? "asc" : "desc";
  const q = (p.q ?? "").trim().toLowerCase();

  let rows = opps.filter((o) => {
    if (p.stage && o.stage !== p.stage) return false;
    if (p.owner && (p.owner === "none" ? o.owner_id : o.owner_id !== p.owner)) return false;
    if (q && !`${o.name} ${accountName.get(o.account_id ?? "") ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const touch = new Map(rows.map((o) => [o.id, lastTouch(o, activities)]));
  rows = rows.sort((a, b) => {
    switch (sort) {
      case "name": return compare(a.name, b.name, dir);
      case "amount": return compare(Number(a.amount), Number(b.amount), dir);
      case "stage": return compare(STAGES.indexOf(a.stage), STAGES.indexOf(b.stage), dir);
      case "close": return compare(a.expected_close_date ?? "9999", b.expected_close_date ?? "9999", dir);
      case "probability": return compare(a.probability, b.probability, dir);
      default: return compare(a.updated_at, b.updated_at, dir);
    }
  });

  const pageData = paginate(rows, Number(p.page ?? 1), PAGE_SIZE);
  const acctOpts = accountOptions(accounts);
  const memOpts = memberOptions(members);
  const admin = isAdmin(app.role);
  const params = { q: p.q, stage: p.stage, owner: p.owner, view, sort: p.sort, dir: p.dir };
  const chartData = summary.byStage.map((s) => ({ stage: STAGE_LABELS[s.stage], value: s.value, count: s.count }));
  const stalledCount = opps.filter((o) => isOpen(o) && daysBetween(now, lastTouch(o, activities)) >= 14).length;

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Every opportunity in your workspace, by stage. Changes are saved to your organization's database and tracked in stage history."
        actions={
          <>
            <ImportButton kind="opportunities" memberEmails={members.map((m) => m.profile?.email ?? "").filter(Boolean)} accountNames={accounts.map((a) => a.name)} />
            <OpportunityFormModal accounts={acctOpts} members={memOpts} />
          </>
        }
      />

      {opps.length === 0 ? (
        <Panel>
          <EmptyState
            title="No opportunities yet"
            body="Create your first opportunity, or import a CSV export from your CRM. Pipeline metrics, briefings and actions are all calculated from what you add here."
          />
        </Panel>
      ) : (
        <>
          <div className="panel mb-6 grid grid-cols-2 lg:grid-cols-5">
            <Stat label="Open pipeline" value={money(summary.openValue, "USD", true)} sub={`${summary.openCount} open deals`} />
            <Stat label="Weighted" value={money(summary.weightedValue, "USD", true)} sub="amount × probability" />
            <Stat label="Won" value={money(summary.wonValue, "USD", true)} sub={`${summary.wonCount} deals`} />
            <Stat label="Win rate" value={summary.winRate === null ? "—" : pct(summary.winRate)} sub={summary.wonCount + summary.lostCount ? `${summary.wonCount + summary.lostCount} closed` : "no closed deals"} />
            <Stat label="Stalled" value={stalledCount} sub="no activity 14+ days" />
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="Value by stage" description="Sum of deal amounts in each stage">
              <BarSeries data={chartData} xKey="stage" series={[{ key: "value", label: "Value" }]} height={220} />
            </Panel>
            <Panel title="Deals by stage">
              <ul className="space-y-2 text-sm">
                {summary.byStage.map((s) => (
                  <li key={s.stage} className="flex items-center justify-between border-b border-line/60 pb-1.5">
                    <StageBadge stage={s.stage} />
                    <span className="tabular-nums text-mute">
                      {s.count} · {money(s.value, "USD", true)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel flush>
            <div className="border-b border-line p-3">
              <AutoSubmitForm className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="view" value={view} />
                <input type="search" name="q" defaultValue={p.q} placeholder="Search name or account" className="input !w-full sm:!w-64" aria-label="Search opportunities" />
                <select name="stage" defaultValue={p.stage ?? ""} className="input !w-auto" aria-label="Filter by stage">
                  <option value="">All stages</option>
                  {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
                <select name="owner" defaultValue={p.owner ?? ""} className="input !w-auto" aria-label="Filter by owner">
                  <option value="">All owners</option>
                  <option value="none">Unassigned</option>
                  {memOpts.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select name="sort" defaultValue={p.sort ?? "updated"} className="input !w-auto" aria-label="Sort by">
                  <option value="updated">Recently updated</option>
                  <option value="amount">Amount</option>
                  <option value="close">Close date</option>
                  <option value="probability">Probability</option>
                  <option value="name">Name</option>
                  <option value="stage">Stage</option>
                </select>
                <select name="dir" defaultValue={dir} className="input !w-auto" aria-label="Sort direction">
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
                <div className="ml-auto flex border border-line text-xs font-semibold" role="group" aria-label="View">
                  <Link href={`/pipeline?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v) as [string, string][]), view: "board" })}`} className={`px-3 py-2 ${view === "board" ? "bg-ink text-paper-light" : "hover:bg-paper-dark"}`}>Board</Link>
                  <Link href={`/pipeline?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v) as [string, string][]), view: "table" })}`} className={`px-3 py-2 ${view === "table" ? "bg-ink text-paper-light" : "hover:bg-paper-dark"}`}>Table</Link>
                </div>
              </AutoSubmitForm>
            </div>

            {rows.length === 0 ? (
              <EmptyState compact title="No opportunities match these filters" body="Clear the search or filters to see everything." />
            ) : view === "board" ? (
              <div className="overflow-x-auto p-3">
                <div className="grid min-w-[1100px] grid-cols-6 gap-3">
                  {STAGES.map((stage) => {
                    const col = rows.filter((o) => o.stage === stage);
                    return (
                      <div key={stage} className="bg-paper/70">
                        <div className="flex items-center justify-between border-b border-line px-2.5 py-2">
                          <span className="text-xs font-semibold tracking-wide uppercase">{STAGE_LABELS[stage]}</span>
                          <span className="text-xs text-mute tabular-nums">{col.length} · {money(col.reduce((s, o) => s + Number(o.amount), 0), "USD", true)}</span>
                        </div>
                        <ul className="space-y-2 p-2">
                          {col.map((o) => {
                            const idle = daysBetween(now, touch.get(o.id) ?? now);
                            return (
                              <li key={o.id} className="border border-line bg-paper-light p-2.5 text-sm">
                                <Link href={`/pipeline/${o.id}`} className="font-semibold hover:underline">{o.name}</Link>
                                <p className="text-xs text-mute">{accountName.get(o.account_id ?? "") ?? "No account"}</p>
                                <p className="mt-1 font-serif text-base font-semibold tabular-nums">{money(Number(o.amount), o.currency)}</p>
                                <p className="text-xs text-mute">
                                  {o.probability}% · {o.expected_close_date ? `close ${dateShort(o.expected_close_date)}` : "no close date"}
                                </p>
                                {isOpen(o) && idle >= 14 && (
                                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-watch"><AlertTriangle className="h-3 w-3" aria-hidden /> idle {idle}d</p>
                                )}
                                <div className="mt-2"><StageSelect id={o.id} stage={o.stage} /></div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <ScrollTable>
                <table className="tbl min-w-[900px]">
                  <thead>
                    <tr>
                      <th><SortLink label="Opportunity" field="name" basePath="/pipeline" params={params} sort={sort} dir={dir} /></th>
                      <th>Account</th>
                      <th><SortLink label="Stage" field="stage" basePath="/pipeline" params={params} sort={sort} dir={dir} /></th>
                      <th className="text-right"><SortLink label="Amount" field="amount" basePath="/pipeline" params={params} sort={sort} dir={dir} /></th>
                      <th className="text-right"><SortLink label="Prob." field="probability" basePath="/pipeline" params={params} sort={sort} dir={dir} /></th>
                      <th><SortLink label="Close" field="close" basePath="/pipeline" params={params} sort={sort} dir={dir} /></th>
                      <th>Owner</th>
                      <th>Last touch</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.rows.map((o) => (
                      <tr key={o.id}>
                        <td className="font-medium"><Link href={`/pipeline/${o.id}`} className="hover:underline">{o.name}</Link></td>
                        <td>{o.account_id ? <Link href={`/accounts/${o.account_id}`} className="hover:underline">{accountName.get(o.account_id)}</Link> : <span className="text-mute">—</span>}</td>
                        <td><StageSelect id={o.id} stage={o.stage} /></td>
                        <td className="text-right tabular-nums">{money(Number(o.amount), o.currency)}</td>
                        <td className="text-right tabular-nums">{o.probability}%</td>
                        <td className="whitespace-nowrap">{dateShort(o.expected_close_date)}</td>
                        <td>{memberName(members, o.owner_id)}</td>
                        <td className="whitespace-nowrap text-mute">{relative(touch.get(o.id)?.toISOString())}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <ActivityFormModal opportunityId={o.id} accountId={o.account_id ?? undefined} label="Log" />
                            <OpportunityFormModal opp={o} accounts={acctOpts} members={memOpts} />
                            {admin && <DeleteButton table="opportunities" id={o.id} label={o.name} />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            )}
            {view === "table" && <Pager page={pageData.page} pageSize={PAGE_SIZE} total={pageData.total} basePath="/pipeline" params={params} />}
          </Panel>
        </>
      )}
    </>
  );
}
