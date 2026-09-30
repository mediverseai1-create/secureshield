import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApp } from "@/lib/context";
import type { ReportData } from "@/lib/reports";
import { money, dateTime } from "@/lib/format";
import { ReportExport } from "@/components/intel-ui";
import { DataLabel, PageHeader, Panel, ScrollTable, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Report" };

const MONEY_COLUMNS = /^(amount|value|weighted value|open pipeline|won to date|pipeline created|revenue won|estimated value)$/i;

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await requireApp();
  const { data } = await app.supabase.from("reports").select("*").eq("id", id).eq("org_id", app.org.id).maybeSingle<{ id: string; title: string; data: ReportData; created_at: string }>();
  if (!data) notFound();
  const r = data.data;

  return (
    <>
      <p className="mb-2 text-sm no-print"><Link href="/reports" className="link">← Reports</Link></p>
      <PageHeader title={data.title} description={`Generated ${dateTime(data.created_at)} · ${app.org.name}`} actions={<ReportExport title={data.title} data={r} />} />
      <p className="mb-4 text-xs text-mute">{r.basis}</p>
      <div className="space-y-6">
        {r.sections.map((s) => (
          <Panel key={s.title} title={s.title} description={s.description} actions={<DataLabel />} flush>
            {s.kpis && (
              <div className="grid grid-cols-2 lg:grid-cols-5">
                {s.kpis.map((k) => <Stat key={k.label} label={k.label} value={k.value} />)}
              </div>
            )}
            {s.columns && s.rows && (
              s.rows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-mute">No records for this section.</p>
              ) : (
                <ScrollTable>
                  <table className="tbl min-w-[600px]">
                    <thead><tr>{s.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {s.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => {
                            const col = s.columns![j];
                            const isMoney = MONEY_COLUMNS.test(col) && typeof cell === "number";
                            return <td key={j} className={typeof cell === "number" ? "text-right tabular-nums" : ""}>{isMoney ? money(cell) : String(cell)}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollTable>
              )
            )}
          </Panel>
        ))}
      </div>
    </>
  );
}
