import type { Metadata } from "next";
import Link from "next/link";
import { requireApp } from "@/lib/context";
import { isAdmin } from "@/lib/permissions";
import { PLANS } from "@/lib/plans";
import { dateShort, num } from "@/lib/format";
import { ProfileForm, WorkspaceForm } from "@/components/team-ui";
import { PageHeader, Panel } from "@/components/ui";
import { UpgradeButtons } from "@/components/upgrade";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const app = await requireApp();
  const plan = PLANS[app.credits.plan];
  return (
    <>
      <PageHeader title="Settings" description="Your profile, workspace details and subscription." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Your profile" description={app.email}>
          <ProfileForm defaults={{ full_name: app.profile.full_name ?? "", job_title: app.profile.job_title ?? "", role_in_org: app.profile.role_in_org ?? "" }} />
        </Panel>
        <Panel title="Workspace" description={`Your role: ${app.role}`}>
          <WorkspaceForm
            canEdit={isAdmin(app.role)}
            defaults={{ name: app.org.name, industry: app.org.industry ?? "", country: app.org.country ?? "", company_size: app.org.company_size ?? "" }}
          />
        </Panel>
        <Panel title="Subscription">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-mute">Plan</dt><dd className="font-medium">{plan.name}{plan.priceUsd ? ` · $${plan.priceUsd}/month` : ""}</dd></div>
            <div className="flex justify-between"><dt className="text-mute">Monthly credits</dt><dd className="font-medium tabular-nums">{num(app.credits.monthly_allocation)}</dd></div>
            <div className="flex justify-between"><dt className="text-mute">Credits remaining</dt><dd className="font-medium tabular-nums">{num(app.credits.balance)}</dd></div>
            <div className="flex justify-between"><dt className="text-mute">Refreshes</dt><dd className="font-medium">{dateShort(app.credits.period_end)}</dd></div>
          </dl>
          <div className="mt-4"><UpgradeButtons current={app.credits.plan} /></div>
          <p className="mt-3 text-xs text-mute"><Link href="/subscription" className="link">Subscription details</Link> · <Link href="/usage" className="link">Usage</Link></p>
        </Panel>
        <Panel title="Data and privacy">
          <div className="space-y-2 text-sm text-mute">
            <p>Records, files and conversations in this workspace are isolated from every other organization by Row Level Security in the database.</p>
            <p>Your workspace data is used to run your workspace and is not used to train shared models.</p>
            <p><Link href="/governance" className="link">Read how access and isolation work</Link></p>
          </div>
        </Panel>
      </div>
    </>
  );
}
