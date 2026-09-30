import type { Metadata } from "next";
import Link from "next/link";
import { requireApp } from "@/lib/context";
import { REPORT_TYPES } from "@/lib/reports";
import { dateTime } from "@/lib/format";
import { GenerateReportForm } from "@/components/intel-ui";
import { EmptyState, PageHeader, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const app = await requireApp();
  const { data } = await app.supabase.from("reports").select("id,type,title,params,created_at").eq("org_id", app.org.id).order("created_at", { ascending: false }).limit(100);
  const reports = (data ?? []) as { id: string; type: string; title: string; params: { periodDays?: number }; created_at: string }[];
  return (
    <>
      <PageHeader
        title="Reports"
        description="Reports are generated from your workspace records and saved as snapshots. Export any report as CSV or JSON, or print it to PDF. They use your data directly — no AI and no credits."
        actions={<GenerateReportForm types={REPORT_TYPES.map((r) => ({ type: r.type, label: r.label }))} />}
      />
      <div className="mb-6 grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-5">
        {REPORT_TYPES.map((r) => (
          <div key={r.type} className="bg-paper-light p-4">
            <p className="font-serif font-semibold">{r.label}</p>
            <p className="mt-1 text-xs text-mute">{r.description}</p>
          </div>
        ))}
      </div>
      <Panel title="Saved reports" flush>
        {reports.length === 0 ? (
          <EmptyState title="No reports yet" body="Choose a report type and period, then generate it. You need some workspace data first." />
        ) : (
          <table className="tbl">
            <thead><tr><th>Report</th><th>Period</th><th>Generated</th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/reports/${r.id}`} className="font-medium hover:underline">{r.title}</Link></td>
                  <td>{r.params?.periodDays ? `${r.params.periodDays} days` : "—"}</td>
                  <td className="text-mute">{dateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
