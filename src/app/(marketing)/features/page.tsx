import type { Metadata } from "next";
import { CONVERSATION_OUTPUTS, GetStarted, Section, SectionHead, SignIn, Tick } from "@/components/marketing";
import { SCORING_CRITERIA } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Features",
  description: "Pipeline intelligence, briefings, actions, lead scoring and conversation analysis — inside an isolated, role-controlled workspace.",
};

const FEATURES = [
  {
    id: "pipeline",
    name: "Pipeline intelligence",
    lead: "Real pipeline records, real arithmetic.",
    body: "Track opportunities through six stages with values, probabilities, owners and expected close dates. Move deals on a board or edit them in a table; every stage change is written to history. Accounts, contacts and leads live alongside, and logged calls, emails and meetings feed engagement measures.",
    points: ["Pipeline value, weighted value, win rate and average deal size computed from your records", "Stalled-deal and overdue-close detection with the threshold stated", "Search, filter and sort across opportunities, accounts and leads", "CSV import with validation and a preview before anything is saved"],
  },
  {
    id: "briefings",
    name: "Briefings",
    lead: "A written account of what changed, grounded in your figures.",
    body: "Choose a period — from daily to quarterly — and the AI writes a briefing: what changed, what needs attention, important opportunities, risks and recommended actions. The exact figures it was given are stored beside it, so any statement can be checked. Where the data is too thin, the briefing says so instead of filling the gap.",
    points: ["AI-generated text is labelled and kept apart from raw data", "Every briefing is saved and visible to the whole team", "Recommendations name the deal or account and the reason"],
  },
  {
    id: "actions",
    name: "Actions",
    lead: "A queue to work through, not advice to interpret.",
    body: "Actions are found in your pipeline and conversations by stated rules — a deal with no activity for 14 days, a qualified lead nobody has contacted, an objection raised on a call. Each one shows why it exists and links to its source. Complete it, dismiss it, or have a follow-up message drafted from the record.",
    points: ["Finding actions uses your data only and costs no credits", "Completed and dismissed actions are not recreated", "Drafted messages are grounded in the linked records and never sent for you"],
  },
  {
    id: "scoring",
    name: "Lead scoring",
    lead: "A score you can explain to the rep who owns the lead.",
    body: "Each lead is scored out of 100 from five published criteria. The breakdown is one click away on every lead, and the score is recalculated from current data each time, so it improves as activity is logged. No hidden model; no arbitrary numbers.",
    points: SCORING_CRITERIA.map((c) => `${c.label} — up to ${c.max} points`),
  },
  {
    id: "conversations",
    name: "Conversations",
    lead: "Safe to use on sensitive calls.",
    body: "Upload a recording or a transcript, or paste the text. Recordings are stored privately in your workspace. The AI reads the conversation and produces the analysis below. It works only from what was said; where something was not said, the field stays empty.",
    points: CONVERSATION_OUTPUTS,
  },
];

const EXTRA = [
  ["AI Assistant", "Ask questions in plain language — “Which opportunities need attention?” — and get answers drawn from your workspace data, or a plain statement that the data does not contain the answer."],
  ["Insights", "Patterns detected in your own records: stalled value, pipeline and activity changes, lead quality, account engagement and repeated objections. Each shows the figures behind it."],
  ["Reports", "Pipeline overview, revenue intelligence, lead performance, account activity and conversation intelligence. Export as CSV or JSON, or print to PDF."],
  ["Usage and credits", "A live credit balance, a ledger of every AI operation, a low-credit warning before you run out, and a clear path to upgrade."],
  ["Team and activity", "Invite members, assign roles and review an activity log of who changed what."],
];

export default function FeaturesPage() {
  return (
    <>
      <Section tone="paper" className="!pb-0">
        <div className="max-w-4xl pb-14 lg:pb-20">
          <p className="eyebrow">Features</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">The full revenue loop, on your terms.</h1>
          <p className="mt-6 text-lg leading-relaxed text-mute">
            Five modules over one governed set of records. The AI reads and writes; your team reviews and decides.
          </p>
          <div className="mt-8 flex flex-wrap gap-3"><GetStarted size="lg" /><SignIn size="lg" /></div>
        </div>
      </Section>

      {FEATURES.map((f, i) => (
        <Section key={f.id} id={f.id} tone={i % 2 === 0 ? "light" : "paper"}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div>
              <p className="font-mono text-xs text-gold-deep">0{i + 1}</p>
              <h2 className="mt-1 text-3xl font-semibold sm:text-4xl">{f.name}</h2>
              <p className="mt-3 font-serif text-xl text-ink-700">{f.lead}</p>
              <p className="mt-4 text-base leading-relaxed text-mute">{f.body}</p>
            </div>
            <ul className={`content-start gap-3 text-sm ${f.id === "conversations" ? "grid grid-cols-2" : "space-y-3"}`}>
              {f.points.map((p) => (
                <li key={p} className="flex gap-2 border-b border-line pb-3"><Tick />{p}</li>
              ))}
            </ul>
          </div>
        </Section>
      ))}

      <Section tone="paper">
        <SectionHead eyebrow="Around the loop" title="The rest of the workspace." />
        <dl className="grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
          {EXTRA.map(([t, d]) => (
            <div key={t} className="bg-paper-light p-6">
              <dt className="font-serif text-lg font-semibold">{t}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-mute">{d}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section tone="ink">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl leading-tight font-semibold sm:text-4xl">Put AI on your pipeline without opening your data to anyone else.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><GetStarted size="lg" /><SignIn tone="dark" size="lg" /></div>
        </div>
      </Section>
    </>
  );
}
