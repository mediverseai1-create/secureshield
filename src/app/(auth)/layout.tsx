import { Logo } from "@/components/logo";

const POINTS = [
  ["Isolation", "Every query is scoped to your organization by Row Level Security in the database."],
  ["Access", "Owners, admins and members work in the same system with the right level of control."],
  ["Ownership", "Files, calls and conversations run your workspace and nothing else."],
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-ink px-12 py-12 text-paper-light lg:flex">
        <Logo tone="dark" size="lg" />
        <div className="max-w-md">
          <p className="eyebrow !text-gold">AI for sales teams</p>
          <h2 className="mt-3 font-serif text-3xl leading-tight font-semibold">
            Hear every call. Follow up on every deal.
          </h2>
          <dl className="mt-8 space-y-5">
            {POINTS.map(([t, d]) => (
              <div key={t} className="border-l-2 border-gold pl-4">
                <dt className="font-serif text-lg font-semibold">{t}</dt>
                <dd className="mt-0.5 text-sm text-ink-100/80">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="text-xs text-ink-100/60">Your data is never used to train shared models.</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
