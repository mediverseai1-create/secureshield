"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Download, Loader2, Printer, RefreshCw, Send, X } from "lucide-react";
import { askAssistant } from "@/actions/assistant";
import { createManualAction, draftFollowUp, generateActionQueue, generateBriefing, generateReport, refreshInsights, setActionStatus } from "@/actions/intelligence";
import { manualActionSchema, type ManualActionValues } from "@/lib/schemas";
import { CREDIT_COSTS } from "@/lib/plans";
import type { ReportData } from "@/lib/reports";
import { Modal } from "./modal";
import { SelectField, SubmitButton, TextArea, TextField } from "./forms";
import { Alert } from "./ui";

/* ----------------------------------------------------------------- Briefing */

export function GenerateBriefingForm({ disabledReason }: { disabledReason?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cadence, setCadence] = useState("weekly");
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="cadence">Briefing period</label>
        <select id="cadence" className="input !w-auto" value={cadence} onChange={(e) => setCadence(e.target.value)} disabled={pending}>
          <option value="daily">Daily (last 1 day)</option>
          <option value="weekly">Weekly (last 7 days)</option>
          <option value="biweekly">Biweekly (last 14 days)</option>
          <option value="monthly">Monthly (last 30 days)</option>
          <option value="quarterly">Quarterly (last 90 days)</option>
        </select>
        <button
          className="btn-primary"
          disabled={pending || Boolean(disabledReason)}
          title={disabledReason}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await generateBriefing(cadence);
              if (!r.ok) return setError(r.error);
              router.push(`/briefings/${r.id}`);
            })
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Writing briefing…" : `Generate briefing (${CREDIT_COSTS.briefing} credits)`}
        </button>
      </div>
      {error && <p className="field-error max-w-md text-right">{error}</p>}
      {disabledReason && <p className="max-w-md text-right text-xs text-mute">{disabledReason}</p>}
    </div>
  );
}

/* ----------------------------------------------------------------- Insights / actions generation */

export function RefreshInsightsButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-mute">{msg}</span>}
      <button
        className="btn-outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await refreshInsights();
            setMsg(r.ok ? (r.count ? `${r.count} insights found` : "No patterns in the data yet") : r.error);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
        Refresh insights
      </button>
    </div>
  );
}

export function GenerateActionsButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-mute" role="status">{msg}</span>}
      <button
        className="btn-outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await generateActionQueue();
            setMsg(r.ok ? (r.created ? `${r.created} new action${r.created === 1 ? "" : "s"} added` : "No new actions — the queue is up to date") : r.error);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
        Find actions from data
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------- Actions */

export function ActionControls({ id, status, canDraft, draftDisabledReason }: { id: string; status: "open" | "done" | "dismissed"; canDraft: boolean; draftDisabledReason?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = (s: "open" | "done" | "dismissed") =>
    start(async () => {
      setError(null);
      const r = await setActionStatus(id, s);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status === "open" ? (
        <>
          {canDraft && <DraftButton id={id} disabledReason={draftDisabledReason} />}
          <button className="btn-primary btn-sm" disabled={pending} onClick={() => set("done")}>
            <Check className="h-3.5 w-3.5" aria-hidden /> Done
          </button>
          <button className="btn-quiet btn-sm" disabled={pending} onClick={() => set("dismissed")}>
            <X className="h-3.5 w-3.5" aria-hidden /> Dismiss
          </button>
        </>
      ) : (
        <button className="btn-outline btn-sm" disabled={pending} onClick={() => set("open")}>
          Reopen
        </button>
      )}
      {error && <p className="field-error w-full text-right">{error}</p>}
    </div>
  );
}

function DraftButton({ id, disabledReason }: { id: string; disabledReason?: string }) {
  return (
    <Modal trigger={`Draft message (${CREDIT_COSTS.followup_draft})`} title="Draft follow-up" description="Written from the linked records only. Review and edit before sending — nothing is sent for you." triggerClassName="btn-outline btn-sm">
      {(close) => <DraftBody id={id} close={close} disabledReason={disabledReason} />}
    </Modal>
  );
}

function DraftBody({ id, close, disabledReason }: { id: string; close: () => void; disabledReason?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {error && <Alert kind="error">{error}</Alert>}
      {draft ? (
        <>
          <textarea className="input" rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Draft message" />
          <div className="flex justify-end gap-2">
            <button className="btn-quiet" onClick={close}>Close</button>
            <button className="btn-outline" onClick={() => navigator.clipboard?.writeText(draft)}>Copy</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-mute">This uses {CREDIT_COSTS.followup_draft} credits and drafts an email grounded in the record this action came from.</p>
          {disabledReason && <Alert kind="warn">{disabledReason}</Alert>}
          <div className="flex justify-end gap-2">
            <button className="btn-quiet" onClick={close}>Cancel</button>
            <button
              className="btn-primary"
              disabled={pending || Boolean(disabledReason)}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await draftFollowUp(id);
                  if (!r.ok) return setError(r.error);
                  setDraft(r.draft);
                  router.refresh();
                })
              }
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Draft message
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function NewActionButton() {
  return (
    <Modal trigger="Add action" title="Add an action" triggerClassName="btn-outline">
      {(close) => <NewActionBody close={close} />}
    </Modal>
  );
}

function NewActionBody({ close }: { close: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<ManualActionValues>({
    resolver: zodResolver(manualActionSchema),
    defaultValues: { title: "", description: "", priority: "medium", due_date: "" },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const r = await createManualAction(v);
        if (!r.ok) return setError(r.error);
        close();
        router.refresh();
      })}
    >
      {error && <Alert kind="error">{error}</Alert>}
      <TextField label="Title" reg={register("title")} error={formState.errors.title} />
      <TextArea label="Details" reg={register("description")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Priority" reg={register("priority")} options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
        <TextField label="Due date" type="date" reg={register("due_date")} error={formState.errors.due_date} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-quiet" onClick={close}>Cancel</button>
        <SubmitButton pending={formState.isSubmitting}>Add action</SubmitButton>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------------- Reports */

export function GenerateReportForm({ types }: { types: { type: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState(types[0].type);
  const [days, setDays] = useState("90");
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input !w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Report type">
          {types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
        <select className="input !w-auto" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Period">
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 180 days</option>
          <option value="365">Last 12 months</option>
        </select>
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await generateReport(type, Number(days));
              if (!r.ok) return setError(r.error);
              router.push(`/reports/${r.id}`);
            })
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Generate report
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReportExport({ title, data }: { title: string; data: ReportData }) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const toCsv = () => {
    const lines: string[] = [`${csvEscape(title)}`, `${csvEscape(`Generated ${data.generatedAt}`)}`, ""];
    for (const s of data.sections) {
      lines.push(csvEscape(s.title));
      if (s.kpis) for (const k of s.kpis) lines.push(`${csvEscape(k.label)},${csvEscape(k.value)}`);
      if (s.columns && s.rows) {
        lines.push(s.columns.map(csvEscape).join(","));
        for (const r of s.rows) lines.push(r.map(csvEscape).join(","));
      }
      lines.push("");
    }
    download(`${slug}.csv`, "text/csv;charset=utf-8", lines.join("\n"));
  };
  return (
    <div className="no-print flex flex-wrap gap-2">
      <button className="btn-outline btn-sm" onClick={toCsv}><Download className="h-3.5 w-3.5" aria-hidden /> CSV</button>
      <button className="btn-outline btn-sm" onClick={() => download(`${slug}.json`, "application/json", JSON.stringify({ title, ...data }, null, 2))}><Download className="h-3.5 w-3.5" aria-hidden /> JSON</button>
      <button className="btn-outline btn-sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" aria-hidden /> Print / PDF</button>
    </div>
  );
}

/* ----------------------------------------------------------------- Assistant */

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function AssistantChat({ initial, suggestions, disabledReason, balance }: { initial: Msg[]; suggestions: string[]; disabledReason?: string; balance: number }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(balance);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setError(null);
    setPending(true);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    const r = await askAssistant(q);
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      setMessages((m) => m.slice(0, -1));
      setInput(q);
      return;
    }
    setMessages((m) => [...m, { role: "assistant", content: r.answer }]);
    setLeft(r.balance);
    router.refresh();
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className="flex h-[calc(100vh-15rem)] min-h-[420px] flex-col border border-line bg-paper-light">
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl py-8 text-center">
            <p className="font-serif text-lg font-semibold">Ask about your pipeline</p>
            <p className="mt-1 text-sm text-mute">Answers are grounded in your workspace&apos;s data only. If the data does not contain the answer, the assistant says so.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} className="btn-outline btn-sm" disabled={Boolean(disabledReason) || pending} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-ink text-paper-light" : "border border-line bg-paper"}`}>
              {m.role === "assistant" && <span className="ai-tag mb-1.5 mr-2">AI-generated</span>}
              {m.content}
            </div>
          </div>
        ))}
        {pending && <p className="flex items-center gap-2 text-sm text-mute"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading your workspace data…</p>}
        <div ref={endRef} />
      </div>
      <div className="border-t border-line p-3">
        {error && <div className="mb-2"><Alert kind="error">{error}</Alert></div>}
        {disabledReason && <div className="mb-2"><Alert kind="warn">{disabledReason}</Alert></div>}
        <form onSubmit={submit} className="flex gap-2">
          <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Which opportunities need attention?" maxLength={1000} aria-label="Your question" disabled={Boolean(disabledReason)} />
          <button className="btn-primary" disabled={pending || !input.trim() || Boolean(disabledReason)}>
            <Send className="h-4 w-4" aria-hidden /> Ask
          </button>
        </form>
        <p className="mt-1.5 text-xs text-mute">Each question uses {CREDIT_COSTS.assistant_question} credits · {left.toLocaleString("en-US")} remaining</p>
      </div>
    </div>
  );
}
