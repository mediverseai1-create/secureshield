import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { OnboardingForm } from "@/components/onboarding-form";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const ctx = await getContext();
  if (!ctx) redirect("/signin");
  if (ctx.app && ctx.profile?.onboarding_completed) redirect("/overview");
  const { plan } = await searchParams;
  const validPlan = plan && ["starter", "pro", "scale"].includes(plan) ? plan : undefined;

  return (
    <>
      <p className="eyebrow">Workspace setup</p>
      <h1 className="mt-1 text-3xl font-semibold">{ctx.app ? "Finish your profile" : "Tell us about your organization"}</h1>
      <p className="mt-1 mb-6 text-sm text-mute">
        {ctx.app
          ? `You have joined ${ctx.app.org.name}. A few details complete your profile.`
          : "This creates your private workspace. Everything you add stays inside it."}
      </p>
      <OnboardingForm
        defaults={{ full_name: ctx.profile?.full_name ?? "" }}
        hasWorkspace={Boolean(ctx.app)}
        orgName={ctx.app?.org.name}
        plan={validPlan}
      />
    </>
  );
}
