import type { Metadata } from "next";
import { requireApp } from "@/lib/context";
import { loadAll, loadMembers, memberName, paginate } from "@/lib/data";
import { compare, readParams, type SearchParams } from "@/lib/params";
import { memberOptions } from "@/lib/options";
import { SCORING_CRITERIA, scoreLead } from "@/lib/scoring";
import { LEAD_STATUSES, type Activity, type Lead } from "@/lib/types";
import { money, relative, titleCase } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";
import { ActivityFormModal, DeleteButton, LeadFormModal } from "@/components/record-forms";
import { ImportButton } from "@/components/import-wizard";
import { AutoSubmitForm } from "@/components/forms";
import { Donut } from "@/components/charts";
import { EmptyState, PageHeader, Pager, Panel, ScrollTable, ScoreBadge, SortLink, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Leads" };
const PAGE_SIZE = 25;

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const app = await requireApp();
  const p = await readParams(searchParams);
  const [leads, activities, members, accounts] = await Promise.all([
    loadAll<Lead>(app.supabase, "leads", app.org.id),
    loadAll<Activity>(app.supabase, "activities", app.org.id, "occurred_at"),
    loadMembers(app.supabase, app.org.id),
    app.supabase.from("accounts").select("name").eq("org_id", app.org.id).limit(10000).then((r) => (r.data ?? []) as { name: string }[]),
  ]);
  const now = new Date();
  const scored = leads.map((l) => ({ lead: l, s: scoreLead(l, activities, now) }));
  const sort = p.sort ?? "score";
  const dir = p.dir === "asc" ? "asc" : "desc";
  const q = (p.q ?? "").trim().toLowerCase();

  const rows = scored
    .filter(({ lead: l, s }) => {
      if (p.status && l.status !== p.status) return false;
      if (p.band && s.band !== p.band) return false;
      if (p.source && (l.source ?? "") !== p.source) return false;
      if (q && !`${l.full_name} ${l.company ?? ""} ${l.email ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case "name": return compare(a.lead.full_name, b.lead.full_name, dir);
        case "value": return compare(Number(a.lead.estimated_value ?? 0), Number(b.lead.estimated_value ?? 0), dir);
        case "status": return compare(a.lead.status, b.lead.status, dir);
        case "created": return compare(a.lead.created_at, b.lead.created_at, dir);
        default: return compare(a.s.score, b.s.score, dir);
      }
    });
  const pageData = paginate(rows, Number(p.page ?? 1), PAGE_SIZE);
  const params = { q: p.q, status: p.status, band: p.band, source: p.source, sort: p.sort, dir: p.dir };
  const sources = [...new Set(leads.map((l) => l.source).filter((s): s is string => Boolean(s)))].sort();
  const memOpts = memberOptions(members);
  const bands = { hot: scored.filter((x) => x.s.band === "hot").length, warm: scored.filter((x) => x.s.band === "warm").length, cold: scored.filter((x) => x.s.band === "cold").length };
  const avg = scored.length ? Math.round(scored.reduce((s, x) => s + x.s.score, 0) / scored.length) : null;

  return (
    <>
      <PageHeader
        title="Leads"
        description="Lead records with a transparent score. The score is calculated from each lead's own data using the criteria shown below — there is no hidden model."
        actions={
          <>
            <ImportButton kind="leads" memberEmails={members.map((m) => m.profile?.email ?? "").filter(Boolean)} accountNames={accounts.map((a) => a.name)} />
            <LeadFormModal members={memOpts} />
          </>
        }
      />

      {leads.length > 0 && (
        <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Panel title="Score distribution" description={avg === null ? undefined : `Average score ${avg} / 100`}>
            <Donut
              height={200}
              data={[
                { name: "Hot (70+)", value: bands.hot, color: "#2b7a55" },
                { name: "Warm (40–69)", value: bands.warm, color: "#f0b429" },
                { name: "Cold (<40)", value: bands.cold, color: "#8a94a1" },
              ].filter((d) => d.value > 0)}
            />
          </Panel>
          <Panel title="How lead scores are calculated" description="Maximum 100 points. Recalculated from stored data each time you open this page.">
            <table className="tbl">
              <thead><tr><th>Criterion</th><th className="text-right">Max</th><th>Rule</th></tr></thead>
              <tbody>
                {SCORING_CRITERIA.map((c) => (
                  <tr key={c.label}><td className="font-medium">{c.label}</td><td className="text-right tabular-nums">{c.max}</td><td className="text-mute">{c.rule}</td></tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}

      <Panel flush>
        <div className="border-b border-line p-3">
          <AutoSubmitForm className="flex flex-wrap items-center gap-2">
            <input type="search" name="q" defaultValue={p.q} placeholder="Search name, company or email" className="input !w-full sm:!w-64" aria-label="Search leads" />
            <select name="status" defaultValue={p.status ?? ""} className="input !w-auto" aria-label="Filter by status">
              <option value="">All statuses</option>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
            <select name="band" defaultValue={p.band ?? ""} className="input !w-auto" aria-label="Filter by score band">
              <option value="">All scores</option>
              <option value="hot">Hot (70+)</option>
              <option value="warm">Warm (40–69)</option>
              <option value="cold">Cold (&lt;40)</option>
            </select>
            <select name="source" defaultValue={p.source ?? ""} className="input !w-auto" aria-label="Filter by source">
              <option value="">All sources</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
          </AutoSubmitForm>
        </div>
        {leads.length === 0 ? (
          <EmptyState title="No leads yet" body="Add a lead or import a CSV. Scores appear as soon as a lead exists, and improve as you log activity." />
        ) : rows.length === 0 ? (
          <EmptyState compact title="No leads match these filters" />
        ) : (
          <ScrollTable>
            <table className="tbl min-w-[900px]">
              <thead>
                <tr>
                  <th><SortLink label="Lead" field="name" basePath="/leads" params={params} sort={sort} dir={dir} /></th>
                  <th><SortLink label="Score" field="score" basePath="/leads" params={params} sort={sort} dir={dir} /></th>
                  <th><SortLink label="Status" field="status" basePath="/leads" params={params} sort={sort} dir={dir} /></th>
                  <th>Source</th>
                  <th>Owner</th>
                  <th className="text-right"><SortLink label="Est. value" field="value" basePath="/leads" params={params} sort={sort} dir={dir} /></th>
                  <th>Last contact</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageData.rows.map(({ lead: l, s }) => (
                  <tr key={l.id}>
                    <td>
                      <p className="font-medium">{l.full_name}</p>
                      <p className="text-xs text-mute">{[l.job_title, l.company].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td>
                      <details>
                        <summary className="cursor-pointer list-none"><ScoreBadge score={s.score} band={s.band} /></summary>
                        <div className="mt-2 w-64 border border-line bg-paper-light p-3 text-xs">
                          <p className="mb-2 font-semibold">Score breakdown</p>
                          <ul className="space-y-1">
                            {s.components.map((c) => (
                              <li key={c.key} className="flex justify-between gap-3">
                                <span>{c.label}<span className="block text-mute">{c.detail}</span></span>
                                <span className="tabular-nums font-semibold">{c.points}/{c.max}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    </td>
                    <td><StatusBadge value={l.status} /></td>
                    <td>{l.source ?? <span className="text-mute">—</span>}</td>
                    <td>{memberName(members, l.owner_id)}</td>
                    <td className="text-right tabular-nums">{l.estimated_value ? money(Number(l.estimated_value)) : "—"}</td>
                    <td className="whitespace-nowrap text-mute">{relative(l.last_contacted_at)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <ActivityFormModal leadId={l.id} label="Log" />
                        <LeadFormModal lead={l} members={memOpts} />
                        {isAdmin(app.role) && <DeleteButton table="leads" id={l.id} label={l.full_name} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
        <Pager page={pageData.page} pageSize={PAGE_SIZE} total={pageData.total} basePath="/leads" params={params} />
      </Panel>
    </>
  );
}
