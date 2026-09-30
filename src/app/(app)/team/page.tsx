import type { Metadata } from "next";
import { requireApp } from "@/lib/context";
import { loadMembers } from "@/lib/data";
import { isAdmin } from "@/lib/permissions";
import { dateShort } from "@/lib/format";
import { InvitationRow, InviteButton, MemberControls } from "@/components/team-ui";
import { PermissionsTable } from "@/components/permissions-table";
import { PageHeader, Panel, ScrollTable } from "@/components/ui";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const app = await requireApp();
  const members = await loadMembers(app.supabase, app.org.id);
  const admin = isAdmin(app.role);
  const { data: invites } = admin
    ? await app.supabase.from("invitations").select("id,email,role,token,expires_at").eq("org_id", app.org.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
    : { data: [] };

  return (
    <>
      <PageHeader
        title="Team"
        description="People with access to this workspace and what each role can do. Roles are enforced in the database, not just in the interface."
        actions={admin ? <InviteButton canInviteAdmin={app.role === "owner"} /> : undefined}
      />
      <Panel title={`Members (${members.length})`} flush>
        <ScrollTable>
          <table className="tbl min-w-[640px]">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th /></tr></thead>
            <tbody>
              {members.map((m) => {
                const label = m.profile?.full_name || m.profile?.email || "Member";
                const self = m.user_id === app.userId;
                const canChangeRole = app.role === "owner" && m.role !== "owner";
                const canRemove = !self && m.role !== "owner" && (app.role === "owner" || (app.role === "admin" && m.role === "member"));
                return (
                  <tr key={m.user_id}>
                    <td className="font-medium">{label}{self && <span className="ml-2 text-xs text-mute">(you)</span>}<p className="text-xs font-normal text-mute">{m.profile?.job_title}</p></td>
                    <td className="text-mute">{m.profile?.email}</td>
                    <td><span className={m.role === "owner" ? "badge-ink" : m.role === "admin" ? "badge-gold" : "badge-neutral"}>{m.role}</span></td>
                    <td className="text-mute">{dateShort(m.created_at)}</td>
                    <td><MemberControls userId={m.user_id} role={m.role} canChangeRole={canChangeRole} canRemove={canRemove} label={label} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollTable>
      </Panel>

      {admin && (invites ?? []).length > 0 && (
        <div className="mt-6">
          <Panel title="Pending invitations" description="Share the link with the invitee; it only works for the email address invited." flush>
            <ScrollTable>
              <table className="tbl">
                <thead><tr><th>Email</th><th>Role</th><th>Expires</th><th /></tr></thead>
                <tbody>
                  {(invites as { id: string; email: string; role: string; token: string; expires_at: string }[]).map((i) => (
                    <InvitationRow key={i.id} id={i.id} email={i.email} role={i.role} token={i.token} expires={dateShort(i.expires_at)} />
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          </Panel>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-1 font-serif text-xl font-semibold">Who can do what</h2>
        <p className="mb-3 text-sm text-mute">Your role: <strong className="text-ink capitalize">{app.role}</strong>. Every row below maps to a Row Level Security policy or a database function.</p>
        <PermissionsTable showEnforcement />
      </div>
    </>
  );
}
