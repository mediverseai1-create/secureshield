import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { CreditBalance, Organization, Profile, Role, Subscription } from "./types";

export interface AppContext {
  supabase: SupabaseClient;
  userId: string;
  email: string;
  profile: Profile;
  org: Organization;
  role: Role;
  credits: CreditBalance;
  subscription: Subscription | null;
}

/** Returns the signed-in user with their workspace, role and credit state, or null. */
export const getContext = cache(async (): Promise<{ user: { id: string; email: string }; profile: Profile | null; app: AppContext | null } | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_members")
      .select("role, organizations(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const base = { user: { id: user.id, email: user.email ?? "" }, profile: (profile as Profile | null) ?? null };
  const org = (membership as unknown as { organizations: Organization | null } | null)?.organizations;
  if (!membership || !org) return { ...base, app: null };

  const [{ data: credits }, { data: subscription }] = await Promise.all([
    supabase.rpc("credit_status", { _org: org.id }),
    supabase.from("subscriptions").select("*").eq("org_id", org.id).maybeSingle(),
  ]);

  return {
    ...base,
    app: {
      supabase,
      userId: user.id,
      email: user.email ?? "",
      profile: (profile as Profile) ?? ({ id: user.id } as Profile),
      org,
      role: (membership as unknown as { role: Role }).role,
      credits: credits as CreditBalance,
      subscription: (subscription as Subscription | null) ?? null,
    },
  };
});

/** For pages inside the authenticated application. Redirects to sign-in or onboarding as needed. */
export async function requireApp(): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx) redirect("/signin");
  if (!ctx.app || !ctx.profile?.onboarding_completed) redirect("/onboarding");
  return ctx.app;
}

export function requireRole(app: AppContext, allowed: Role[]) {
  if (!allowed.includes(app.role)) redirect("/overview");
}
