import type { Metadata } from "next";
import { requireApp } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { hasAnyData } from "@/lib/analytics";
import { dateTime } from "@/lib/format";
import type { InsightRow } from "@/lib/types";
import { RefreshInsightsButton } from "@/components/intel-ui";
import { DataLabel, EmptyState, PageHeader, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Insights" };

const STYLE: Record<string, { bar: string; label: string; badge: string }> = {
  risk: { bar: "border-risk", label: "Risk", badge: "badge-risk" },
  watch: { bar: "border-gold-deep", label: "Watch", badge: "badge-watch" },
  positive: { bar: "border-ok", label: "Positive", badge: "badge-ok" },
  info: { bar: "border-ink-500", label: "Pattern", badge: "badge-neutral" },
};

export default async function InsightsPage() {
  const app = await requireApp();
  const [{ data }, snap] = await Promise.all([
    app.supabase.from("insights").select("*").eq("org_id", app.org.id).order("generated_at", { ascending: false }),
    loadSnapshot(app.supabase, app.org.id),
  ]);
  const rows = ((data ?? []) as InsightRow[]).sort((a, b) => ({ risk: 0, watch: 1, positive: 2, info: 3 })[a.severity] - ({ risk: 0, watch: 1, positive: 2, info: 3 })[b.severity]);
  const generatedAt = rows[0]?.generated_at;

  return (
    <>
      <PageHeader
        title="Insights"
        description="Patterns detected in your own records: stalled deals, pipeline and activity changes, lead quality, account engagement and conversation themes. Each insight carries the figures it was derived from. Computed from your data — no credits used."
        actions={<RefreshInsightsButton />}
      />
      {!hasAnyData(snap) ? (
        <Panel><EmptyState title="No data to analyse yet" body="Add opportunities, leads, accounts or conversations. Insights appear only when the data supports them." /></Panel>
      ) : rows.length === 0 ? (
        <Panel><EmptyState title="No insights generated yet" body="Select “Refresh insights” to analyse your current data. If your data does not show a clear pattern, none will be shown." /></Panel>
      ) : (
        <>
          <p className="mb-3 text-xs text-mute">Last refreshed {dateTime(generatedAt)}. Refresh to recalculate from the latest data.</p>
          <ul className="space-y-3">
            {rows.map((i) => {
              const s = STYLE[i.severity];
              return (
                <li key={i.id} className={`panel border-l-4 ${s.bar} px-5 py-4`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-serif text-lg font-semibold">{i.title}</h2>
                    <div className="flex items-center gap-2"><span className={s.badge}>{s.label}</span><DataLabel>Derived from data</DataLabel></div>
                  </div>
                  <p className="mt-1.5 text-sm text-mute">{i.body}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
