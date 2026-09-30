"use server";

import { revalidatePath } from "next/cache";
import { requireApp } from "@/lib/context";
import { inviteSchema, profileSchema, workspaceSchema, blank } from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";

function rpcError(message: string): string {
  if (message.includes("only owners")) return "Only the workspace owner can do that.";
  if (message.includes("not authorized")) return "You do not have permission to do that.";
  if (message.includes("owner cannot") || message.includes("owner role")) return "The owner cannot be changed or removed.";
  if (message.includes("member not found")) return "That member is no longer in the workspace.";
  return "The change could not be made. Please try again.";
}

export async function inviteMember(values: { email: string; role: "member" | "admin" }): Promise<ActionResult<{ token: string }>> {
  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the email address." };
  const app = await requireApp();
  const { data, error } = await app.supabase.rpc("create_invitation", { _org: app.org.id, _email: parsed.data.email, _role: parsed.data.role });
  if (error) return { ok: false, error: rpcError(error.message) };
  revalidatePath("/team");
  return { ok: true, token: data as string };
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const app = await requireApp();
  const { data, error } = await app.supabase.from("invitations").delete().eq("id", id).eq("org_id", app.org.id).select("id");
  if (error || !data?.length) return { ok: false, error: "Could not revoke the invitation." };
  revalidatePath("/team");
  return { ok: true };
}

export async function changeMemberRole(userId: string, role: "member" | "admin"): Promise<ActionResult> {
  if (!["member", "admin"].includes(role)) return { ok: false, error: "Invalid role." };
  const app = await requireApp();
  const { error } = await app.supabase.rpc("set_member_role", { _org: app.org.id, _user: userId, _role: role });
  if (error) return { ok: false, error: rpcError(error.message) };
  revalidatePath("/team");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const app = await requireApp();
  const { error } = await app.supabase.rpc("remove_member", { _org: app.org.id, _user: userId });
  if (error) return { ok: false, error: rpcError(error.message) };
  revalidatePath("/team");
  return { ok: true };
}

export async function updateWorkspace(values: { name: string; industry?: string; country?: string; company_size?: string }): Promise<ActionResult> {
  const parsed = workspaceSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const app = await requireApp();
  const v = parsed.data;
  const { data, error } = await app.supabase
    .from("organizations")
    .update({ name: v.name, industry: blank(v.industry), country: blank(v.country), company_size: blank(v.company_size) })
    .eq("id", app.org.id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Only owners and admins can edit workspace details." };
  revalidatePath("/settings");
  revalidatePath("/overview");
  return { ok: true };
}

export async function updateProfile(values: { full_name: string; job_title?: string; role_in_org?: string }): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const app = await requireApp();
  const v = parsed.data;
  const { error } = await app.supabase
    .from("profiles")
    .update({ full_name: v.full_name, job_title: blank(v.job_title), role_in_org: blank(v.role_in_org) })
    .eq("id", app.userId);
  if (error) return { ok: false, error: "Could not update your profile." };
  revalidatePath("/settings");
  return { ok: true };
}
