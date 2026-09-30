import type { Metadata } from "next";
import Link from "next/link";
import { requireApp } from "@/lib/context";
import { loadMembers, memberName } from "@/lib/data";
import { readParams, type SearchParams } from "@/lib/params";
import { isGeminiConfigured } from "@/lib/gemini";
import { CREDIT_COSTS } from "@/lib/plans";
import { dateShort, titleCase } from "@/lib/format";
import type { ActionItem } from "@/lib/types";
import { ActionControls, GenerateActionsButton, NewActionButton } from "@/components/intel-ui";
import { AutoSubmitForm } from "@/components/forms";
import { EmptyState, PageHeader, Panel, PriorityBadge, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Actions" };

const SOURCE_LINK: Record<string, (id: string) => string> = {
  opportunity: (id) => `/pipeline/${id}`,
  account: (id) => `/accounts/${id}`,
  conversation: (id) => `/conversations/${id}`,
  lead: () => `/leads`,
};

export default async function ActionsPage({ searchParams }: { searchParams: SearchParams }) {
  const app = await requireApp();
  const p = await readParams(searchParams);
  const status = p.status ?? "open";
  const [members, { data }] = await Promise.all([
    loadMembers(app.supabase, app.org.id),
    app.supabase.from("actions").select("*").eq("org_id", app.org.id).order("created_at", { ascending: false }).limit(1000),
  ]);
  const all = (data ?? []) as ActionItem[];
  const order = { high: 0, medium: 1, low: 2 };
  const counts = { open: all.filter((a) => a.status === "open").length, done: all.filter((a) => a.status === "done").length, dismissed: all.filter((a) => a.status === "dismissed").length };
  const today = new Date().toISOString().slice(0, 10);

  const rows = all
    .filter((a) => a.status === status)
    .filter((a) => !p.priority || a.priority === p.priority)
    .filter((a) => !p.type || a.type === p.type)
    .filter((a) => !p.mine || a.assigned_to === app.userId)
    .sort((a, b) => order[a.priority] - order[b.priority] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  const draftDisabled = !isGeminiConfigured() ? "AI drafting is not configured for this deployment." : app.credits.balance < CREDIT_COSTS.followup_draft ? "Not enough credits." : undefined;
  const overdue = all.filter((a) => a.status === "open" && a.due_date && a.due_date < today).length;

  return (
    <>
      <PageHeader
        title="Actions"
        description="A queue to work through, not advice to interpret. Each action states the record it came from and the condition that triggered it. Finding actions uses your data only — it costs no credits."
        actions={<><GenerateActionsButton /><NewActionButton /></>}
      />
      <div className="panel mb-6 grid grid-cols-2 sm:grid-cols-4">
        <Stat label="Open" value={counts.open} />
        <Stat label="Overdue" value={overdue} />
        <Stat label="Completed" value={counts.done} />
        <Stat label="Dismissed" value={counts.dismissed} />
      </div>

      <Panel flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex border border-line text-xs font-semibold" role="group" aria-label="Status">
            {(["open", "done", "dismissed"] as const).map((s) => (
              <Link key={s} href={`/actions?status=${s}`} aria-current={status === s ? "true" : undefined} className={`px-3 py-2 ${status === s ? "bg-ink text-paper-light" : "hover:bg-paper-dark"}`}>{titleCase(s)} ({counts[s]})</Link>
            ))}
          </div>
          <AutoSubmitForm className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="status" value={status} />
            <select name="priority" defaultValue={p.priority ?? ""} className="input !w-auto" aria-label="Priority">
              <option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <select name="type" defaultValue={p.type ?? ""} className="input !w-auto" aria-label="Type">
              <option value="">All types</option>
              {["follow_up", "review_opportunity", "address_objection", "post_call", "stalled_deal", "lead_outreach", "other"].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={Boolean(p.mine)} className="accent-ink" /> Assigned to me</label>
          </AutoSubmitForm>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={status === "open" ? "Nothing in the queue" : `No ${status} actions`}
            body={status === "open" ? "Use “Find actions from data” to check your pipeline, leads and conversations for follow-ups, or add one yourself." : undefined}
          />
        ) : (
          <ul className="divide-y divide-line/70">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge value={a.priority} />
                    <span className="badge-neutral">{titleCase(a.type)}</span>
                    {a.generated_by === "rules" && <span className="badge-gold">From your data</span>}
                    {a.due_date && <span className={`text-xs ${a.status === "open" && a.due_date < today ? "font-semibold text-risk" : "text-mute"}`}>Due {dateShort(a.due_date)}</span>}
                  </div>
                  <p className="mt-1.5 font-medium">{a.title}</p>
                  {a.reason && <p className="mt-0.5 text-sm text-mute"><span className="font-semibold text-ink-700">Why:</span> {a.reason}</p>}
                  {a.description && <p className="mt-1 text-sm whitespace-pre-wrap text-mute">{a.description}</p>}
                  <p className="mt-1.5 text-xs text-mute">
                    {a.assigned_to ? `Assigned to ${memberName(members, a.assigned_to)}` : "Unassigned"}
                    {a.source_type && a.source_id && SOURCE_LINK[a.source_type] && (
                      <> · <Link className="link" href={SOURCE_LINK[a.source_type](a.source_id)}>Review source {a.source_type}</Link></>
                    )}
                    {a.completed_at && ` · ${a.status} ${dateShort(a.completed_at)}`}
                  </p>
                </div>
                <ActionControls id={a.id} status={a.status} canDraft={Boolean(a.source_id) && a.source_type !== "manual"} draftDisabledReason={draftDisabled} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
