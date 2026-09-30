import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_COSTS, CREDIT_ACTION_LABELS, type CreditAction } from "./plans";
import { GeminiError } from "./gemini";

export type CreditedResult<T> =
  | { ok: true; data: T; balance: number; cost: number }
  | { ok: false; error: string; code: "insufficient_credits" | "failed" };

/**
 * Reserve credits first (atomic, in the database), run the AI operation, and refund if it fails.
 * Every debit and refund is written to the credit_usage ledger by the consume_credits / refund_credits functions.
 */
export async function withCredits<T>(
  supabase: SupabaseClient,
  orgId: string,
  action: CreditAction,
  run: () => Promise<T>,
  meta: { description?: string; metadata?: Record<string, unknown> } = {},
): Promise<CreditedResult<T>> {
  const cost = CREDIT_COSTS[action];
  const { data, error } = await supabase.rpc("consume_credits", {
    _org: orgId,
    _action: action,
    _credits: cost,
    _description: meta.description ?? CREDIT_ACTION_LABELS[action],
    _metadata: meta.metadata ?? {},
  });
  if (error) {
    if (error.message.includes("insufficient_credits")) {
      return { ok: false, code: "insufficient_credits", error: "You do not have enough credits for this action." };
    }
    return { ok: false, code: "failed", error: "Could not reserve credits. Please try again." };
  }
  const reservation = data as { usage_id: string; balance: number };

  try {
    const result = await run();
    return { ok: true, data: result, balance: reservation.balance, cost };
  } catch (e) {
    await supabase.rpc("refund_credits", { _usage: reservation.usage_id });
    const message = e instanceof GeminiError ? e.message : e instanceof Error ? e.message : "The operation failed.";
    return { ok: false, code: "failed", error: `${message} Your credits were refunded.` };
  }
}
