export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@secureshieldai.click";
export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "SecureShield AI";

export type PaidPlan = "starter" | "pro" | "scale";

/** Payment links are provided by the owner and read on the server only. */
export function getPaymentLinks(): Record<PaidPlan, string | null> {
  const clean = (v: string | undefined) => (v && /^https?:\/\//i.test(v.trim()) ? v.trim() : null);
  return {
    starter: clean(process.env.STARTER_PAYMENT_LINK),
    pro: clean(process.env.PRO_PAYMENT_LINK),
    scale: clean(process.env.SCALE_PAYMENT_LINK),
  };
}
