import { Mark } from '@/components/brand/Logo';

/* ----------------------------------------------------------------------------
 * A synthetic, premium LifeNavigator product UI rendered entirely in markup/SVG.
 * No screenshots — sharp at any resolution, themeable, and never a broken asset.
 * The goal is fidelity: it should read as *real software*, not an empty mock.
 * -------------------------------------------------------------------------- */

function Spark({ d, id, stroke = '#5eead4' }: { d: string; id: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 120 40" preserveAspectRatio="none" className="h-9 w-full">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L120 40 L0 40 Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DashboardScreen() {
  const nav = [
    ['Overview', true],
    ['Finance', false],
    ['Career', false],
    ['Education', false],
    ['Health', false],
    ['Goals', false],
    ['Scenario Lab', false],
  ] as const;

  return (
    <div className="flex h-full w-full bg-[#0a0b10] text-white">
      {/* ---- left rail ---- */}
      <div className="hidden w-[34%] max-w-[170px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0d13] p-3 sm:flex">
        <div className="mb-4 flex items-center gap-2">
          <Mark className="h-[18px] w-[18px]" size={18} />
          <span className="text-[11px] font-semibold tracking-tight">LifeNavigator</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {nav.map(([n, active]) => (
            <div
              key={n}
              className={`flex items-center gap-2 rounded-md px-2 py-[5px] text-[10px] ${
                active
                  ? 'bg-gradient-to-r from-[#2dd4bf]/15 to-transparent font-medium text-white'
                  : 'text-white/40'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#2dd4bf]' : 'bg-white/20'}`}
              />
              {n}
            </div>
          ))}
        </div>
        <div className="mt-auto rounded-lg border border-white/[0.07] bg-white/[0.02] p-2">
          <div className="text-[8px] uppercase tracking-wider text-white/35">Beta profile</div>
          <div className="mt-0.5 text-[10px] font-medium">Young Professional</div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/3 rounded-full bg-[#2dd4bf]" />
          </div>
        </div>
      </div>

      {/* ---- main ---- */}
      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[8px] uppercase tracking-[0.15em] text-white/35">
              Decision Intelligence
            </div>
            <div className="text-[13px] font-semibold tracking-tight">Good morning, Alex</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full border border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.08] px-2 py-[3px] text-[8px] font-medium text-[#5eead4]">
              <span className="pulse-dot h-1 w-1 rounded-full bg-[#2dd4bf]" />
              Grounded
            </div>
            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#2dd4bf]/60 to-[#818cf8]/60" />
          </div>
        </div>

        {/* hero metric + sparkline */}
        <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-2">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white/45">Net worth</span>
              <span className="rounded bg-[#2dd4bf]/12 px-1.5 py-0.5 text-[8px] font-semibold text-[#5eead4]">
                +8.4% · 12mo
              </span>
            </div>
            <div className="mt-0.5 text-[19px] font-semibold tracking-tight">$148,920</div>
            <Spark id="nw" d="M0 32 C16 28 24 24 36 23 C52 21 60 14 78 12 C96 10 104 7 120 4" />
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div>
              <div className="text-[9px] text-white/45">Allocation</div>
              <div className="mt-2 flex items-center gap-2">
                <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="#2dd4bf"
                    strokeWidth="4"
                    strokeDasharray="56 94"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="4"
                    strokeDasharray="28 94"
                    strokeDashoffset="-56"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="space-y-0.5 text-[8px]">
                  <div className="flex items-center gap-1 text-white/55">
                    <span className="h-1 w-1 rounded-full bg-[#2dd4bf]" /> Invest 60%
                  </div>
                  <div className="flex items-center gap-1 text-white/55">
                    <span className="h-1 w-1 rounded-full bg-[#818cf8]" /> Cash 30%
                  </div>
                  <div className="flex items-center gap-1 text-white/55">
                    <span className="h-1 w-1 rounded-full bg-white/30" /> Debt 10%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* metric chips */}
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[
            ['Cash', '$8,000'],
            ['Card APR', '21.99%'],
            ['Runway', '6.2 mo'],
            ['Goals', '3 / 4'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5">
              <div className="text-[7.5px] text-white/35">{k}</div>
              <div className="mt-0.5 text-[10px] font-semibold tracking-tight">{v}</div>
            </div>
          ))}
        </div>

        {/* recommendation + grounded chat */}
        <div className="mt-2 grid min-h-0 flex-1 grid-cols-[1fr_1fr] gap-2">
          <div className="rounded-xl border border-[#2dd4bf]/22 bg-gradient-to-br from-[#2dd4bf]/[0.08] to-transparent p-2.5">
            <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wider text-[#5eead4]">
              <span className="h-1 w-1 rounded-full bg-[#2dd4bf]" /> Top recommendation
            </div>
            <div className="mt-1 text-[10px] font-medium leading-snug text-white/90">
              Pay down the 21.99% card before investing
            </div>
            <div className="mt-1 text-[8.5px] leading-relaxed text-white/45">
              Highest-return dollar available — $1,420/yr saved vs. the market&apos;s expected
              return.
            </div>
            <div className="mt-1.5 flex gap-1">
              <span className="rounded bg-white/8 px-1.5 py-0.5 text-[7.5px] text-white/60">
                Finance
              </span>
              <span className="rounded bg-white/8 px-1.5 py-0.5 text-[7.5px] text-white/60">
                Cited
              </span>
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
            <div className="flex justify-end">
              <span className="max-w-[85%] rounded-lg rounded-br-sm bg-white/8 px-2 py-1 text-[8.5px] text-white/80">
                What&apos;s my checking balance?
              </span>
            </div>
            <div className="mt-1.5 flex items-start gap-1.5">
              <Mark className="mt-0.5 h-3 w-3" size={12} />
              <div>
                <div className="flex items-center gap-1 text-[7.5px] text-[#5eead4]">
                  <span className="pulse-dot h-1 w-1 rounded-full bg-[#2dd4bf]" /> grounded · cited
                </div>
                <div className="mt-0.5 max-w-[95%] rounded-lg rounded-bl-sm bg-[#2dd4bf]/[0.07] px-2 py-1 text-[8.5px] leading-snug text-white/85">
                  Your Everyday Checking balance is{' '}
                  <span className="font-semibold text-white">$3,200.00</span>.
                </div>
              </div>
            </div>
            <div className="mt-auto flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1 text-[8px] text-white/35">
              Ask anything about your life…
              <span className="ml-auto h-3 w-3 rounded bg-[#2dd4bf]/30" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhoneScreen() {
  return (
    <div className="flex h-full w-full flex-col bg-[#0a0b10] p-3 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Mark className="h-4 w-4" size={16} />
          <span className="text-[10px] font-semibold tracking-tight">LifeNavigator</span>
        </div>
        <span className="h-5 w-5 rounded-full bg-gradient-to-br from-[#2dd4bf]/60 to-[#818cf8]/60" />
      </div>

      <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
        <div className="text-[9px] text-white/45">Net worth</div>
        <div className="text-[18px] font-semibold tracking-tight">$148,920</div>
        <Spark id="p-nw" d="M0 32 C18 27 28 22 42 21 C58 19 70 13 86 11 C100 9 110 6 120 4" />
      </div>

      <div className="mt-2.5 rounded-2xl border border-[#2dd4bf]/22 bg-gradient-to-br from-[#2dd4bf]/[0.08] to-transparent p-3">
        <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wider text-[#5eead4]">
          <span className="pulse-dot h-1 w-1 rounded-full bg-[#2dd4bf]" /> Today
        </div>
        <div className="mt-1 text-[11px] font-medium leading-snug">
          Capture the full 401(k) match — you&apos;re leaving $1,800/yr on the table.
        </div>
      </div>

      {[
        ['Build a 6-month reserve', '68%'],
        ['Pay off the 21.99% card', '41%'],
      ].map(([t, p]) => (
        <div key={t} className="mt-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/80">{t}</span>
            <span className="font-semibold text-[#5eead4]">{p}</span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2dd4bf] to-[#818cf8]"
              style={{ width: p }}
            />
          </div>
        </div>
      ))}

      <div className="mt-auto flex items-center gap-1.5 rounded-2xl bg-white/[0.05] px-3 py-2 text-[10px] text-white/40">
        Ask anything…
        <span className="ml-auto h-4 w-4 rounded-md bg-[#2dd4bf]/30" />
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
        <div className="relative aspect-[9/19] w-[200px] rounded-[2.2rem] border border-white/15 bg-[#050506] p-[6px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
          {/* side glints */}
          <span className="absolute -left-px top-16 h-10 w-px rounded bg-white/20" />
          <span className="absolute -right-px top-24 h-16 w-px rounded bg-white/20" />
          <div className="absolute left-1/2 top-[10px] z-10 h-1 w-14 -translate-x-1/2 rounded-full bg-white/20" />
          <div className="h-full w-full overflow-hidden rounded-[1.7rem]">
            {children ?? <PhoneScreen />}
          </div>
        </div>
      </div>
    );
  }
  // laptop / tablet
  return (
    <div className={`relative ${className}`}>
      <div className="edge-glow overflow-hidden rounded-xl border border-white/[0.08] bg-[#050506] shadow-[0_50px_140px_-40px_rgba(0,0,0,0.95)]">
        {/* top chrome */}
        <div className="flex h-7 items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.02] px-3">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]/70" />
          <span className="h-2 w-2 rounded-full bg-[#febc2e]/70" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]/70" />
          <div className="mx-auto flex items-center gap-1.5 rounded-md bg-white/[0.04] px-3 py-0.5 text-[8px] text-white/35">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf]/70" />
            app.lifenavigator.ai/dashboard
          </div>
        </div>
        <div className="aspect-[16/10] w-full">{children ?? <DashboardScreen />}</div>
      </div>
      {variant === 'laptop' && (
        <>
          <div className="mx-auto h-2.5 w-[112%] -translate-x-[5%] rounded-b-xl border-x border-b border-white/[0.08] bg-gradient-to-b from-[#15161d] to-[#0a0b10]" />
          {/* reflection */}
          <div
            aria-hidden
            className="mx-auto mt-1 h-16 w-[88%] rounded-b-3xl opacity-30 blur-md [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.5),transparent)]"
            style={{ background: 'linear-gradient(to bottom, rgba(45,212,191,0.25), transparent)' }}
          />
        </>
      )}
    </div>
  );
}
