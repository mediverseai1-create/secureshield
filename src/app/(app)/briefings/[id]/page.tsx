import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApp } from "@/lib/context";
import type { BriefingMetrics } from "@/lib/briefing";
import { money, titleCase, dateTime } from "@/lib/format";
import type { BriefingRow } from "@/lib/types";
import { AiLabel, Alert, DataLabel, PageHeader, Panel, ScrollTable } from "@/components/ui";

export const metadata: Metadata = { title: "Briefing" };

function Section({ title, items }: { title: string; items: { title: string; detail: string }[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-2 font-serif text-lg font-semibold">{title}</h3>
      <ul className="space-y-3">
        {items.map((i, n) => (
          <li key={n} className="border-l-2 border-gold pl-4 text-sm">
            <p className="font-semibold">{i.title}</p>
            <p className="text-mute">{i.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await requireApp();
  const { data } = await app.supabase.from("briefings").select("*").eq("id", id).eq("org_id", app.org.id).maybeSingle<BriefingRow>();
  if (!data) notFound();
  const c = data.content;
  const m = data.metrics as unknown as BriefingMetrics;

  return (
    <>
      <p className="mb-2 text-sm no-print"><Link href="/briefings" className="link">← Briefings</Link></p>
      <PageHeader title={data.title} description={`${data.period_start} to ${data.period_end} · generated ${dateTime(data.created_at)} · ${data.credits_used} credits`} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Briefing" actions={<AiLabel>AI-generated · {data.model}</AiLabel>}>
          <div className="space-y-7">
            <p className="font-serif text-2xl leading-snug font-semibold">{c.headline}</p>
            {c.what_changed.length > 0 && (
              <section>
                <h3 className="mb-2 font-serif text-lg font-semibold">What changed</h3>
                <ul className="list-disc space-y-1.5 pl-5 text-sm">{c.what_changed.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </section>
            )}
            <Section title="What requires attention" items={c.needs_attention} />
            <Section title="Important opportunities" items={c.important_opportunities} />
            <Section title="Risks in the pipeline" items={c.risks} />
            {c.recommended_actions.length > 0 && (
              <section>
                <h3 className="mb-2 font-serif text-lg font-semibold">Recommended actions</h3>
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  {c.recommended_actions.map((a, i) => (
                    <li key={i}><span className="font-semibold">{a.title}</span> — <span className="text-mute">{a.reason}</span></li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-mute">To work these items, use the <Link href="/actions" className="link">Actions</Link> queue.</p>
              </section>
            )}
            {c.strategy && (
              <section className="bg-gold-soft/50 px-4 py-3">
                <h3 className="label">Where to put effort next</h3>
                <p className="text-sm">{c.strategy}</p>
              </section>
            )}
            {c.data_gaps.length > 0 && (
              <Alert kind="info" title="Limits of the data">
                <ul className="list-disc pl-5">{c.data_gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
              </Alert>
            )}
            <p className="text-xs text-mute">Written by an AI model from the workspace figures shown on the right. Review before acting; the team makes the decisions.</p>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="The figures behind this briefing" description="Raw workspace data handed to the AI" actions={<DataLabel />} flush>
            <dl className="divide-y divide-line/70 text-sm">
              {[
                ["Open pipeline", `${money(m.pipeline_now?.open_value)} across ${m.pipeline_now?.open_deals} deals`],
                ["Weighted", money(m.pipeline_now?.weighted_value)],
                ["Win rate (all time)", m.pipeline_now?.win_rate_percent === null ? "n/a" : `${m.pipeline_now?.win_rate_percent}%`],
                ["Created this period", `${m.this_period?.opportunities_created.count} deals · ${money(m.this_period?.opportunities_created.value)}`],
                ["Created previous period", `${m.this_period?.opportunities_created_previous_period.count} deals · ${money(m.this_period?.opportunities_created_previous_period.value)}`],
                ["Won this period", `${m.this_period?.won.count} · ${money(m.this_period?.won.value)}`],
                ["Lost this period", `${m.this_period?.lost.count} · ${money(m.this_period?.lost.value)}`],
                ["Activities", `${m.this_period?.activities.count} (previous ${m.this_period?.activities.previous_period})`],
                ["New leads", String(m.this_period?.new_leads)],
                ["Stalled 14+ days", String(m.deals_needing_attention?.stalled_14_days_plus.length)],
                ["Past expected close", String(m.deals_needing_attention?.past_expected_close.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2"><dt className="text-mute">{k}</dt><dd className="text-right font-medium tabular-nums">{v}</dd></div>
              ))}
            </dl>
          </Panel>
          {m.deals_needing_attention?.stalled_14_days_plus.length > 0 && (
            <Panel title="Stalled deals in the data" flush actions={<DataLabel />}>
              <ScrollTable>
                <table className="tbl">
                  <thead><tr><th>Deal</th><th>Stage</th><th className="text-right">Amount</th><th className="text-right">Idle</th></tr></thead>
                  <tbody>
                    {m.deals_needing_attention.stalled_14_days_plus.map((d, i) => (
                      <tr key={i}><td>{d.deal}<p className="text-xs text-mute">{d.account}</p></td><td>{titleCase(d.stage)}</td><td className="text-right tabular-nums">{money(d.amount)}</td><td className="text-right tabular-nums">{d.idle_days}d</td></tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
