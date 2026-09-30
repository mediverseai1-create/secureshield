import { requireApp } from "@/lib/context";
import { AppShell } from "@/components/app-shell";
import { LowCreditBanner } from "@/components/upgrade";
import { PLANS, creditState } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const app = await requireApp();
  const state = creditState(app.credits.balance, app.credits.monthly_allocation);
  return (
    <AppShell
      orgName={app.org.name}
      userName={app.profile.full_name ?? ""}
      userEmail={app.email}
      role={app.role}
      planName={PLANS[app.credits.plan].name}
      balance={app.credits.balance}
      allocation={app.credits.monthly_allocation}
    >
      {state !== "ok" && <LowCreditBanner balance={app.credits.balance} allocation={app.credits.monthly_allocation} plan={app.credits.plan} />}
      {children}
    </AppShell>
  );
}
