import type { Member } from "./types";

export interface Option {
  value: string;
  label: string;
}

export const accountOptions = (accounts: { id: string; name: string }[]): Option[] => accounts.map((a) => ({ value: a.id, label: a.name }));

export const memberOptions = (members: Member[]): Option[] =>
  members.map((m) => ({ value: m.user_id, label: m.profile?.full_name || m.profile?.email || "Member" }));
