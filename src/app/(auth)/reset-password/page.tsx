import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Choose a new password</h1>
      <p className="mt-1 mb-6 text-sm text-mute">You opened a password reset link. Set a new password to continue.</p>
      <ResetPasswordForm />
    </>
  );
}
