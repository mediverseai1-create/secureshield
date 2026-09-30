import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./format";
import type { Snapshot } from "./analytics";
import type { Account, Activity, Conversation, ConversationAnalysis, Lead, Member, Opportunity, StageHistory } from "./types";

const PAGE = 1000;
const MAX_PAGES = 10;

/** PostgREST caps each response at ~1000 rows; page through up to 10,000 rows per table. */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await build(i * PAGE, i * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** Loads the workspace records the intelligence layer needs. RLS scopes every query to the user's organization. */
export async function loadSnapshot(supabase: SupabaseClient, orgId: string): Promise<Snapshot> {
  const now = new Date();
  const since = addDays(now, -400).toISOString();
  const [accounts, opportunities, leads, activities, conversations, analyses, history] = await Promise.all([
    fetchAll<Account>((f, t) => supabase.from("accounts").select("*").eq("org_id", orgId).order("created_at").range(f, t)),
    fetchAll<Opportunity>((f, t) => supabase.from("opportunities").select("*").eq("org_id", orgId).order("created_at").range(f, t)),
    fetchAll<Lead>((f, t) => supabase.from("leads").select("*").eq("org_id", orgId).order("created_at").range(f, t)),
    fetchAll<Activity>((f, t) => supabase.from("activities").select("*").eq("org_id", orgId).gte("occurred_at", since).order("occurred_at").range(f, t)),
    fetchAll<Conversation>((f, t) => supabase.from("conversations").select("id,org_id,title,source_type,storage_path,file_name,mime_type,file_size,account_id,opportunity_id,participants,occurred_at,status,error,created_at").eq("org_id", orgId).order("occurred_at").range(f, t)),
    fetchAll<ConversationAnalysis>((f, t) => supabase.from("conversation_analyses").select("*").eq("org_id", orgId).order("created_at").range(f, t)),
    fetchAll<StageHistory>((f, t) => supabase.from("opportunity_stage_history").select("*").eq("org_id", orgId).gte("changed_at", since).order("changed_at").range(f, t)),
  ]);
  return { now, accounts, opportunities, leads, activities, conversations, analyses, history };
}

export async function loadMembers(supabase: SupabaseClient, orgId: string): Promise<Member[]> {
  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at");
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (!ids.length) return [];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, job_title").in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  return (members ?? []).map((m) => ({
    user_id: m.user_id as string,
    role: m.role as Member["role"],
    created_at: m.created_at as string,
    profile: (byId.get(m.user_id as string) as Member["profile"]) ?? null,
  }));
}

export function memberName(members: Member[], id: string | null | undefined): string {
  if (!id) return "Unassigned";
  const m = members.find((x) => x.user_id === id);
  return m?.profile?.full_name || m?.profile?.email || "Former member";
}

export async function logActivity(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  action: string,
  summary: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  await supabase.from("activity_logs").insert({
    org_id: orgId,
    user_id: userId,
    action,
    summary,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    metadata: metadata ?? {},
  });
}

export async function loadAll<T>(supabase: SupabaseClient, table: string, orgId: string, orderBy = "created_at"): Promise<T[]> {
  return fetchAll<T>((f, t) => supabase.from(table).select("*").eq("org_id", orgId).order(orderBy).range(f, t));
}

export function paginate<T>(rows: T[], page: number, size: number) {
  const total = rows.length;
  const current = Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / size)));
  return { rows: rows.slice((current - 1) * size, current * size), page: current, total };
}
