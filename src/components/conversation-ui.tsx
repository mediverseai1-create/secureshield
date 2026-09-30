"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { analyzeConversation, createConversation, deleteConversation } from "@/actions/conversations";
import { CREDIT_COSTS } from "@/lib/plans";
import type { Option } from "@/lib/options";
import { Modal } from "./modal";
import { Alert } from "./ui";

function ConversationFormBody({ accounts, opportunities, close, aiReady, balance }: { accounts: Option[]; opportunities: Option[]; close: () => void; aiReady: boolean; balance: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const canAnalyze = aiReady && balance >= CREDIT_COSTS.conversation_analysis;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setWarning(null);
        const fd = new FormData(e.currentTarget);
        const r = await createConversation(fd);
        setBusy(false);
        if (!r.ok) return setError(r.error);
        router.refresh();
        if (r.warning) return setWarning(`Saved, but the analysis did not run: ${r.warning}`);
        close();
        router.push(`/conversations/${r.id}`);
      }}
    >
      {error && <Alert kind="error">{error}</Alert>}
      {warning && <Alert kind="warn">{warning}</Alert>}
      <div>
        <label className="label" htmlFor="c-title">Title</label>
        <input id="c-title" name="title" required maxLength={200} className="input" placeholder="e.g. Discovery call — Northwind Legal" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-account">Account</label>
          <select id="c-account" name="account_id" className="input" defaultValue="">
            <option value="">None</option>
            {accounts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="c-opp">Opportunity</label>
          <select id="c-opp" name="opportunity_id" className="input" defaultValue="">
            <option value="">None</option>
            {opportunities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="c-date">Date of conversation</label>
          <input id="c-date" name="occurred_at" type="date" defaultValue={today} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="c-people">Participants</label>
          <input id="c-people" name="participants" maxLength={300} className="input" placeholder="Names, optional" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-file">Recording or transcript file</label>
        <input id="c-file" name="file" type="file" accept=".txt,.vtt,.srt,.md,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm" className="input" />
        <p className="mt-1 text-xs text-mute">Transcripts: .txt .vtt .srt .md (2 MB). Audio: .mp3 .wav .m4a .aac .ogg .flac .webm (12 MB). Files are stored privately in your workspace.</p>
      </div>
      <div>
        <label className="label" htmlFor="c-transcript">Or paste a transcript</label>
        <textarea id="c-transcript" name="transcript" rows={6} className="input" placeholder="Paste the conversation text here" />
      </div>
      <label className={`flex items-start gap-2 text-sm ${canAnalyze ? "" : "opacity-60"}`}>
        <input type="checkbox" name="analyze" defaultChecked={canAnalyze} disabled={!canAnalyze} className="mt-1 accent-ink" />
        <span>
          Analyse with AI after saving ({CREDIT_COSTS.conversation_analysis} credits)
          {!aiReady && <span className="block text-xs text-mute">AI analysis is not configured for this deployment.</span>}
          {aiReady && !canAnalyze && <span className="block text-xs text-risk">Not enough credits — you can still save the conversation and analyse it later.</span>}
        </span>
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-quiet" onClick={close}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {busy ? "Saving…" : "Save conversation"}
        </button>
      </div>
      {busy && <p className="text-xs text-mute">Uploading and analysing can take up to a minute for recordings.</p>}
    </form>
  );
}

export function NewConversationButton(props: { accounts: Option[]; opportunities: Option[]; aiReady: boolean; balance: number }) {
  return (
    <Modal trigger="Add conversation" title="Add a conversation" description="Upload a recording or transcript. It stays inside your workspace." wide>
      {(close) => <ConversationFormBody {...props} close={close} />}
    </Modal>
  );
}

export function AnalyzeButton({ id, hasAnalysis, disabledReason }: { id: string; hasAnalysis: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className={hasAnalysis ? "btn-outline btn-sm" : "btn-primary"}
        disabled={pending || Boolean(disabledReason)}
        title={disabledReason}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await analyzeConversation(id);
            if (!r.ok) setError(r.error);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
        {hasAnalysis ? "Re-analyse" : "Analyse"} ({CREDIT_COSTS.conversation_analysis} credits)
      </button>
      {error && <p className="field-error max-w-xs text-right">{error}</p>}
      {disabledReason && <p className="max-w-xs text-right text-xs text-mute">{disabledReason}</p>}
    </div>
  );
}

export function DeleteConversationButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="btn-quiet btn-sm text-risk"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete “${title}” and its analysis? This cannot be undone.`)) return;
          start(async () => {
            const r = await deleteConversation(id);
            if (!r.ok) return setError(r.error);
            router.replace("/conversations");
            router.refresh();
          });
        }}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
      </button>
      {error && <span className="field-error">{error}</span>}
    </>
  );
}
