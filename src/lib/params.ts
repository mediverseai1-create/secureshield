export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function readParams(sp: SearchParams): Promise<Record<string, string | undefined>> {
  const raw = await sp;
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export function compare<T>(a: T, b: T, dir: "asc" | "desc"): number {
  const av = a ?? ("" as unknown as T);
  const bv = b ?? ("" as unknown as T);
  const r = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
  return dir === "asc" ? r : -r;
}
