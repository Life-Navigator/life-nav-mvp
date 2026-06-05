import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import ParallaxBackdrop from '@/components/site/ParallaxBackdrop';

export const metadata = {
  title: 'Beta Program — LifeNavigator',
  description:
    'Request access to the invite-only LifeNavigator beta. Preview the full system with realistic sample profiles.',
};

const STEPS = [
  {
    n: '01',
    t: 'Request access',
    d: 'Tell us a little about you. The beta is invite-only and capped while we tune the experience.',
  },
  {
    n: '02',
    t: 'Get your secure link',
    d: 'You receive a passwordless sign-in link — one click, no password to manage.',
  },
  {
    n: '03',
    t: 'Activate a sample profile',
    d: 'Pick a realistic profile and the full system comes alive on it — safely, with no real data.',
  },
  {
    n: '04',
    t: 'See it think',
    d: 'First insight, top opportunities, and a grounded chat that only speaks to what is actually true.',
  },
];

export default function BetaPage() {
  return (
    <div className="dark relative min-h-screen text-[var(--brand-ink)] antialiased">
      <ParallaxBackdrop />
      <Navbar />
      <section className="px-6 pt-36 pb-20">
        <div className="mx-auto max-w-3xl text-center rise">
          <h1 className="font-display text-5xl font-semibold sm:text-6xl">Request Beta Access</h1>
          <p className="measure mx-auto mt-6 text-lg text-[var(--brand-muted)]">
            LifeNavigator is in invite-only beta. You&apos;ll preview the entire system on realistic
            sample profiles — grounded insights, recommendations, and chat — before connecting any
            real data.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/waitlist"
              className="w-full rounded-xl bg-[var(--brand-ink)] px-7 py-3.5 font-medium text-[var(--brand-paper)] transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Request an invite
            </Link>
            <Link
              href="/auth/magic"
              className="w-full rounded-xl border border-[var(--brand-line)] px-7 py-3.5 font-medium transition-colors hover:bg-white/60 sm:w-auto dark:hover:bg-white/5"
            >
              I have an invite — sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--brand-line)] px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-px overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-line)] sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-[var(--brand-paper)] p-7">
              <div className="text-sm font-medium text-[var(--brand-accent)]">{s.n}</div>
              <h3 className="mt-2 font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--brand-line)] p-8 [box-shadow:var(--brand-elev)]">
          <h2 className="font-display text-2xl font-semibold">Beta vs. the full product</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--brand-accent)]">
                Beta — today
              </div>
              <ul className="mt-2 space-y-1.5 text-sm text-[var(--brand-muted)]">
                <li>Realistic sample profiles</li>
                <li>Full insights, recommendations, chat</li>
                <li>No real data required</li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--brand-muted)]">
                Full product
              </div>
              <ul className="mt-2 space-y-1.5 text-sm text-[var(--brand-muted)]">
                <li>Your real accounts via Plaid</li>
                <li>Your goals, history, and context</li>
                <li>The same intelligence, on your life</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
