"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { authSchema } from "@/lib/schemas";
import { TextField, SubmitButton } from "./forms";
import { Alert } from "./ui";

const safeNext = (n: string | null | undefined, fallback = "/overview") => (n && n.startsWith("/") && !n.startsWith("//") ? n : fallback);

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed")) return "Confirm your email address first — check your inbox for the confirmation link.";
  if (m.includes("already registered")) return "An account with this email already exists. Sign in instead.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a few minutes and try again.";
  return message;
}

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof authSchema.signIn>>({ resolver: zodResolver(authSchema.signIn) });
  const { register, handleSubmit, formState } = form;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const { error } = await createClient().auth.signInWithPassword(v);
        if (error) return setError(friendly(error.message));
        router.replace(safeNext(next));
        router.refresh();
      })}
    >
      {error && <Alert kind="error">{error}</Alert>}
      <TextField label="Work email" type="email" autoComplete="email" reg={register("email")} error={formState.errors.email} />
      <TextField label="Password" type="password" autoComplete="current-password" reg={register("password")} error={formState.errors.password} />
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="link">
          Forgot password?
        </Link>
      </div>
      <SubmitButton pending={formState.isSubmitting} className="btn-primary w-full">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm text-mute">
        New to SecureShield AI?{" "}
        <Link href="/signup" className="link">
          Create a workspace
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm({ plan, next }: { plan?: string; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const form = useForm<z.infer<typeof authSchema.signUp>>({ resolver: zodResolver(authSchema.signUp) });
  const { register, handleSubmit, formState } = form;
  const nextPath = next && next.startsWith("/invite/") ? next : plan ? `/onboarding?plan=${encodeURIComponent(plan)}` : "/onboarding";

  if (sent) {
    return (
      <Alert kind="success" title="Check your inbox">
        We sent a confirmation link to <strong>{sent}</strong>. Open it to confirm your email address and continue to workspace setup.
      </Alert>
    );
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const { data, error } = await createClient().auth.signUp({
          email: v.email,
          password: v.password,
          options: {
            data: { full_name: v.full_name },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });
        if (error) return setError(friendly(error.message));
        if (data.session) {
          router.replace(nextPath);
          router.refresh();
        } else if (data.user && data.user.identities?.length === 0) {
          setError("An account with this email already exists. Sign in instead.");
        } else {
          setSent(v.email);
        }
      })}
    >
      {error && <Alert kind="error">{error}</Alert>}
      <TextField label="Full name" autoComplete="name" reg={register("full_name")} error={formState.errors.full_name} />
      <TextField label="Work email" type="email" autoComplete="email" reg={register("email")} error={formState.errors.email} />
      <TextField label="Password" type="password" autoComplete="new-password" hint="At least 10 characters." reg={register("password")} error={formState.errors.password} />
      <TextField label="Confirm password" type="password" autoComplete="new-password" reg={register("confirm")} error={formState.errors.confirm} />
      <SubmitButton pending={formState.isSubmitting} className="btn-primary w-full">
        Get started
      </SubmitButton>
      <p className="text-center text-sm text-mute">
        Already have an account?{" "}
        <Link href="/signin" className="link">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof authSchema.forgot>>({ resolver: zodResolver(authSchema.forgot) });
  const { register, handleSubmit, formState } = form;

  if (sent) {
    return (
      <Alert kind="success" title="Check your inbox">
        If an account exists for that address, a password reset link is on its way.
      </Alert>
    );
  }
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const { error } = await createClient().auth.resetPasswordForEmail(v.email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (error) return setError(friendly(error.message));
        setSent(true);
      })}
    >
      {error && <Alert kind="error">{error}</Alert>}
      <TextField label="Work email" type="email" autoComplete="email" reg={register("email")} error={formState.errors.email} />
      <SubmitButton pending={formState.isSubmitting} className="btn-primary w-full">
        Send reset link
      </SubmitButton>
      <p className="text-center text-sm text-mute">
        <Link href="/signin" className="link">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm<z.infer<typeof authSchema.reset>>({ resolver: zodResolver(authSchema.reset) });
  const { register, handleSubmit, formState } = form;

  if (done) {
    return (
      <Alert kind="success" title="Password updated">
        Your password has been changed. Redirecting to your workspace…
      </Alert>
    );
  }
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) return setError("This reset link has expired or was already used. Request a new one.");
        const { error } = await supabase.auth.updateUser({ password: v.password });
        if (error) return setError(friendly(error.message));
        setDone(true);
        setTimeout(() => {
          router.replace("/overview");
          router.refresh();
        }, 1200);
      })}
    >
      {error && <Alert kind="error">{error}</Alert>}
      <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." reg={register("password")} error={formState.errors.password} />
      <TextField label="Confirm new password" type="password" autoComplete="new-password" reg={register("confirm")} error={formState.errors.confirm} />
      <SubmitButton pending={formState.isSubmitting} className="btn-primary w-full">
        Update password
      </SubmitButton>
    </form>
  );
}

export function SignOutButton({ className = "btn-quiet btn-sm w-full justify-start" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      className={className}
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/signin");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
