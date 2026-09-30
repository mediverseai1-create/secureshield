import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Info, Minus } from "lucide-react";
import { STAGE_LABELS, type Stage } from "@/lib/types";
import { pct, titleCase } from "@/lib/format";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-mute">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  flush = false,
}: {
  title?: ReactNode;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          <div className="min-w-0">
            <h2 className="panel-title">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-mute">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  body,
  action,
  compact = false,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "px-4 py-8" : "px-6 py-14"}`}>
      <div className="mb-3 h-px w-10 bg-gold" />
      <p className="font-serif text-lg font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-mute">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ kind = "info", children, title }: { kind?: "info" | "warn" | "error" | "success"; children: ReactNode; title?: string }) {
  const styles = {
    info: "border-ink-500/30 bg-ink-100/60 text-ink",
    warn: "border-gold-deep/40 bg-gold-soft text-ink",
    error: "border-risk/40 bg-risk-soft text-risk",
    success: "border-ok/40 bg-ok-soft text-ok",
  }[kind];
  const Icon = { info: Info, warn: AlertTriangle, error: AlertTriangle, success: CheckCircle2 }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex gap-3 border px-4 py-3 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function StageBadge({ stage }: { stage: Stage }) {
  const cls = stage === "closed_won" ? "badge-ok" : stage === "closed_lost" ? "badge-risk" : stage === "negotiation" ? "badge-gold" : "badge-neutral";
  return <span className={cls}>{STAGE_LABELS[stage]}</span>;
}

export function StatusBadge({ value }: { value: string }) {
  const good = ["customer", "qualified", "converted", "analyzed", "done", "positive", "active"];
  const bad = ["at_risk", "unqualified", "failed", "negative", "past_due", "former", "canceled"];
  const cls = good.includes(value) ? "badge-ok" : bad.includes(value) ? "badge-risk" : value === "new" || value === "pending" || value === "mixed" ? "badge-watch" : "badge-neutral";
  return <span className={cls}>{titleCase(value)}</span>;
}

export function PriorityBadge({ value }: { value: "high" | "medium" | "low" }) {
  return <span className={value === "high" ? "badge-risk" : value === "medium" ? "badge-watch" : "badge-neutral"}>{titleCase(value)}</span>;
}

export function ScoreBadge({ score, band }: { score: number; band: "hot" | "warm" | "cold" }) {
  const cls = band === "hot" ? "badge-ok" : band === "warm" ? "badge-watch" : "badge-neutral";
  return (
    <span className={cls} title={`${titleCase(band)} lead`}>
      {score} · {titleCase(band)}
    </span>
  );
}

export function AiLabel({ children = "AI-generated" }: { children?: ReactNode }) {
  return <span className="ai-tag">{children}</span>;
}

export function DataLabel({ children = "Workspace data" }: { children?: ReactNode }) {
  return <span className="inline-flex items-center rounded-sm bg-paper-dark px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-mute uppercase">{children}</span>;
}

export function Stat({
  label,
  value,
  sub,
  change,
  invert = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  change?: number | null;
  invert?: boolean;
}) {
  return (
    <div className="border-l border-line px-4 py-3 first:border-l-0">
      <p className="text-xs font-semibold tracking-wide text-mute uppercase">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-ink tabular-nums">{value}</p>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-mute">
        {change !== undefined && <Trend change={change} invert={invert} />}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

export function Trend({ change, invert = false }: { change: number | null; invert?: boolean }) {
  if (change === null) return <span className="inline-flex items-center gap-0.5 text-mute-light"><Minus className="h-3 w-3" />no baseline</span>;
  const up = change > 0.5;
  const down = change < -0.5;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${good ? "text-ok" : bad ? "text-risk" : "text-mute"}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {pct(Math.abs(change))}
    </span>
  );
}

export function Pager({ page, pageSize, total, basePath, params }: { page: number; pageSize: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("page", String(p));
    return `${basePath}?${q.toString()}`;
  };
  return (
    <div className="no-print flex items-center justify-between border-t border-line px-4 py-3 text-xs text-mute">
      <span>
        Page {page} of {pages} · {total.toLocaleString("en-US")} records
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="btn-outline btn-sm" href={href(page - 1)}>
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link className="btn-outline btn-sm" href={href(page + 1)}>
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function SortLink({ label, field, basePath, params, sort, dir }: { label: string; field: string; basePath: string; params: Record<string, string | undefined>; sort: string; dir: string }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== "sort" && k !== "dir" && k !== "page") q.set(k, v);
  q.set("sort", field);
  q.set("dir", sort === field && dir === "asc" ? "desc" : "asc");
  const active = sort === field;
  return (
    <Link href={`${basePath}?${q.toString()}`} className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}>
      {label}
      {active && <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span>}
    </Link>
  );
}

export function ScrollTable({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}
