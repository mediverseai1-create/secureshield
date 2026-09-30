import { Check, Minus } from "lucide-react";
import { PERMISSIONS } from "@/lib/permissions";

/** Rendered from lib/permissions.ts — the same list the application enforces through RLS policies and RPCs. */
export function PermissionsTable({ showEnforcement = false }: { showEnforcement?: boolean }) {
  const cell = (yes: boolean) =>
    yes ? (
      <span className="inline-flex items-center justify-center text-ok" aria-label="Allowed"><Check className="h-4 w-4" /></span>
    ) : (
      <span className="inline-flex items-center justify-center text-mute-light" aria-label="Not allowed"><Minus className="h-4 w-4" /></span>
    );
  return (
    <div className="overflow-x-auto border border-line bg-paper-light">
      <table className="tbl min-w-[560px]">
        <thead>
          <tr>
            <th>Capability</th>
            <th className="w-20 text-center">Owner</th>
            <th className="w-20 text-center">Admin</th>
            <th className="w-20 text-center">Member</th>
            {showEnforcement && <th>Enforced by</th>}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((p) => (
            <tr key={p.key}>
              <td>{p.label}</td>
              <td className="text-center">{cell(p.owner)}</td>
              <td className="text-center">{cell(p.admin)}</td>
              <td className="text-center">{cell(p.member)}</td>
              {showEnforcement && <td className="text-xs text-mute">{p.enforcement}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
