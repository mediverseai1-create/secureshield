import type { Metadata } from "next";
import { SignInForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-semibold">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-mute">Access your organization&apos;s workspace.</p>
      {error === "link" && (
        <div className="mb-4">
          <Alert kind="error">That link is invalid or has expired. Sign in, or request a new link.</Alert>
        </div>
      )}
      <SignInForm next={next} />
    </>
  );
}
