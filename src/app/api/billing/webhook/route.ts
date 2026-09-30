import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Applies a CONFIRMED plan to a workspace.
 *
 * SecureShield AI does not take payments. The owner sells plans through their own payment links; once a
 * payment is confirmed, the payment provider's automation (or an operator) calls this endpoint with the
 * shared secret to set the workspace's plan, which resets the monthly credit allowance.
 * Nothing in the UI changes a plan without this call.
 *
 * POST /api/billing/webhook
 *   Authorization: Bearer <BILLING_WEBHOOK_SECRET>
 *   { "org_id": "<uuid>", "plan": "starter|pro|scale|free", "status": "active|past_due|canceled|free",
 *     "provider": "optional", "reference": "optional payment reference",
 *     "period_start": "optional ISO date", "period_end": "optional ISO date" }
 */
const body = z.object({
  org_id: z.uuid(),
  plan: z.enum(["free", "starter", "pro", "scale"]),
  status: z.enum(["free", "active", "past_due", "canceled"]).default("active"),
  provider: z.string().max(80).optional(),
  reference: z.string().max(200).optional(),
  period_start: z.iso.datetime().optional(),
  period_end: z.iso.datetime().optional(),
});

function authorised(request: NextRequest): boolean {
  const secret = process.env.BILLING_WEBHOOK_SECRET;
  if (!secret || secret.length < 24) return false;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  const v = parsed.data;

  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("apply_plan", {
      _org: v.org_id,
      _plan: v.plan,
      _status: v.status,
      _provider: v.provider ?? null,
      _reference: v.reference ?? null,
      _period_start: v.period_start ?? null,
      _period_end: v.period_end ?? null,
    });
    if (error) return NextResponse.json({ error: "apply_failed" }, { status: 422 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
  }
}
