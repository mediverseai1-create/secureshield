import type { Role } from "./types";

export interface PermissionRow {
  key: string;
  label: string;
  owner: boolean;
  admin: boolean;
  member: boolean;
  /** How it is enforced. Everything listed here is enforced in the database (RLS policy or RPC). */
  enforcement: string;
}

/**
 * Single source of truth for the permissions table shown on the marketing site, the Security page
 * and the Team page. Each row maps to an RLS policy or security-definer function in supabase/migrations.
 */
export const PERMISSIONS: PermissionRow[] = [
  { key: "view", label: "View all records in the workspace", owner: true, admin: true, member: true, enforcement: "RLS select policies" },
  { key: "edit", label: "Create and edit accounts, leads, opportunities and activities", owner: true, admin: true, member: true, enforcement: "RLS insert/update policies" },
  { key: "conversations", label: "Add conversations and call recordings, run AI analysis", owner: true, admin: true, member: true, enforcement: "RLS + storage policies; credit RPC" },
  { key: "ai", label: "Generate briefings, ask the AI Assistant, generate reports", owner: true, admin: true, member: true, enforcement: "RLS + credit RPC" },
  { key: "actions", label: "Work the action queue (complete, dismiss, add)", owner: true, admin: true, member: true, enforcement: "RLS update policy" },
  { key: "delete", label: "Delete records, conversations and recordings", owner: true, admin: true, member: false, enforcement: "RLS delete policies" },
  { key: "invite", label: "Invite members and remove members", owner: true, admin: true, member: false, enforcement: "create_invitation / remove_member RPCs" },
  { key: "workspace", label: "Edit workspace details", owner: true, admin: true, member: false, enforcement: "RLS update policy on organizations" },
  { key: "admins", label: "Invite or remove admins and change member roles", owner: true, admin: false, member: false, enforcement: "set_member_role / create_invitation RPCs" },
];

export function can(role: Role, key: string): boolean {
  const row = PERMISSIONS.find((p) => p.key === key);
  return row ? row[role] : false;
}

export const isAdmin = (role: Role) => role === "owner" || role === "admin";
