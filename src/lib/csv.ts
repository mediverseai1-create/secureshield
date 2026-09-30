import { ACCOUNT_STATUSES, LEAD_STATUSES, STAGES, STAGE_DEFAULT_PROBABILITY, type Stage } from "./types";

export type ImportKind = "accounts" | "leads" | "opportunities";
export const MAX_IMPORT_ROWS = 5000;

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
  example: string;
}

export const IMPORT_FIELDS: Record<ImportKind, FieldDef[]> = {
  accounts: [
    { key: "name", label: "Name", required: true, aliases: ["name", "account", "accountname", "company", "companyname"], example: "Northwind Legal" },
    { key: "domain", label: "Domain", aliases: ["domain", "website", "url"], example: "northwind.example" },
    { key: "industry", label: "Industry", aliases: ["industry", "sector"], example: "Legal" },
    { key: "company_size", label: "Company size", aliases: ["companysize", "size", "employees"], example: "51-200" },
    { key: "country", label: "Country", aliases: ["country", "region"], example: "United Kingdom" },
    { key: "status", label: "Status", aliases: ["status", "type"], example: "customer" },
    { key: "owner_email", label: "Owner email", aliases: ["owneremail", "owner", "accountowner"], example: "rep@yourcompany.com" },
    { key: "notes", label: "Notes", aliases: ["notes", "description"], example: "" },
  ],
  leads: [
    { key: "full_name", label: "Full name", required: true, aliases: ["fullname", "name", "leadname", "contact"], example: "Dana Whitfield" },
    { key: "email", label: "Email", aliases: ["email", "emailaddress", "workemail"], example: "dana@example.com" },
    { key: "phone", label: "Phone", aliases: ["phone", "phonenumber", "mobile"], example: "+44 20 7946 0000" },
    { key: "company", label: "Company", aliases: ["company", "companyname", "organization", "account"], example: "Northwind Legal" },
    { key: "job_title", label: "Job title", aliases: ["jobtitle", "title", "position"], example: "Managing Partner" },
    { key: "source", label: "Source", aliases: ["source", "leadsource", "channel"], example: "Referral" },
    { key: "status", label: "Status", aliases: ["status", "leadstatus", "stage"], example: "new" },
    { key: "estimated_value", label: "Estimated value", aliases: ["estimatedvalue", "value", "dealvalue", "amount"], example: "12000" },
    { key: "owner_email", label: "Owner email", aliases: ["owneremail", "owner", "leadowner"], example: "rep@yourcompany.com" },
    { key: "notes", label: "Notes", aliases: ["notes", "description"], example: "" },
  ],
  opportunities: [
    { key: "name", label: "Name", required: true, aliases: ["name", "opportunity", "opportunityname", "deal", "dealname"], example: "Northwind — annual licence" },
    { key: "account", label: "Account", aliases: ["account", "accountname", "company", "customer"], example: "Northwind Legal" },
    { key: "stage", label: "Stage", aliases: ["stage", "dealstage", "status"], example: "proposal" },
    { key: "amount", label: "Amount", aliases: ["amount", "value", "dealvalue", "dealamount"], example: "24000" },
    { key: "probability", label: "Probability %", aliases: ["probability", "winprobability", "prob"], example: "50" },
    { key: "expected_close_date", label: "Expected close (YYYY-MM-DD)", aliases: ["expectedclosedate", "closedate", "expectedclose", "closingdate"], example: "2026-11-30" },
    { key: "next_step", label: "Next step", aliases: ["nextstep", "next"], example: "Send revised proposal" },
    { key: "source", label: "Source", aliases: ["source", "leadsource"], example: "Referral" },
    { key: "owner_email", label: "Owner email", aliases: ["owneremail", "owner", "dealowner"], example: "rep@yourcompany.com" },
    { key: "notes", label: "Notes", aliases: ["notes", "description"], example: "" },
  ],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const slug = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");

export interface HeaderMapping {
  /** source header → field key */
  map: Record<string, string>;
  missingRequired: string[];
  unmapped: string[];
}

export function mapHeaders(kind: ImportKind, headers: string[]): HeaderMapping {
  const defs = IMPORT_FIELDS[kind];
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const h of headers) {
    const n = norm(h);
    const def = defs.find((d) => !used.has(d.key) && d.aliases.includes(n));
    if (def) {
      map[h] = def.key;
      used.add(def.key);
    }
  }
  return {
    map,
    missingRequired: defs.filter((d) => d.required && !used.has(d.key)).map((d) => d.label),
    unmapped: headers.filter((h) => !(h in map)),
  };
}

export interface RowIssue {
  line: number;
  field: string;
  message: string;
}

export type CleanRow = Record<string, string | number | null>;

export interface ValidationContext {
  memberEmails: Set<string>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseMoney(v: string): number | null {
  const cleaned = v.replace(/[$£€,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

function parseStage(v: string): Stage | null {
  const s = slug(v);
  if ((STAGES as readonly string[]).includes(s)) return s as Stage;
  const alias: Record<string, Stage> = { won: "closed_won", closedwon: "closed_won", lost: "closed_lost", closedlost: "closed_lost", negotiating: "negotiation", qualified: "qualification", proposal_sent: "proposal" };
  return alias[s] ?? alias[s.replace(/_/g, "")] ?? null;
}

/** Validate and normalise rows that were already mapped to field keys. Line numbers match the original file (header = line 1). */
export function validateRows(kind: ImportKind, rows: Record<string, string>[], ctx: ValidationContext) {
  const defs = IMPORT_FIELDS[kind];
  const issues: RowIssue[] = [];
  const clean: { line: number; row: CleanRow }[] = [];
  const invalidLines = new Set<number>();

  rows.forEach((raw, i) => {
    const line = i + 2;
    const row: CleanRow = {};
    const fail = (field: string, message: string) => {
      issues.push({ line, field, message });
      invalidLines.add(line);
    };
    const get = (k: string) => (raw[k] ?? "").toString().trim();

    for (const def of defs) {
      const v = get(def.key);
      if (def.required && !v) fail(def.label, "Required value is missing");
      row[def.key] = v || null;
    }

    if (row.email && !EMAIL_RE.test(String(row.email))) fail("Email", `"${row.email}" is not a valid email address`);

    if (row.owner_email) {
      const e = String(row.owner_email).toLowerCase();
      if (!ctx.memberEmails.has(e)) fail("Owner email", `"${row.owner_email}" is not a member of this workspace`);
      else row.owner_email = e;
    }

    if (kind === "accounts") {
      const s = get("status");
      if (s) {
        const v = slug(s);
        if ((ACCOUNT_STATUSES as readonly string[]).includes(v)) row.status = v;
        else fail("Status", `"${s}" must be one of: ${ACCOUNT_STATUSES.join(", ")}`);
      } else row.status = "prospect";
    }

    if (kind === "leads") {
      const s = get("status");
      if (s) {
        const v = slug(s);
        if ((LEAD_STATUSES as readonly string[]).includes(v)) row.status = v;
        else fail("Status", `"${s}" must be one of: ${LEAD_STATUSES.join(", ")}`);
      } else row.status = "new";
      const val = get("estimated_value");
      if (val) {
        const n = parseMoney(val);
        if (n === null) fail("Estimated value", `"${val}" is not a valid amount`);
        else row.estimated_value = n;
      }
    }

    if (kind === "opportunities") {
      const s = get("stage");
      let stage: Stage = "prospecting";
      if (s) {
        const parsed = parseStage(s);
        if (!parsed) fail("Stage", `"${s}" must be one of: ${STAGES.join(", ")}`);
        else stage = parsed;
      }
      row.stage = stage;
      const amt = get("amount");
      if (amt) {
        const n = parseMoney(amt);
        if (n === null) fail("Amount", `"${amt}" is not a valid amount`);
        else row.amount = n;
      } else row.amount = 0;
      const p = get("probability");
      if (p) {
        const n = Number(p.replace("%", ""));
        if (!Number.isInteger(n) || n < 0 || n > 100) fail("Probability %", `"${p}" must be a whole number from 0 to 100`);
        else row.probability = n;
      } else row.probability = STAGE_DEFAULT_PROBABILITY[stage];
      const d = get("expected_close_date");
      if (d) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) fail("Expected close", `"${d}" must be a date in YYYY-MM-DD format`);
      }
    }

    if (!invalidLines.has(line)) clean.push({ line, row });
  });

  return { clean, issues, invalidCount: invalidLines.size };
}

export function templateCsv(kind: ImportKind): string {
  const defs = IMPORT_FIELDS[kind];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `${defs.map((d) => d.key).join(",")}\n${defs.map((d) => esc(d.example)).join(",")}\n`;
}
