"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { importRecords } from "@/actions/records";
import { IMPORT_FIELDS, MAX_IMPORT_ROWS, mapHeaders, templateCsv, validateRows, type ImportKind } from "@/lib/csv";
import { Modal } from "./modal";
import { Alert } from "./ui";

const MAX_BYTES = 5 * 1024 * 1024;

interface Parsed {
  fileName: string;
  rows: Record<string, string>[];
  issues: { line: number; field: string; message: string }[];
  validCount: number;
  invalidCount: number;
  newAccounts: string[];
  fileProblems: string[];
  ignoredColumns: string[];
}

function Wizard({ kind, memberEmails, accountNames, close }: { kind: ImportKind; memberEmails: string[]; accountNames: string[]; close: () => void }) {
  const router = useRouter();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ imported: number; createdAccounts: number } | null>(null);

  function onFile(file: File | undefined) {
    setError(null);
    setParsed(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("The file is larger than 5 MB.");
    if (!/\.csv$/i.test(file.name)) return setError("Upload a .csv file. Export from Excel or Google Sheets as CSV first.");
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const headers = res.meta.fields ?? [];
        const mapping = mapHeaders(kind, headers);
        const fileProblems: string[] = [];
        if (mapping.missingRequired.length) fileProblems.push(`Missing required column: ${mapping.missingRequired.join(", ")}`);
        if (res.data.length === 0) fileProblems.push("The file has no data rows.");
        if (res.data.length > MAX_IMPORT_ROWS) fileProblems.push(`The file has ${res.data.length.toLocaleString("en-US")} rows; the limit is ${MAX_IMPORT_ROWS.toLocaleString("en-US")}.`);
        const parseErrors = res.errors.filter((e) => e.type !== "FieldMismatch").slice(0, 3).map((e) => `Line ${e.row !== undefined ? e.row + 2 : "?"}: ${e.message}`);
        fileProblems.push(...parseErrors);

        const rows = res.data.map((r) => {
          const out: Record<string, string> = {};
          for (const [src, key] of Object.entries(mapping.map)) out[key] = (r[src] ?? "").toString();
          return out;
        });
        const { clean, issues, invalidCount } = validateRows(kind, rows, { memberEmails: new Set(memberEmails) });
        const known = new Set(accountNames.map((n) => n.toLowerCase()));
        const newAccounts =
          kind === "opportunities"
            ? [...new Set(clean.map(({ row }) => (row.account ? String(row.account) : "")).filter((n) => n && !known.has(n.toLowerCase())))]
            : [];
        setParsed({ fileName: file.name, rows, issues, validCount: clean.length, invalidCount, newAccounts, fileProblems, ignoredColumns: mapping.unmapped });
      },
      error: (e) => setError(`Could not read the file: ${e.message}`),
    });
  }

  async function confirm() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    const r = await importRecords(kind, parsed.rows, parsed.fileName);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone({ imported: r.imported, createdAccounts: r.createdAccounts });
    router.refresh();
  }

  const blocked = !parsed || parsed.fileProblems.length > 0 || parsed.issues.length > 0 || parsed.validCount === 0;
  const fields = IMPORT_FIELDS[kind];

  if (done) {
    return (
      <div className="space-y-4">
        <Alert kind="success" title="Import complete">
          {done.imported.toLocaleString("en-US")} {kind} imported into your workspace
          {done.createdAccounts ? `, and ${done.createdAccounts} new account${done.createdAccounts === 1 ? "" : "s"} created from the account column` : ""}.
        </Alert>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={close}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-mute">
        <p>
          Upload a CSV with a header row. Recognised columns:{" "}
          <span className="text-ink">{fields.map((f) => f.label + (f.required ? " *" : "")).join(", ")}</span>.
        </p>
        <a
          className="link mt-1 inline-block"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv(kind))}`}
          download={`secureshield-${kind}-template.csv`}
        >
          Download a template
        </a>
      </div>
      <input type="file" accept=".csv,text/csv" className="input" onChange={(e) => onFile(e.target.files?.[0])} aria-label="CSV file" />
      {error && <Alert kind="error">{error}</Alert>}

      {parsed && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="badge-neutral">{parsed.rows.length.toLocaleString("en-US")} rows read</span>
            <span className="badge-ok">{parsed.validCount.toLocaleString("en-US")} valid</span>
            {parsed.invalidCount > 0 && <span className="badge-risk">{parsed.invalidCount.toLocaleString("en-US")} with errors</span>}
          </div>
          {parsed.fileProblems.map((p) => (
            <Alert key={p} kind="error">
              {p}
            </Alert>
          ))}
          {parsed.ignoredColumns.length > 0 && <p className="text-xs text-mute">Ignored columns (not recognised): {parsed.ignoredColumns.join(", ")}</p>}
          {parsed.newAccounts.length > 0 && (
            <Alert kind="info">
              {parsed.newAccounts.length} account name{parsed.newAccounts.length === 1 ? "" : "s"} in the file do not exist yet and will be created as prospects: {parsed.newAccounts.slice(0, 5).join(", ")}
              {parsed.newAccounts.length > 5 ? "…" : ""}
            </Alert>
          )}
          {parsed.issues.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-risk">Fix these problems and upload the file again — nothing has been imported.</p>
              <div className="max-h-48 overflow-auto border border-line">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Field</th>
                      <th>Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.issues.slice(0, 100).map((i, n) => (
                      <tr key={n}>
                        <td className="tabular-nums">{i.line}</td>
                        <td>{i.field}</td>
                        <td>{i.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.issues.length > 100 && <p className="mt-1 text-xs text-mute">Showing the first 100 of {parsed.issues.length} problems.</p>}
            </div>
          )}
          {parsed.issues.length === 0 && parsed.fileProblems.length === 0 && parsed.validCount > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold">Preview (first 5 rows)</p>
              <div className="overflow-auto border border-line">
                <table className="tbl">
                  <thead>
                    <tr>
                      {fields.filter((f) => parsed.rows.some((r) => r[f.key])).map((f) => (
                        <th key={f.key}>{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        {fields.filter((f) => parsed.rows.some((x) => x[f.key])).map((f) => (
                          <td key={f.key} className="max-w-48 truncate">
                            {r[f.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-quiet" onClick={close}>
          Cancel
        </button>
        <button type="button" className="btn-primary" disabled={blocked || busy} onClick={confirm}>
          {busy ? "Importing…" : `Import ${parsed && !blocked ? parsed.validCount.toLocaleString("en-US") : ""} ${kind}`}
        </button>
      </div>
    </div>
  );
}

export function ImportButton({ kind, memberEmails, accountNames }: { kind: ImportKind; memberEmails: string[]; accountNames: string[] }) {
  return (
    <Modal trigger="Import CSV" title={`Import ${kind}`} description="Upload → validate → preview → confirm. Nothing is saved until you confirm." triggerClassName="btn-outline" wide>
      {(close) => <Wizard kind={kind} memberEmails={memberEmails} accountNames={accountNames} close={close} />}
    </Modal>
  );
}
