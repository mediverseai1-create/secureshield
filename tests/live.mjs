// Live end-to-end check against the configured Supabase project (uses .env.local).
// Creates two throw-away organizations, verifies isolation/credits/roles through the real API, then deletes them.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const url = env.NEXT_PUBLIC_SUPABASE_URL, anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fail++; };
const stamp = Date.now();
const pw = "Test-" + stamp + "-xY9!";
const mkUser = async (tag) => {
  const email = `ss-live-${tag}-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `Live ${tag}` } });
  if (error) throw error;
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error: e2 } = await c.auth.signInWithPassword({ email, password: pw });
  if (e2) throw e2;
  return { id: data.user.id, email, c };
};
const users = [];
try {
  const a = await mkUser("a"); users.push(a);
  const b = await mkUser("b"); users.push(b);
  const m = await mkUser("m"); users.push(m);

  const { data: prof } = await a.c.from("profiles").select("id,email").eq("id", a.id).single();
  ok(prof?.email === a.email, "profile auto-created on sign-up");
  const orgA = (await a.c.rpc("create_organization", { _name: "Live Org A", _industry: "Legal", _country: "US", _company_size: "1-10" })).data;
  const orgB = (await b.c.rpc("create_organization", { _name: "Live Org B", _industry: "Finance", _country: "GB", _company_size: "1-10" })).data;
  ok(!!orgA && !!orgB, "workspaces created via RPC");

  const acc = await a.c.from("accounts").insert({ org_id: orgA, name: "Acme" }).select("id").single();
  ok(!acc.error, "owner A inserts account");
  await a.c.from("opportunities").insert({ org_id: orgA, name: "Deal A", account_id: acc.data.id, amount: 5000, stage: "proposal" });
  await b.c.from("opportunities").insert({ org_id: orgB, name: "Deal B", amount: 1, stage: "proposal" });

  ok(((await b.c.from("accounts").select("id")).data ?? []).length === 0, "B cannot see A accounts");
  ok(((await b.c.from("opportunities").select("name")).data ?? []).every((o) => o.name === "Deal B"), "B sees only its own opportunities");
  ok((await b.c.from("accounts").insert({ org_id: orgA, name: "Intruder" })).error !== null, "B cannot insert into A");
  ok(((await b.c.from("accounts").update({ name: "x" }).eq("org_id", orgA).select()).data ?? []).length === 0, "B cannot update A");
  ok((await b.c.rpc("consume_credits", { _org: orgA, _action: "t", _credits: 1 })).error !== null, "B cannot spend A credits");
  ok(((await createClient(url, anon).from("accounts").select("id")).data ?? []).length === 0, "anonymous sees nothing");
  ok(((await a.c.from("opportunity_stage_history").select("to_stage")).data ?? []).length >= 1, "stage history written");

  const cr = await a.c.rpc("credit_status", { _org: orgA });
  ok(cr.data?.balance === 200 && cr.data?.plan === "free", "free plan has 200 credits");
  const spent = await a.c.rpc("consume_credits", { _org: orgA, _action: "assistant_question", _credits: 10 });
  ok(spent.data?.balance === 190, "credits deducted");
  const refund = await a.c.rpc("refund_credits", { _usage: spent.data.usage_id });
  ok(refund.data === 200, "credits refunded");
  ok((await a.c.from("credit_balances").update({ balance: 99999 }).eq("org_id", orgA).select()).data?.length === 0, "users cannot edit balances");
  ok((await a.c.rpc("apply_plan", { _org: orgA, _plan: "scale", _status: "active" })).error !== null, "users cannot call apply_plan");

  const tok = (await a.c.rpc("create_invitation", { _org: orgA, _email: m.email, _role: "member" })).data;
  ok(!!tok, "owner invites member");
  ok((await b.c.rpc("accept_invitation", { _token: tok })).error !== null, "wrong user cannot accept invite");
  ok(!(await m.c.rpc("accept_invitation", { _token: tok })).error, "invited user accepts");
  ok((await m.c.from("accounts").delete().eq("id", acc.data.id).select()).data?.length === 0, "member cannot delete records");
  ok((await m.c.rpc("create_invitation", { _org: orgA, _email: "z@z.com", _role: "member" })).error !== null, "member cannot invite");
  ok(((await m.c.from("accounts").insert({ org_id: orgA, name: "By member" }).select()).data ?? []).length === 1, "member can create records");

  const svcPlan = await admin.rpc("apply_plan", { _org: orgA, _plan: "pro", _status: "active", _provider: "test", _reference: "live-test" });
  ok(!svcPlan.error, "service role applies a confirmed plan");
  ok((await a.c.rpc("credit_status", { _org: orgA })).data?.monthly_allocation === 7000, "Pro = 7,000 credits");

  const path = `${orgA}/live/test.txt`;
  ok(!(await a.c.storage.from("conversation-files").upload(path, "hello")).error, "A uploads file to own folder");
  ok((await b.c.storage.from("conversation-files").download(path)).error !== null, "B cannot download A file");
  ok((await b.c.storage.from("conversation-files").upload(`${orgA}/x/evil.txt`, "x")).error !== null, "B cannot upload into A folder");
  await admin.storage.from("conversation-files").remove([path]);
} catch (e) {
  console.log("ERROR", e.message ?? e); fail++;
} finally {
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
  await admin.from("organizations").delete().like("name", "Live Org %");
}
console.log(fail ? `\n${fail} failed` : "\nAll live checks passed");
process.exit(fail ? 1 : 0);
