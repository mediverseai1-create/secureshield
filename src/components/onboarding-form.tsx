"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { completeOnboarding } from "@/actions/onboarding";
import { COMPANY_SIZES, INDUSTRIES, REVENUE_GOALS, ROLES_IN_ORG, onboardingSchema, type OnboardingValues } from "@/lib/schemas";
import { SelectField, SubmitButton, TextField } from "./forms";
import { Alert } from "./ui";

export function OnboardingForm({ defaults, hasWorkspace, orgName, plan }: { defaults: Partial<OnboardingValues>; hasWorkspace: boolean; orgName?: string; plan?: string }) {
  const router = useRouter();
  const steps = hasWorkspace ? ["You", "Goals"] : ["You", "Organization", "Goals"];
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      full_name: defaults.full_name ?? "",
      job_title: "",
      role_in_org: "",
      org_name: orgName ?? "",
      industry: hasWorkspace ? "Other" : "",
      country: hasWorkspace ? "-" : "",
      company_size: hasWorkspace ? "1-10" : "",
      revenue_goals: [],
    },
  });
  const { register, handleSubmit, trigger, setValue, formState, control } = form;
  const goals = useWatch({ control, name: "revenue_goals" }) ?? [];
  const label = steps[step];

  const fieldsFor: Record<string, (keyof OnboardingValues)[]> = {
    You: ["full_name", "job_title", "role_in_org"],
    Organization: ["org_name", "industry", "country", "company_size"],
    Goals: ["revenue_goals"],
  };

  async function next() {
    if (await trigger(fieldsFor[label])) setStep((s) => s + 1);
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const r = await completeOnboarding(v);
        if (!r.ok) return setError(r.error);
        router.replace(plan ? `/subscription?plan=${plan}` : r.next);
        router.refresh();
      })}
      className="space-y-5"
    >
      <ol className="flex gap-2 text-xs font-semibold tracking-wide uppercase" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s} className={`flex-1 border-t-2 pt-2 ${i <= step ? "border-gold text-ink" : "border-line text-mute-light"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {error && <Alert kind="error">{error}</Alert>}

      {label === "You" && (
        <div className="space-y-4">
          <TextField label="Full name" autoComplete="name" reg={register("full_name")} error={formState.errors.full_name} />
          <TextField label="Job title" placeholder="e.g. VP of Sales" reg={register("job_title")} error={formState.errors.job_title} />
          <SelectField label="Your role in the organization" placeholder="Select a role" reg={register("role_in_org")} error={formState.errors.role_in_org} options={ROLES_IN_ORG.map((r) => ({ value: r, label: r }))} />
        </div>
      )}

      {label === "Organization" && (
        <div className="space-y-4">
          <TextField label="Organization name" reg={register("org_name")} error={formState.errors.org_name} />
          <SelectField label="Industry" placeholder="Select an industry" reg={register("industry")} error={formState.errors.industry} options={INDUSTRIES.map((r) => ({ value: r, label: r }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Country" autoComplete="country-name" reg={register("country")} error={formState.errors.country} />
            <SelectField label="Company size" placeholder="Employees" reg={register("company_size")} error={formState.errors.company_size} options={COMPANY_SIZES.map((r) => ({ value: r, label: `${r} employees` }))} />
          </div>
          <p className="text-xs text-mute">You will be the workspace owner. Only members you invite can see your data.</p>
        </div>
      )}

      {label === "Goals" && (
        <fieldset className="space-y-2">
          <legend className="label">Primary revenue goals</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {REVENUE_GOALS.map((g) => {
              const checked = goals.includes(g);
              return (
                <label key={g} className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm ${checked ? "border-ink bg-ink-100/50" : "border-line bg-white"}`}>
                  <input
                    type="checkbox"
                    className="accent-ink"
                    checked={checked}
                    onChange={() => setValue("revenue_goals", checked ? goals.filter((x) => x !== g) : [...goals, g], { shouldValidate: true })}
                  />
                  {g}
                </label>
              );
            })}
          </div>
          {formState.errors.revenue_goals && <p className="field-error">{formState.errors.revenue_goals.message}</p>}
        </fieldset>
      )}

      <div className="flex justify-between pt-2">
        <button type="button" className="btn-quiet" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </button>
        {step < steps.length - 1 ? (
          <button type="button" className="btn-primary" onClick={next}>
            Continue
          </button>
        ) : (
          <SubmitButton pending={formState.isSubmitting}>Finish setup</SubmitButton>
        )}
      </div>
    </form>
  );
}
