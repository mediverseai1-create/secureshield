"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { changeMemberRole, inviteMember, removeMember, revokeInvitation, updateProfile, updateWorkspace } from "@/actions/team";
import { COMPANY_SIZES, INDUSTRIES, ROLES_IN_ORG, inviteSchema, profileSchema, workspaceSchema } from "@/lib/schemas";
import { Modal } from "./modal";
import { SelectField, SubmitButton, TextField } from "./forms";
import { Alert } from "./ui";

type InviteValues = z.infer<typeof inviteSchema>;

function InviteBody({ canInviteAdmin, close }: { canInviteAdmin: boolean; close: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { email: "", role: "member" } });

  if (link) {
    return (
      <div className="space-y-4">
        <Alert kind="success" title="Invitation created">
          Share this link with the invitee. It works only for the email address you entered and expires in 7 days. SecureShield AI does not send email invitations itself.
        </Alert>
        <input readOnly className="input" value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" />
        <div className="flex justify-end gap-2">
          <button className="btn-outline" onClick={() => navigator.clipboard?.writeText(link)}>Copy link</button>
          <button className="btn-primary" onClick={close}>Done</button>
        </div>
      </div>
    );
  }
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        const r = await inviteMember(v);
        if (!r.ok) return setError(r.error);
        setLink(`${window.location.origin}/invite/${r.token}`);
        router.refresh();
      })}
    >
      {error && <Alert kind="error">{error}</Alert>}
      <TextField label="Email address" type="email" reg={register("email")} error={formState.errors.email} />
      <SelectField
        label="Role"
        reg={register("role")}
        options={[{ value: "member", label: "Member" }, ...(canInviteAdmin ? [{ value: "admin", label: "Admin" }] : [])]}
      />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-quiet" onClick={close}>Cancel</button>
        <SubmitButton pending={formState.isSubmitting}>Create invitation</SubmitButton>
      </div>
    </form>
  );
}

export function InviteButton({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  return (
    <Modal trigger="Invite member" title="Invite a member" description="The invitee signs up or signs in with this email address to join your workspace.">
      {(close) => <InviteBody canInviteAdmin={canInviteAdmin} close={close} />}
    </Modal>
  );
}

export function MemberControls({ userId, role, canChangeRole, canRemove, label }: { userId: string; role: "owner" | "admin" | "member"; canChangeRole: boolean; canRemove: boolean; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center justify-end gap-2">
      {canChangeRole && (
        <select
          aria-label={`Role for ${label}`}
          className="input !w-auto !py-1 text-xs"
          value={role}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              setError(null);
              const r = await changeMemberRole(userId, e.target.value as "member" | "admin");
              if (!r.ok) setError(r.error);
              router.refresh();
            })
          }
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      )}
      {canRemove && (
        <button
          className="btn-quiet btn-sm text-risk"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Remove ${label} from the workspace? They will lose access immediately.`)) return;
            start(async () => {
              setError(null);
              const r = await removeMember(userId);
              if (!r.ok) setError(r.error);
              router.refresh();
            });
          }}
        >
          Remove
        </button>
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function InvitationRow({ id, email, role, token, expires }: { id: string; email: string; role: string; token: string; expires: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  return (
    <tr>
      <td>{email}</td>
      <td className="capitalize">{role}</td>
      <td className="text-mute">{expires}</td>
      <td>
        <div className="flex justify-end gap-2">
          <button
            className="btn-outline btn-sm"
            onClick={() => {
              navigator.clipboard?.writeText(`${window.location.origin}/invite/${token}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button className="btn-quiet btn-sm text-risk" disabled={pending} onClick={() => start(async () => { await revokeInvitation(id); router.refresh(); })}>
            Revoke
          </button>
        </div>
      </td>
    </tr>
  );
}

type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileForm({ defaults }: { defaults: ProfileValues }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { register, handleSubmit, formState } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setMsg(null);
        const r = await updateProfile({ full_name: v.full_name, job_title: v.job_title ?? "", role_in_org: v.role_in_org ?? "" });
        setMsg(r.ok ? { ok: true, text: "Profile saved." } : { ok: false, text: r.error });
        router.refresh();
      })}
    >
      <TextField label="Full name" reg={register("full_name")} error={formState.errors.full_name} />
      <TextField label="Job title" reg={register("job_title")} />
      <SelectField label="Role in organization" placeholder="Select a role" reg={register("role_in_org")} options={ROLES_IN_ORG.map((r) => ({ value: r, label: r }))} />
      {msg && <Alert kind={msg.ok ? "success" : "error"}>{msg.text}</Alert>}
      <SubmitButton pending={formState.isSubmitting}>Save profile</SubmitButton>
    </form>
  );
}

type WorkspaceValues = z.infer<typeof workspaceSchema>;

export function WorkspaceForm({ defaults, canEdit }: { defaults: WorkspaceValues; canEdit: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { register, handleSubmit, formState } = useForm<WorkspaceValues>({ resolver: zodResolver(workspaceSchema), defaultValues: defaults });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setMsg(null);
        const r = await updateWorkspace({ name: v.name, industry: v.industry ?? "", country: v.country ?? "", company_size: v.company_size ?? "" });
        setMsg(r.ok ? { ok: true, text: "Workspace details saved." } : { ok: false, text: r.error });
        router.refresh();
      })}
    >
      <fieldset disabled={!canEdit} className="space-y-4">
        <TextField label="Organization name" reg={register("name")} error={formState.errors.name} />
        <SelectField label="Industry" placeholder="Select an industry" reg={register("industry")} options={INDUSTRIES.map((r) => ({ value: r, label: r }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Country" reg={register("country")} />
          <SelectField label="Company size" placeholder="Employees" reg={register("company_size")} options={COMPANY_SIZES.map((r) => ({ value: r, label: `${r} employees` }))} />
        </div>
      </fieldset>
      {!canEdit && <p className="text-xs text-mute">Only owners and admins can edit workspace details.</p>}
      {msg && <Alert kind={msg.ok ? "success" : "error"}>{msg.text}</Alert>}
      {canEdit && <SubmitButton pending={formState.isSubmitting}>Save workspace</SubmitButton>}
    </form>
  );
}
