import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Reset your password</h1>
      <p className="mt-1 mb-6 text-sm text-mute">Enter your email and we will send you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </>
  );
}
