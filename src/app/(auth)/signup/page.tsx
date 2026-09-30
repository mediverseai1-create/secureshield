import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create your workspace" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ plan?: string; next?: string }> }) {
  const { plan, next } = await searchParams;
  const valid = plan && ["starter", "pro", "scale"].includes(plan) ? plan : undefined;
  return (
    <>
      <h1 className="text-3xl font-semibold">Create your workspace</h1>
      <p className="mt-1 mb-6 text-sm text-mute">
        Start on the Free plan with 200 credits a month. Next you will set up your organization.
      </p>
      <SignUpForm plan={valid} next={next} />
    </>
  );
}
