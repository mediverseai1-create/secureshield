"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import {
  deleteRecord,
  logSalesActivity,
  saveAccount,
  saveContact,
  saveLead,
  saveOpportunity,
  updateOpportunityStage,
} from "@/actions/records";
import {
  accountSchema,
  activitySchema,
  contactSchema,
  leadSchema,
  opportunitySchema,
  type AccountValues,
  type ActivityValues,
  type ContactValues,
  type LeadValues,
  type OpportunityValues,
} from "@/lib/schemas";
import {
  ACCOUNT_STATUSES,
  ACTIVITY_TYPES,
  LEAD_STATUSES,
  STAGES,
  STAGE_DEFAULT_PROBABILITY,
  STAGE_LABELS,
  type Account,
  type Lead,
  type Opportunity,
  type Stage,
} from "@/lib/types";
import { titleCase } from "@/lib/format";
import { Modal } from "./modal";
import { SelectField, SubmitButton, TextArea, TextField } from "./forms";
import { Alert } from "./ui";

export interface Option {
  value: string;
  label: string;
}

const stageOptions = STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }));

function FormFooter({ error, pending, close, label }: { error: string | null; pending: boolean; close: () => void; label: string }) {
  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-quiet" onClick={close}>
          Cancel
        </button>
        <SubmitButton pending={pending}>{label}</SubmitButton>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Opportunities */

function OpportunityFormBody({ opp, accounts, members, close, defaultAccountId }: { opp?: Opportunity; accounts: Option[]; members: Option[]; close: () => void; defaultAccountId?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, control, setValue, formState } = useForm<OpportunityValues>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      name: opp?.name ?? "",
      account_id: opp?.account_id ?? defaultAccountId ?? "",
      stage: opp?.stage ?? "prospecting",
      amount: opp ? String(opp.amount) : "",
      probability: opp ? String(opp.probability) : String(STAGE_DEFAULT_PROBABILITY.prospecting),
      expected_close_date: opp?.expected_close_date ?? "",
      owner_id: opp?.owner_id ?? "",
      next_step: opp?.next_step ?? "",
      lost_reason: opp?.lost_reason ?? "",
      source: opp?.source ?? "",
      notes: opp?.notes ?? "",
    },
  });
  const stage = useWatch({ control, name: "stage" });
  const stageReg = register("stage");
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const r = await saveOpportunity(opp?.id ?? null, v);
        if (!r.ok) return setError(r.error);
        close();
        router.refresh();
      })}
    >
      <TextField label="Opportunity name" reg={register("name")} error={formState.errors.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Account" placeholder="No account" reg={register("account_id")} options={accounts} />
        <SelectField label="Owner" placeholder="Unassigned" reg={register("owner_id")} options={members} />
        <div>
          <label className="label" htmlFor="stage">Stage</label>
          <select
            id="stage"
            className="input"
            {...stageReg}
            onChange={(e) => {
              stageReg.onChange(e);
              setValue("probability", String(STAGE_DEFAULT_PROBABILITY[e.target.value as Stage]));
            }}
          >
            {stageOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <TextField label="Amount (USD)" inputMode="decimal" placeholder="0" reg={register("amount")} error={formState.errors.amount} />
        <TextField label="Win probability %" inputMode="numeric" reg={register("probability")} error={formState.errors.probability} />
        <TextField label="Expected close date" type="date" reg={register("expected_close_date")} error={formState.errors.expected_close_date} />
      </div>
      <TextField label="Next step" placeholder="e.g. Send revised proposal by Friday" reg={register("next_step")} />
      {stage === "closed_lost" && <TextField label="Loss reason" reg={register("lost_reason")} />}
      <TextField label="Source" reg={register("source")} />
      <TextArea label="Notes" reg={register("notes")} />
      <FormFooter error={error} pending={formState.isSubmitting} close={close} label={opp ? "Save changes" : "Create opportunity"} />
    </form>
  );
}

export function OpportunityFormModal({ opp, accounts, members, triggerLabel, triggerClassName, defaultAccountId }: { opp?: Opportunity; accounts: Option[]; members: Option[]; triggerLabel?: string; triggerClassName?: string; defaultAccountId?: string }) {
  return (
    <Modal trigger={triggerLabel ?? (opp ? "Edit" : "New opportunity")} title={opp ? "Edit opportunity" : "New opportunity"} triggerClassName={triggerClassName ?? (opp ? "btn-outline btn-sm" : "btn-primary")}>
      {(close) => <OpportunityFormBody opp={opp} accounts={accounts} members={members} close={close} defaultAccountId={defaultAccountId} />}
    </Modal>
  );
}

export function StageSelect({ id, stage }: { id: string; stage: Stage }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <select
        aria-label="Change stage"
        className="input !w-auto !py-1 text-xs"
        value={stage}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            setError(null);
            const r = await updateOpportunityStage(id, e.target.value);
            if (!r.ok) setError(r.error);
            router.refresh();
          })
        }
      >
        {stageOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Accounts */

function AccountFormBody({ account, members, close }: { account?: Account; members: Option[]; close: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account?.name ?? "",
      domain: account?.domain ?? "",
      industry: account?.industry ?? "",
      company_size: account?.company_size ?? "",
      country: account?.country ?? "",
      status: account?.status ?? "prospect",
      owner_id: account?.owner_id ?? "",
      notes: account?.notes ?? "",
    },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const r = await saveAccount(account?.id ?? null, v);
        if (!r.ok) return setError(r.error);
        close();
        router.refresh();
      })}
    >
      <TextField label="Account name" reg={register("name")} error={formState.errors.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Status" reg={register("status")} options={ACCOUNT_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} />
        <SelectField label="Account owner" placeholder="Unassigned" reg={register("owner_id")} options={members} />
        <TextField label="Domain" placeholder="example.com" reg={register("domain")} />
        <TextField label="Industry" reg={register("industry")} />
        <TextField label="Company size" placeholder="e.g. 51-200" reg={register("company_size")} />
        <TextField label="Country" reg={register("country")} />
      </div>
      <TextArea label="Notes" reg={register("notes")} rows={4} />
      <FormFooter error={error} pending={formState.isSubmitting} close={close} label={account ? "Save changes" : "Create account"} />
    </form>
  );
}

export function AccountFormModal({ account, members }: { account?: Account; members: Option[] }) {
  return (
    <Modal trigger={account ? "Edit" : "New account"} title={account ? "Edit account" : "New account"} triggerClassName={account ? "btn-outline btn-sm" : "btn-primary"}>
      {(close) => <AccountFormBody account={account} members={members} close={close} />}
    </Modal>
  );
}

export function ContactFormModal({ accountId }: { accountId: string }) {
  return (
    <Modal trigger="Add contact" title="Add contact" triggerClassName="btn-outline btn-sm">
      {(close) => <ContactFormBody accountId={accountId} close={close} />}
    </Modal>
  );
}

function ContactFormBody({ accountId, close }: { accountId: string; close: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { account_id: accountId, full_name: "", email: "", phone: "", job_title: "" },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const r = await saveContact(null, v);
        if (!r.ok) return setError(r.error);
        close();
        router.refresh();
      })}
    >
      <TextField label="Full name" reg={register("full_name")} error={formState.errors.full_name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Email" type="email" reg={register("email")} error={formState.errors.email} />
        <TextField label="Phone" reg={register("phone")} />
      </div>
      <TextField label="Job title" reg={register("job_title")} />
      <FormFooter error={error} pending={formState.isSubmitting} close={close} label="Add contact" />
    </form>
  );
}

/* ------------------------------------------------------------------ Leads */

function LeadFormBody({ lead, members, close }: { lead?: Lead; members: Option[]; close: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LeadValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      full_name: lead?.full_name ?? "",
      email: lead?.email ?? "",
      phone: lead?.phone ?? "",
      company: lead?.company ?? "",
      job_title: lead?.job_title ?? "",
      source: lead?.source ?? "",
      status: lead?.status ?? "new",
      estimated_value: lead?.estimated_value ? String(lead.estimated_value) : "",
      owner_id: lead?.owner_id ?? "",
      notes: lead?.notes ?? "",
    },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const r = await saveLead(lead?.id ?? null, v);
        if (!r.ok) return setError(r.error);
        close();
        router.refresh();
      })}
    >
      <TextField label="Full name" reg={register("full_name")} error={formState.errors.full_name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Email" type="email" reg={register("email")} error={formState.errors.email} />
        <TextField label="Phone" reg={register("phone")} />
        <TextField label="Company" reg={register("company")} />
        <TextField label="Job title" reg={register("job_title")} />
        <TextField label="Source" placeholder="e.g. Referral, Webinar" reg={register("source")} />
        <SelectField label="Status" reg={register("status")} options={LEAD_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} />
        <TextField label="Estimated value (USD)" inputMode="decimal" reg={register("estimated_value")} error={formState.errors.estimated_value} />
        <SelectField label="Owner" placeholder="Unassigned" reg={register("owner_id")} options={members} />
      </div>
      <TextArea label="Notes" reg={register("notes")} />
      <FormFooter error={error} pending={formState.isSubmitting} close={close} label={lead ? "Save changes" : "Create lead"} />
    </form>
  );
}

export function LeadFormModal({ lead, members }: { lead?: Lead; members: Option[] }) {
  return (
    <Modal trigger={lead ? "Edit" : "New lead"} title={lead ? "Edit lead" : "New lead"} triggerClassName={lead ? "btn-outline btn-sm" : "btn-primary"}>
      {(close) => <LeadFormBody lead={lead} members={members} close={close} />}
    </Modal>
  );
}

/* ------------------------------------------------------------------ Activities */

function ActivityFormBody({ close, accountId, leadId, opportunityId }: { close: () => void; accountId?: string; leadId?: string; opportunityId?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, formState } = useForm<ActivityValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: { type: "call", subject: "", notes: "", occurred_at: today, account_id: accountId ?? "", lead_id: leadId ?? "", opportunity_id: opportunityId ?? "" },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const r = await logSalesActivity(v);
        if (!r.ok) return setError(r.error);
        close();
        router.refresh();
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Type" reg={register("type")} options={ACTIVITY_TYPES.map((t) => ({ value: t, label: titleCase(t) }))} />
        <TextField label="Date" type="date" reg={register("occurred_at")} error={formState.errors.occurred_at} />
      </div>
      <TextField label="Subject" placeholder="e.g. Discovery call with procurement" reg={register("subject")} error={formState.errors.subject} />
      <TextArea label="Notes" reg={register("notes")} />
      <FormFooter error={error} pending={formState.isSubmitting} close={close} label="Log activity" />
    </form>
  );
}

export function ActivityFormModal(props: { accountId?: string; leadId?: string; opportunityId?: string; label?: string }) {
  return (
    <Modal trigger={props.label ?? "Log activity"} title="Log sales activity" triggerClassName="btn-outline btn-sm">
      {(close) => <ActivityFormBody close={close} accountId={props.accountId} leadId={props.leadId} opportunityId={props.opportunityId} />}
    </Modal>
  );
}

/* ------------------------------------------------------------------ Delete */

export function DeleteButton({ table, id, label, redirectTo }: { table: "opportunities" | "accounts" | "leads" | "contacts" | "activities"; id: string; label: string; redirectTo?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn-quiet btn-sm text-risk"
        disabled={pending}
        aria-label={`Delete ${label}`}
        onClick={() => {
          if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
          start(async () => {
            const r = await deleteRecord(table, id);
            if (!r.ok) return setError(r.error);
            if (redirectTo) router.replace(redirectTo);
            router.refresh();
          });
        }}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only sm:not-sr-only">Delete</span>
      </button>
      {error && <span className="field-error">{error}</span>}
    </>
  );
}

