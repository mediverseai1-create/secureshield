// Runs the real migrations against an in-process Postgres (PGlite) with a minimal stub of
// Supabase's `auth` and `storage` schemas, then verifies tenant isolation and role permissions.
// Usage: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(path.join(dir, "..", "migrations", f), "utf8");

const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
`);
await db.exec(read("0001_schema.sql"));
await db.exec(read("0002_rls.sql"));
await db.exec(read("0003_fix_random_source.sql"));
await db.exec(`
  grant all on all tables in schema public to authenticated, service_role;
  grant select, insert, delete on storage.objects to authenticated;
  grant execute on all functions in schema public to service_role;
`);

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

async function as(user, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user.id}',false), set_config('request.jwt.claim.email','${user.email}',false);`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const fails = async (fn) => {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
};

const mk = async (email) => {
  const r = await db.query("insert into auth.users (email) values ($1) returning id", [email]);
  return { id: r.rows[0].id, email };
};
const alice = await mk("alice@a.test"); // owner of org A
const adam = await mk("adam@a.test"); // admin of org A
const mia = await mk("mia@a.test"); // member of org A
const bob = await mk("bob@b.test"); // owner of org B

const orgA = (await as(alice, () => db.query("select public.create_organization('Acme Legal','Legal','US','11-50') id"))).rows[0].id;
const orgB = (await as(bob, () => db.query("select public.create_organization('Beta Finance','Finance','GB','51-200') id"))).rows[0].id;

ok((await db.query("select count(*)::int c from public.profiles")).rows[0].c === 4, "profiles auto-created on sign-up");
ok((await db.query("select balance from public.credit_balances where org_id=$1", [orgA])).rows[0].balance === 200, "free plan grants 200 credits");

// Invitations
const tokenAdmin = (await as(alice, () => db.query("select public.create_invitation($1,'adam@a.test','admin') t", [orgA]))).rows[0].t;
const tokenMember = (await as(alice, () => db.query("select public.create_invitation($1,'mia@a.test','member') t", [orgA]))).rows[0].t;
ok(await as(adam, () => fails(() => db.query("select public.accept_invitation($1)", [tokenMember]))), "invite for another email is rejected");
await as(adam, () => db.query("select public.accept_invitation($1)", [tokenAdmin]));
await as(mia, () => db.query("select public.accept_invitation($1)", [tokenMember]));
ok(await as(adam, () => fails(() => db.query("select public.create_invitation($1,'x@a.test','admin')", [orgA]))), "admin cannot invite admins");
ok(await as(mia, () => fails(() => db.query("select public.create_invitation($1,'x@a.test','member')", [orgA]))), "member cannot invite");

// Seed data in each org
const seed = async (user, org, label) => {
  await as(user, async () => {
    const acc = (await db.query("insert into public.accounts (org_id,name) values ($1,$2) returning id", [org, `${label} Account`])).rows[0].id;
    await db.query("insert into public.opportunities (org_id,name,account_id,amount,stage) values ($1,$2,$3,1000,'proposal')", [org, `${label} Deal`, acc]);
    await db.query("insert into public.leads (org_id,full_name) values ($1,$2)", [org, `${label} Lead`]);
  });
};
await seed(alice, orgA, "A");
await seed(bob, orgB, "B");

// Isolation
const seesA = await as(mia, async () => (await db.query("select name from public.accounts")).rows.map((r) => r.name));
ok(seesA.length === 1 && seesA[0] === "A Account", "org A member sees only org A accounts");
const seesB = await as(bob, async () => (await db.query("select name from public.opportunities")).rows.map((r) => r.name));
ok(seesB.length === 1 && seesB[0] === "B Deal", "org B owner sees only org B opportunities");
ok((await as(bob, () => db.query("select * from public.leads where org_id=$1", [orgA]))).rows.length === 0, "org B cannot read org A leads by id");
ok(await as(bob, () => fails(() => db.query("insert into public.accounts (org_id,name) values ($1,'Intruder')", [orgA]))), "org B cannot insert into org A");
const upd = await as(bob, () => db.query("update public.accounts set name='pwned' where org_id=$1", [orgA]));
ok(upd.affectedRows === 0, "org B cannot update org A rows");
const del = await as(bob, () => db.query("delete from public.opportunities where org_id=$1", [orgA]));
ok(del.affectedRows === 0, "org B cannot delete org A rows");
const accA = (await db.query("select id from public.accounts where org_id=$1", [orgA])).rows[0].id;
ok(await as(bob, () => fails(() => db.query("insert into public.opportunities (org_id,name,account_id) values ($1,'x',$2)", [orgB, accA]))), "cross-org account reference is rejected by foreign key");
ok((await as(bob, () => db.query("select * from public.organization_members where org_id=$1", [orgA]))).rows.length === 0, "org B cannot list org A members");
ok((await as(bob, () => db.query("select * from public.credit_balances where org_id=$1", [orgA]))).rows.length === 0, "org B cannot read org A credits");
ok((await as(bob, () => db.query("select * from public.profiles where id=$1", [alice.id]))).rows.length === 0, "org B cannot read org A profiles");
ok(await as(bob, () => fails(() => db.query("select public.consume_credits($1,'test',5)", [orgA]))), "org B cannot spend org A credits");
ok(await as(alice, () => fails(() => db.query("update public.accounts set org_id=$1 where org_id=$2", [orgB, orgA]))), "org_id cannot be changed");

// Roles
ok(await as(mia, () => fails(() => db.query("delete from public.accounts").then((r) => { if (!r.affectedRows) throw new Error("no rows"); }))), "member cannot delete records");
await as(mia, () => db.query("insert into public.leads (org_id,full_name) values ($1,'Member lead')", [orgA]));
ok(true, "member can create records");
const adminDel = await as(adam, () => db.query("delete from public.leads where full_name='Member lead'"));
ok(adminDel.affectedRows === 1, "admin can delete records");
ok(!(await as(mia, () => fails(() => db.query("insert into public.data_imports (org_id,kind) values ($1,'leads')", [orgA])))), "member can log imports");
ok(await as(mia, () => fails(() => db.query("select public.set_member_role($1,$2,'admin')", [orgA, mia.id]))), "member cannot escalate role");
ok(await as(adam, () => fails(() => db.query("select public.set_member_role($1,$2,'admin')", [orgA, mia.id]))), "admin cannot change roles");
await as(alice, () => db.query("select public.set_member_role($1,$2,'admin')", [orgA, mia.id]));
ok((await db.query("select role from public.organization_members where user_id=$1", [mia.id])).rows[0].role === "admin", "owner can change roles");
ok(await as(adam, () => fails(() => db.query("select public.remove_member($1,$2)", [orgA, mia.id]))), "admin cannot remove another admin");
ok((await as(adam, () => db.query("update public.organizations set name='Renamed' where id=$1", [orgA]))).affectedRows === 1, "admin can edit own workspace details");
ok((await as(adam, () => db.query("update public.organizations set name='Hacked' where id=$1", [orgB]))).affectedRows === 0, "admin cannot edit another workspace");
ok((await as(bob, () => db.query("update public.organizations set name='Hacked' where id=$1", [orgA]))).affectedRows === 0, "outsider cannot edit a workspace");
ok(await as(mia, () => fails(() => db.query("update public.subscriptions set plan='scale' where org_id=$1", [orgA]).then((r) => { if (!r.affectedRows) throw new Error("no rows"); }))), "users cannot write subscriptions");
ok(await as(alice, () => fails(() => db.query("update public.credit_balances set balance=999999 where org_id=$1", [orgA]).then((r) => { if (!r.affectedRows) throw new Error("no rows"); }))), "users cannot write credit balances");
ok(await as(alice, () => fails(() => db.query("select public.apply_plan($1,'scale','active')", [orgA]))), "users cannot call apply_plan");

// Credits
const before = (await db.query("select balance from public.credit_balances where org_id=$1", [orgA])).rows[0].balance;
const spent = await as(alice, () => db.query("select public.consume_credits($1,'assistant_question',10,'test') r", [orgA]));
ok(spent.rows[0].r.balance === before - 10, "credits are deducted atomically");
ok(await as(alice, () => fails(() => db.query("select public.consume_credits($1,'too_much',100000)", [orgA]))), "spending beyond balance is refused");
const refunded = await as(alice, () => db.query("select public.refund_credits($1::uuid) b", [spent.rows[0].r.usage_id]));
ok(refunded.rows[0].b === before, "refund restores the balance");
const refunded2 = await as(alice, () => db.query("select public.refund_credits($1::uuid) b", [spent.rows[0].r.usage_id]));
ok(refunded2.rows[0].b === null, "a debit cannot be refunded twice");
const ledger = (await as(alice, () => db.query("select kind from public.credit_usage where org_id=$1", [orgA]))).rows.map((r) => r.kind);
ok(ledger.includes("grant") && ledger.includes("debit") && ledger.includes("refund"), "usage ledger records grant, debit and refund");
await db.exec("reset role; update public.credit_balances set period_end = now() - interval '1 day', balance = 3 where org_id='" + orgA + "'");
const refreshed = await as(alice, () => db.query("select balance from public.credit_status($1)", [orgA]));
ok(refreshed.rows[0].balance === 200, "monthly allowance refreshes after the period ends");

// Plan application (service role)
await db.exec("set role service_role");
await db.query("select public.apply_plan($1,'pro','active','manual','ref-1')", [orgA]);
await db.exec("reset role");
const pro = (await db.query("select plan, monthly_allocation, balance from public.credit_balances where org_id=$1", [orgA])).rows[0];
ok(pro.plan === "pro" && pro.monthly_allocation === 7000 && pro.balance === 7000, "apply_plan sets Pro = 7,000 credits");

// Stage history
const hist = (await as(alice, () => db.query("select to_stage from public.opportunity_stage_history where org_id=$1", [orgA]))).rows;
ok(hist.length >= 1, "stage history recorded by trigger");
await as(alice, () => db.query("update public.opportunities set stage='closed_won' where org_id=$1", [orgA]));
const won = (await as(alice, () => db.query("select closed_at from public.opportunities where org_id=$1", [orgA]))).rows[0];
ok(won.closed_at !== null, "closed_at is set when a deal closes");

// Storage isolation
await db.exec(`insert into storage.objects (bucket_id, name) values ('conversation-files', '${orgA}/c1/call.mp3'), ('conversation-files', '${orgB}/c2/call.mp3')`);
const objs = await as(alice, () => db.query("select name from storage.objects"));
ok(objs.rows.length === 1 && objs.rows[0].name.startsWith(orgA), "storage objects are scoped to the org folder");
ok(await as(alice, () => fails(() => db.query(`insert into storage.objects (bucket_id, name) values ('conversation-files','${orgB}/x/evil.mp3')`))), "cannot upload into another org's folder");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll database checks passed");
process.exit(failures ? 1 : 0);
