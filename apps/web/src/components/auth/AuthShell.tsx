import Link from 'next/link';
import type { ReactNode } from 'react';
import { Mark } from '@/components/brand/Logo';
import ParallaxBackdrop from '@/components/site/ParallaxBackdrop';

/**
 * Premium split-screen shell for auth (login / register). Left: a cinematic
 * brand panel with value props. Right: the form. Matches the marketing site's
 * dark, editorial system. Brand panel collapses on mobile.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  points = [
    'Grounded in your own data — no invented facts',
    'Six life domains reasoned in one connected system',
    'Private by architecture: per-user isolation & encryption',
  ],
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  points?: string[];
}) {
  return (
    <div className="relative min-h-screen text-white antialiased">
      <ParallaxBackdrop />

      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* ── Brand panel ── */}
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 p-12 lg:flex">
          <div aria-hidden className="aurora pointer-events-none absolute inset-0 opacity-70" />
          <div aria-hidden className="tech-grid pointer-events-none absolute inset-0 opacity-50" />

          <Link href="/" className="relative inline-flex items-center gap-2">
            <Mark className="h-8 w-8" size={32} />
            <span className="text-lg font-semibold tracking-tight">LifeNavigator</span>
          </Link>

          <div className="relative">
            <h2 className="font-display text-4xl font-medium leading-tight tracking-tight">
              Decision Intelligence
              <br />
              <span className="italic-display text-gradient">for Life.</span>
            </h2>
            <ul className="mt-8 space-y-4">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-white/70">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#2dd4bf]/15 text-[#5eead4]">
                    <svg
                      viewBox="0 0 20 20"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                    >
                      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-dark edge-glow relative rounded-2xl p-4">
            <div className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wider text-[#5eead4]">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" /> Grounded
            </div>
            <p className="mt-1.5 text-sm text-white/80">
              “Your Everyday Checking balance is <span className="font-semibold">$3,200.00</span>.”
            </p>
            <p className="mt-1 text-xs text-white/45">Cited from your accounts — never guessed.</p>
          </div>
        </aside>

        {/* ── Form panel ── */}
        <main className="flex items-center justify-center px-6 py-16 sm:px-10">
          <div className="w-full max-w-md">
            {/* mobile brand mark */}
            <Link href="/" className="mb-8 inline-flex items-center gap-2 lg:hidden">
              <Mark className="h-8 w-8" size={32} />
              <span className="text-lg font-semibold tracking-tight">LifeNavigator</span>
            </Link>

            <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
              {title}
            </h1>
            {subtitle && <p className="mt-3 text-white/55">{subtitle}</p>}

            <div className="mt-8">{children}</div>

            {footer && <div className="mt-8 text-center text-sm text-white/50">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
