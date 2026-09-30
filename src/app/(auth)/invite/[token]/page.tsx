import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/context";
import { acceptInvitation } from "@/actions/onboarding";
import { Alert } from "@/components/ui";
import { ActionButton } from "@/components/forms";

export const metadata: Metadata = { title: "Join a workspace" };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const ctx = await getContext();
  const next = encodeURIComponent(`/invite/${token}`);

  return (
    <>
      <h1 className="text-3xl font-semibold">Join a workspace</h1>
      <p className="mt-2 mb-6 text-sm text-mute">
        You were invited to a SecureShield AI workspace. The invitation is tied to the email address it was sent to.
      </p>
      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      {ctx ? (
        <form action={acceptInvitation} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm">
            Signed in as <strong>{ctx.user.email}</strong>.
          </p>
          <ActionButton className="btn-primary w-full">Accept invitation</ActionButton>
        </form>
      ) : (
        <div className="space-y-3">
          <Link href={`/signup?next=${next}`} className="btn-primary w-full">
            Get started
          </Link>
          <Link href={`/signin?next=${next}`} className="btn-outline w-full">
            Sign in
          </Link>
          <p className="text-xs text-mute">Use the email address the invitation was sent to.</p>
        </div>
      )}
    </>
  );
}
