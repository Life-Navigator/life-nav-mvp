import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';

export const metadata = {
  title: 'How It Works — LifeNavigator',
  description: 'How LifeNavigator turns your data into grounded, governed decisions.',
};

const STEPS = [
  {
    n: '01',
    t: 'Connect your world',
    d: 'Accounts via Plaid, plus your goals, career, education, and family context. In the beta, a realistic sample profile stands in for all of it.',
  },
  {
    n: '02',
    t: 'Build your private graph',
    d: 'Your data becomes a personal knowledge graph — isolated to you, encrypted, and never mixed with anyone else.',
  },
  {
    n: '03',
    t: 'Ground every fact',
    d: 'When you ask a question, your real figures are read from your system of record and labeled authoritative. Nothing is invented.',
  },
  {
    n: '04',
    t: 'Reason under governance',
    d: 'Central methodology and a compliance + safety layer shape how the answer is formed — never what is true about you.',
  },
  {
    n: '05',
    t: 'Decide with confidence',
    d: 'You get a connected recommendation across finance, career, education, health, and family — or an honest “I don’t have that yet.”',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[var(--brand-paper)] text-[var(--brand-ink)] antialiased">
      <Navbar />
      <section className="px-6 pt-36 pb-16">
        <div className="mx-auto max-w-3xl rise">
          <h1 className="font-display text-5xl font-semibold sm:text-6xl">How it works</h1>
          <p className="measure mt-6 text-lg text-[var(--brand-muted)]">
            Five steps from your data to a decision you can trust — with grounding and governance at
            every stage.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-3xl">
          <ol className="relative border-l border-[var(--brand-line)]">
            {STEPS.map((s) => (
              <li key={s.n} className="mb-10 ml-6">
                <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-ink)] text-[0.6rem] font-semibold text-[var(--brand-paper)]">
                  {s.n}
                </span>
                <h3 className="text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-[var(--brand-line)] px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-2xl font-semibold">The rule that keeps it honest</h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--brand-muted)]">
            Central knowledge governs <strong className="text-[var(--brand-ink)]">how</strong> we
            answer. Your data determines <strong className="text-[var(--brand-ink)]">what</strong>{' '}
            is true. If a personal fact isn&apos;t in your data, LifeNavigator says so — it never
            guesses.
          </p>
          <div className="mt-8">
            <Link
              href="/beta"
              className="inline-block rounded-xl bg-[var(--brand-ink)] px-7 py-3.5 font-medium text-[var(--brand-paper)] transition-transform hover:-translate-y-0.5"
            >
              Request Beta Access
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
