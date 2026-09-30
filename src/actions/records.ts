"use server";

import { revalidatePath } from "next/cache";
import { requireApp } from "@/lib/context";
import { logActivity, loadMembers } from "@/lib/data";
import {
  accountSchema,
  activitySchema,
  blank,
  contactSchema,
  leadSchema,
  opportunitySchema,
  toNumber,
  type AccountValues,
  type ActivityValues,
  type ContactValues,
  type LeadValues,
  type OpportunityValues,
} from "@/lib/schemas";
import { MAX_IMPORT_ROWS, validateRows, type CleanRow, type ImportKind } from "@/lib/csv";
import { STAGES, STAGE_DEFAULT_PROBABILITY, type ActionResult, type Stage } from "@/lib/types";

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Check the form and try again.";
const dbError = (message: string) => {
  if (message.includes("row-level security")) return "You do not have permission to do that.";
  if (message.includes("owner must be") || message.includes("assignee must be")) return "The selected owner is not a member of this workspace.";
  if (message.includes("violates foreign key")) return "The selected account or record does not exist in this workspace.";
  return "The change could not be saved. Please try again.";
};

function refresh(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/overview");
}

export async function saveOpportunity(id: string | null, values: OpportunityValues): Promise<ActionResult<{ id: string }>> {
  const parsed = opportunitySchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;
  const app = await requireApp();

  let probability = toNumber(v.probability) ?? STAGE_DEFAULT_PROBABILITY[v.stage];
  if (v.stage === "closed_won") probability = 100;
  if (v.stage === "closed_lost") probability = 0;
  const row = {
    name: v.name,
    account_id: blank(v.account_id),
    stage: v.stage,
    amount: toNumber(v.amount) ?? 0,
    probability,
    expected_close_date: blank(v.expected_close_date),
    owner_id: blank(v.owner_id),
    next_step: blank(v.next_step),
    lost_reason: v.stage === "closed_lost" ? blank(v.lost_reason) : null,
    source: blank(v.source),
    notes: blank(v.notes),
  };

  if (id) {
    const { data, error } = await app.supabase.from("opportunities").update(row).eq("id", id).eq("org_id", app.org.id).select("id").maybeSingle();
    if (error) return { ok: false, error: dbError(error.message) };
    if (!data) return { ok: false, error: "That opportunity no longer exists." };
    await logActivity(app.supabase, app.org.id, app.userId, "opportunity.updated", `Updated opportunity “${v.name}”`, "opportunity", id);
    refresh("/pipeline");
    return { ok: true, id };
  }
  const { data, error } = await app.supabase.from("opportunities").insert({ ...row, org_id: app.org.id }).select("id").single();
  if (error) return { ok: false, error: dbError(error.message) };
  await logActivity(app.supabase, app.org.id, app.userId, "opportunity.created", `Created opportunity “${v.name}”`, "opportunity", data.id);
  refresh("/pipeline", "/accounts");
  return { ok: true, id: data.id as string };
}

export async function updateOpportunityStage(id: string, stage: string): Promise<ActionResult> {
  if (!(STAGES as readonly string[]).includes(stage)) return { ok: false, error: "Unknown stage." };
  const s = stage as Stage;
  const app = await requireApp();
  const { data, error } = await app.supabase
    .from("opportunities")
    .update({ stage: s, probability: STAGE_DEFAULT_PROBABILITY[s] })
    .eq("id", id)
    .eq("org_id", app.org.id)
    .select("name")
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error.message) };
  if (!data) return { ok: false, error: "That opportunity no longer exists." };
  await logActivity(app.supabase, app.org.id, app.userId, "opportunity.stage_changed", `Moved “${data.name}” to ${s.replace("_", " ")}`, "opportunity", id, { stage: s });
  refresh("/pipeline", "/accounts");
  return { ok: true };
}

export async function saveAccount(id: string | null, values: AccountValues): Promise<ActionResult<{ id: string }>> {
  const parsed = accountSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;
  const app = await requireApp();
  const row = {
    name: v.name,
    domain: blank(v.domain),
    industry: blank(v.industry),
    company_size: blank(v.company_size),
    country: blank(v.country),
    status: v.status,
    owner_id: blank(v.owner_id),
    notes: blank(v.notes),
  };
  if (id) {
    const { data, error } = await app.supabase.from("accounts").update(row).eq("id", id).eq("org_id", app.org.id).select("id").maybeSingle();
    if (error) return { ok: false, error: dbError(error.message) };
    if (!data) return { ok: false, error: "That account no longer exists." };
    await logActivity(app.supabase, app.org.id, app.userId, "account.updated", `Updated account “${v.name}”`, "account", id);
    refresh("/accounts", `/accounts/${id}`);
    return { ok: true, id };
  }
  const { data, error } = await app.supabase.from("accounts").insert({ ...row, org_id: app.org.id }).select("id").single();
  if (error) return { ok: false, error: dbError(error.message) };
  await logActivity(app.supabase, app.org.id, app.userId, "account.created", `Created account “${v.name}”`, "account", data.id);
  refresh("/accounts");
  return { ok: true, id: data.id as string };
}

export async function saveContact(id: string | null, values: ContactValues): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;
  const app = await requireApp();
  const row = { full_name: v.full_name, email: blank(v.email), phone: blank(v.phone), job_title: blank(v.job_title) };
  const { error } = id
    ? await app.supabase.from("contacts").update(row).eq("id", id).eq("org_id", app.org.id)
    : await app.supabase.from("contacts").insert({ ...row, org_id: app.org.id, account_id: v.account_id });
  if (error) return { ok: false, error: dbError(error.message) };
  refresh(`/accounts/${v.account_id}`);
  return { ok: true };
}

export async function saveLead(id: string | null, values: LeadValues): Promise<ActionResult<{ id: string }>> {
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;
  const app = await requireApp();
  const row = {
    full_name: v.full_name,
    email: blank(v.email),
    phone: blank(v.phone),
    company: blank(v.company),
    job_title: blank(v.job_title),
    source: blank(v.source),
    status: v.status,
    estimated_value: toNumber(v.estimated_value),
    owner_id: blank(v.owner_id),
    notes: blank(v.notes),
  };
  if (id) {
    const { data, error } = await app.supabase.from("leads").update(row).eq("id", id).eq("org_id", app.org.id).select("id").maybeSingle();
    if (error) return { ok: false, error: dbError(error.message) };
    if (!data) return { ok: false, error: "That lead no longer exists." };
    await logActivity(app.supabase, app.org.id, app.userId, "lead.updated", `Updated lead ${v.full_name}`, "lead", id);
    refresh("/leads");
    return { ok: true, id };
  }
  const { data, error } = await app.supabase.from("leads").insert({ ...row, org_id: app.org.id }).select("id").single();
  if (error) return { ok: false, error: dbError(error.message) };
  await logActivity(app.supabase, app.org.id, app.userId, "lead.created", `Created lead ${v.full_name}`, "lead", data.id);
  refresh("/leads");
  return { ok: true, id: data.id as string };
}

export async function logSalesActivity(values: ActivityValues): Promise<ActionResult> {
  const parsed = activitySchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;
  const app = await requireApp();
  const when = v.occurred_at ? new Date(`${v.occurred_at}T12:00:00Z`).toISOString() : new Date().toISOString();
  const { error } = await app.supabase.from("activities").insert({
    org_id: app.org.id,
    type: v.type,
    subject: v.subject,
    notes: blank(v.notes),
    occurred_at: when,
    account_id: blank(v.account_id),
    lead_id: blank(v.lead_id),
    opportunity_id: blank(v.opportunity_id),
  });
  if (error) return { ok: false, error: dbError(error.message) };
  await logActivity(app.supabase, app.org.id, app.userId, "activity.logged", `Logged ${v.type}: ${v.subject}`, "activity");
  refresh("/accounts", "/leads", "/pipeline", "/activity");
  return { ok: true };
}

const DELETABLE = { opportunities: "/pipeline", accounts: "/accounts", leads: "/leads", contacts: "/accounts", activities: "/accounts" } as const;

export async function deleteRecord(table: keyof typeof DELETABLE, id: string): Promise<ActionResult> {
  if (!(table in DELETABLE)) return { ok: false, error: "Unsupported record type." };
  const app = await requireApp();
  const { data, error } = await app.supabase.from(table).delete().eq("id", id).eq("org_id", app.org.id).select("id");
  if (error) return { ok: false, error: dbError(error.message) };
  if (!data?.length) return { ok: false, error: "Only owners and admins can delete records, or the record no longer exists." };
  await logActivity(app.supabase, app.org.id, app.userId, `${table}.deleted`, `Deleted a record from ${table}`, table, id);
  refresh(DELETABLE[table]);
  return { ok: true };
}

/** Authoritative server-side import. The client preview is advisory; everything is re-validated here. */
export async function importRecords(
  kind: ImportKind,
  rows: Record<string, string>[],
  fileName: string,
): Promise<ActionResult<{ imported: number; createdAccounts: number }>> {
  if (!["accounts", "leads", "opportunities"].includes(kind)) return { ok: false, error: "Unknown import type." };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "The file has no data rows." };
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: `Imports are limited to ${MAX_IMPORT_ROWS.toLocaleString("en-US")} rows at a time.` };
  const app = await requireApp();

  const members = await loadMembers(app.supabase, app.org.id);
  const emailToId = new Map(members.filter((m) => m.profile?.email).map((m) => [m.profile!.email!.toLowerCase(), m.user_id]));
  const { clean, issues } = validateRows(kind, rows, { memberEmails: new Set(emailToId.keys()) });
  if (issues.length) return { ok: false, error: `${issues.length} validation problem(s) found. Fix the file and upload it again.` };

  const ownerOf = (r: CleanRow) => (r.owner_email ? emailToId.get(String(r.owner_email)) ?? null : null);
  let createdAccounts = 0;
  const insertBatches = async (table: string, payload: Record<string, unknown>[]) => {
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await app.supabase.from(table).insert(payload.slice(i, i + 500));
      if (error) throw new Error(dbError(error.message));
    }
  };

  try {
    if (kind === "accounts") {
      await insertBatches(
        "accounts",
        clean.map(({ row: r }) => ({
          org_id: app.org.id,
          name: r.name,
          domain: r.domain,
          industry: r.industry,
          company_size: r.company_size,
          country: r.country,
          status: r.status,
          owner_id: ownerOf(r),
          notes: r.notes,
        })),
      );
    } else if (kind === "leads") {
      await insertBatches(
        "leads",
        clean.map(({ row: r }) => ({
          org_id: app.org.id,
          full_name: r.full_name,
          email: r.email,
          phone: r.phone,
          company: r.company,
          job_title: r.job_title,
          source: r.source,
          status: r.status,
          estimated_value: r.estimated_value ?? null,
          owner_id: ownerOf(r),
          notes: r.notes,
        })),
      );
    } else {
      const { data: existing } = await app.supabase.from("accounts").select("id,name").eq("org_id", app.org.id).limit(10000);
      const byName = new Map((existing ?? []).map((a) => [String(a.name).toLowerCase(), a.id as string]));
      const missing = [...new Set(clean.map(({ row }) => (row.account ? String(row.account) : "")).filter((n) => n && !byName.has(n.toLowerCase())))];
      if (missing.length) {
        const { data: created, error } = await app.supabase
          .from("accounts")
          .insert(missing.map((name) => ({ org_id: app.org.id, name, status: "prospect" })))
          .select("id,name");
        if (error) throw new Error(dbError(error.message));
        for (const a of created ?? []) byName.set(String(a.name).toLowerCase(), a.id as string);
        createdAccounts = missing.length;
      }
      await insertBatches(
        "opportunities",
        clean.map(({ row: r }) => ({
          org_id: app.org.id,
          name: r.name,
          account_id: r.account ? byName.get(String(r.account).toLowerCase()) ?? null : null,
          stage: r.stage,
          amount: r.amount ?? 0,
          probability: r.probability,
          expected_close_date: r.expected_close_date,
          next_step: r.next_step,
          source: r.source,
          notes: r.notes,
          owner_id: ownerOf(r),
        })),
      );
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed." };
  }

  await app.supabase.from("data_imports").insert({ org_id: app.org.id, kind, file_name: fileName.slice(0, 200), rows_total: rows.length, rows_imported: clean.length });
  await logActivity(app.supabase, app.org.id, app.userId, "data.imported", `Imported ${clean.length} ${kind} from ${fileName}`, "import", undefined, { kind, rows: clean.length });
  refresh("/pipeline", "/accounts", "/leads");
  return { ok: true, imported: clean.length, createdAccounts };
}
