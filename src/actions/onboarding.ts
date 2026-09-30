"use server";

import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema, type OnboardingValues } from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";

export async function completeOnboarding(values: OnboardingValues): Promise<ActionResult<{ next: string }>> {
  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const v = parsed.data;

  const ctx = await getContext();
  if (!ctx) return { ok: false, error: "Your session has expired. Sign in again." };
  const supabase = await createClient();

  if (!ctx.app) {
    const { error } = await supabase.rpc("create_organization", {
      _name: v.org_name,
      _industry: v.industry,
      _country: v.country,
      _company_size: v.company_size,
    });
    if (error) {
      return {
        ok: false,
        error: error.message.includes("already belongs")
          ? "Your account already belongs to a workspace."
          : "Could not create the workspace. Please try again.",
      };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: v.full_name,
      job_title: v.job_title,
      role_in_org: v.role_in_org,
      industry: v.industry,
      country: v.country,
      company_size: v.company_size,
      revenue_goals: v.revenue_goals,
      onboarding_completed: true,
    })
    .eq("id", ctx.user.id);
  if (error) return { ok: false, error: "Could not save your profile. Please try again." };
  return { ok: true, next: "/overview" };
}

export async function acceptInvitation(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { _token: token });
  if (error) redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`);
  redirect("/onboarding");
}
