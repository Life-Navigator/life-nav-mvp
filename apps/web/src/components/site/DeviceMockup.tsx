import { Mark } from '@/components/brand/Logo';

/* A synthetic, premium LifeNavigator dashboard rendered entirely in markup/SVG.
   No images — sharp at any resolution, themeable, and never a broken asset. */
export function DashboardScreen() {
  const nav = ['Overview', 'Finance', 'Career', 'Health', 'Goals', 'Chat'];
  return (
    <div className="flex h-full w-full bg-[#0c0d12] text-white">
      {/* rail */}
      <div className="hidden w-40 shrink-0 flex-col gap-1 border-r border-white/5 p-3 sm:flex">
        <div className="mb-3 flex items-center gap-2">
          <Mark className="h-5 w-5" size={20} />
          <span className="text-xs font-semibold">LifeNavigator</span>
        </div>
        {nav.map((n, i) => (
          <div
            key={n}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
              i === 0 ? 'bg-white/10 text-white' : 'text-white/45'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" />
            {n}
          </div>
        ))}
      </div>
      {/* main */}
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">
              Decision Intelligence
            </div>
            <div className="text-sm font-semibold">Good morning, Alex</div>
          </div>
          <div className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] text-white/60">
            Sample profile · Young Professional
          </div>
        </div>

        {/* net worth chart */}
        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/55">Net worth · 12 mo</span>
            <span className="font-semibold text-[#5eead4]">+ $14,820</span>
          </div>
          <svg viewBox="0 0 320 90" className="mt-2 h-20 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 70 C40 64 60 52 90 50 C130 47 150 30 190 26 C230 22 260 18 320 8 L320 90 L0 90 Z"
              fill="url(#nw)"
            />
            <path
              d="M0 70 C40 64 60 52 90 50 C130 47 150 30 190 26 C230 22 260 18 320 8"
              fill="none"
              stroke="#5eead4"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* metric row */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ['Cash', '$8,000'],
            ['Card APR', '21.99%'],
            ['Goals on track', '3 / 4'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/8 bg-white/[0.03] p-2.5">
              <div className="text-[10px] text-white/40">{k}</div>
              <div className="mt-0.5 text-sm font-semibold">{v}</div>
            </div>
          ))}
        </div>

        {/* insight + grounded chat */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.06] p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#5eead4]">
              First insight
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-white/80">
              Pay down your 21.99% card before investing — it&apos;s your highest-return dollar.
            </div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[10px] text-white/40">You</div>
            <div className="text-[11px] text-white/80">What&apos;s my checking balance?</div>
            <div className="mt-1.5 text-[10px] text-[#5eead4]">LifeNavigator · grounded</div>
            <div className="text-[11px] text-white/80">
              Your Everyday Checking balance is $3,200.00.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhoneScreen() {
  return (
    <div className="flex h-full w-full flex-col bg-[#0c0d12] p-3 text-white">
      <div className="flex items-center gap-1.5">
        <Mark className="h-4 w-4" size={16} />
        <span className="text-[10px] font-semibold">LifeNavigator</span>
      </div>
      <div className="mt-3 rounded-xl border border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.06] p-2.5">
        <div className="text-[9px] uppercase tracking-wider text-[#5eead4]">Today</div>
        <div className="mt-1 text-[11px] leading-snug">Net worth up $1,240 this month</div>
      </div>
      {['Capture the 401(k) match', 'Build a 6-month reserve'].map((t) => (
        <div
          key={t}
          className="mt-2 rounded-xl border border-white/8 bg-white/[0.03] p-2.5 text-[11px] text-white/80"
        >
          {t}
        </div>
      ))}
      <div className="mt-auto rounded-xl bg-white/8 px-3 py-2 text-[10px] text-white/55">
        Ask anything…
      </div>
    </div>
  );
}

export default function DeviceMockup({
  variant = 'laptop',
  className = '',
  children,
}: {
  variant?: 'laptop' | 'phone' | 'tablet';
  className?: string;
  children?: React.ReactNode;
}) {
  if (variant === 'phone') {
    return (
      <div className={`relative ${className}`}>
        <div className="relative aspect-[9/19] w-[200px] rounded-[2rem] border border-white/15 bg-[#07070a] p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)]">
          <div className="absolute left-1/2 top-2 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/15" />
          <div className="h-full w-full overflow-hidden rounded-[1.5rem]">
            {children ?? <PhoneScreen />}
          </div>
        </div>
      </div>
    );
  }
  // laptop / tablet
  return (
    <div className={`relative ${className}`}>
      <div className="overflow-hidden rounded-xl border border-white/12 bg-[#07070a] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
        <div className="flex h-7 items-center gap-1.5 border-b border-white/8 bg-white/[0.03] px-3">
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
        </div>
        <div className="aspect-[16/10] w-full">{children ?? <DashboardScreen />}</div>
      </div>
      {variant === 'laptop' && (
        <div className="mx-auto h-2 w-[112%] -translate-x-[5%] rounded-b-xl border-x border-b border-white/10 bg-[#0c0d12]" />
      )}
    </div>
  );
}
