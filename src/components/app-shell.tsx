"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  CheckSquare,
  CreditCard,
  FileText,
  Gauge,
  KanbanSquare,
  LayoutDashboard,
  Lightbulb,
  Menu,
  MessageSquare,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import { Logo } from "./logo";
import { SignOutButton } from "./auth-forms";

const NAV = [
  {
    label: "Revenue",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/accounts", label: "Accounts", icon: Building2 },
      { href: "/leads", label: "Leads", icon: Target },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/conversations", label: "Conversations", icon: MessageSquare },
      { href: "/briefings", label: "Briefings", icon: FileText },
      { href: "/actions", label: "Actions", icon: CheckSquare },
      { href: "/insights", label: "Insights", icon: Lightbulb },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/assistant", label: "AI Assistant", icon: MessagesSquare },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/team", label: "Team", icon: UsersRound },
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/usage", label: "Usage", icon: Gauge },
      { href: "/subscription", label: "Subscription", icon: CreditCard },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AppShell({
  orgName,
  userName,
  userEmail,
  role,
  planName,
  balance,
  allocation,
  children,
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  role: string;
  planName: string;
  balance: number;
  allocation: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const pctLeft = allocation > 0 ? Math.max(0, Math.min(100, (balance / allocation) * 100)) : 0;
  const low = pctLeft <= 20;

  const sidebar = (
    <div className="flex h-full flex-col bg-ink text-paper-light">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo href="/overview" tone="dark" />
        <button className="text-paper-light lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="border-y border-white/10 px-5 py-3">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-100/60 uppercase">Workspace</p>
        <p className="truncate text-sm font-semibold">{orgName}</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
        {NAV.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.14em] text-ink-100/50 uppercase">{group.label}</p>
            <ul>
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 border-l-2 px-2.5 py-2 text-sm transition-colors ${
                        active ? "border-gold bg-white/10 font-semibold text-white" : "border-transparent text-ink-100/80 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
              {group.label === "Workspace" && (
                <li>
                  <Link href="/governance" className="flex items-center gap-2.5 border-l-2 border-transparent px-2.5 py-2 text-sm text-ink-100/80 hover:bg-white/5 hover:text-white">
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                    Security &amp; Governance
                  </Link>
                </li>
              )}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-ink-100/70">{planName} plan</span>
          <span className="font-semibold tabular-nums">
            {balance.toLocaleString("en-US")} / {allocation.toLocaleString("en-US")}
          </span>
        </div>
        <div className="mt-2 h-1.5 bg-white/15" role="progressbar" aria-label="Credits remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pctLeft)}>
          <div className={`h-full ${low ? "bg-risk" : "bg-gold"}`} style={{ width: `${pctLeft}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-100/60">Credits remaining this period</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="no-print sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-900/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper-light/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button className="btn-quiet btn-sm -ml-2 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden text-sm text-mute sm:inline">{orgName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/usage" className={`hidden items-center gap-2 border px-2.5 py-1 text-xs sm:flex ${low ? "border-risk/50 text-risk" : "border-line text-mute"}`}>
              <Gauge className="h-3.5 w-3.5" aria-hidden />
              <span className="tabular-nums font-semibold">{balance.toLocaleString("en-US")}</span> credits
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm">
                <span className="flex h-8 w-8 items-center justify-center bg-ink text-xs font-semibold text-paper-light">
                  {(userName || userEmail).slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-40 truncate text-sm font-medium">{userName || userEmail}</span>
                  <span className="block text-[11px] text-mute capitalize">{role}</span>
                </span>
              </summary>
              <div className="absolute right-0 mt-2 w-56 border border-line bg-paper-light p-2 shadow-lg">
                <p className="truncate px-2 py-1 text-xs text-mute">{userEmail}</p>
                <Link href="/settings" className="btn-quiet btn-sm w-full justify-start">
                  Account settings
                </Link>
                <SignOutButton />
              </div>
            </details>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

