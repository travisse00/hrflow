import { ThemeToggle } from "@/components/ThemeToggle";

function LogoMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-fg">
      H
    </span>
  );
}

const HIGHLIGHTS = [
  "Employees and departments in one place",
  "Clock in, request leave, get approvals",
  "Private chats and department messaging",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel: always green-on-black, in both themes */}
      <aside className="relative hidden overflow-hidden bg-[#050806] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-green-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 text-lg font-bold text-[#04110a]">
            H
          </span>
          <span className="text-xl font-bold tracking-tight">HRFlow</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            People, work and
            <span className="text-green-400"> communication</span>, together.
          </h2>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-neutral-300">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-neutral-500">HR &amp; internal communication platform</p>
      </aside>

      <main className="relative flex items-center justify-center bg-background px-4 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <span className="text-xl font-bold tracking-tight text-foreground">HRFlow</span>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
