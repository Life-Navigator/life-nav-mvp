import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';

export const metadata = {
  title: 'LifeNavigator — Decision Intelligence for Life',
  description:
    'LifeNavigator connects your financial, career, education, health, and family data to help you make better decisions — grounded in your data, governed for trust.',
};

const DOMAINS = [
  {
    k: 'Financial',
    d: 'Cash flow, debt, net worth, and the trade-offs between them — read from your real accounts.',
  },
  { k: 'Career', d: 'Roles, compensation, and timing, weighed against your goals and runway.' },
  {
    k: 'Education',
    d: 'Programs, costs, and ROI — connected to the career and finances they affect.',
  },
  { k: 'Health', d: 'The decisions where money, time, and wellbeing intersect.' },
  {
    k: 'Family',
    d: 'Major moments — childcare, housing, care — modeled across the whole picture.',
  },
  { k: 'Decision', d: 'The layer above all of them: connected reasoning, not five separate apps.' },
];

const TRUST = [
  {
    t: 'Grounded AI',
    d: 'Every personal fact is read from your system of record — never invented.',
  },
  { t: 'Personal GraphRAG', d: 'A private knowledge graph of your data, isolated per user.' },
  {
    t: 'Privacy by Design',
    d: 'Row-level isolation, encryption, and least-privilege access throughout.',
  },
  { t: 'Plaid Integration', d: 'Bank-grade account connectivity (full product) — read-only.' },
  {
    t: 'Governed Recommendations',
    d: 'Advice passes a constitutional + compliance layer before you see it.',
  },
  { t: 'Fail-Closed Responses', d: 'If the data is missing, it says so — it does not guess.' },
];

const FAQ = [
  {
    q: 'Is this budgeting software?',
    a: 'No. Budgeting tools record what happened. LifeNavigator reasons across your finances, career, education, health, and family to help you decide what to do next.',
  },
  {
    q: 'What does the beta use?',
    a: 'The beta uses realistic sample profiles so you can preview the full system safely. The full product connects your real accounts via Plaid and your own goals, history, and context.',
  },
  {
    q: 'How do you prevent AI from making things up?',
    a: 'Personal facts are read deterministically from your system of record and labeled as authoritative. If a fact is not present, the assistant refuses rather than inventing it.',
  },
  {
    q: 'Is my data private?',
    a: 'Your personal graph is isolated per user with row-level security and encryption. Central policy knowledge is shared and contains no personal data.',
  },
];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-line)] bg-[var(--brand-paper)] px-3 py-1 text-sm text-[var(--brand-muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent)]" />
      {children}
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--brand-paper)] text-[var(--brand-ink)] antialiased">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-36 pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5] [background:radial-gradient(60rem_30rem_at_50%_-10%,var(--brand-accent-soft),transparent)]"
        />
        <div className="relative mx-auto max-w-3xl text-center rise">
          <div className="mb-6 flex justify-center">
            <Pill>Invite-only beta — Decision Intelligence Platform</Pill>
          </div>
          <h1 className="font-display text-5xl font-semibold sm:text-6xl lg:text-[4.5rem]">
            Decision Intelligence
            <br />
            <span className="text-[var(--brand-accent)]">for Life</span>
          </h1>
          <p className="measure mx-auto mt-7 text-lg leading-relaxed text-[var(--brand-muted)]">
            Most software manages information. LifeNavigator connects your financial, career,
            education, health, and family data — and helps you make better decisions across all of
            it.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/beta"
              className="w-full rounded-xl bg-[var(--brand-ink)] px-7 py-3.5 text-center font-medium text-[var(--brand-paper)] transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Request Beta Access
            </Link>
            <Link
              href="/how-it-works"
              className="w-full rounded-xl border border-[var(--brand-line)] px-7 py-3.5 text-center font-medium text-[var(--brand-ink)] transition-colors hover:bg-white/60 sm:w-auto dark:hover:bg-white/5"
            >
              See How It Works
            </Link>
          </div>
          <p className="mt-5 text-sm text-[var(--brand-muted)]">
            Grounded in your data · Governed for trust · Built for real life
          </p>
        </div>
      </section>

      {/* ── Positioning ──────────────────────────────────────────────────── */}
      <section className="border-y border-[var(--brand-line)] px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="font-display text-2xl font-medium leading-snug sm:text-3xl">
            Your most important decisions don&apos;t live in separate apps. A career move changes
            your finances. A degree changes your career. A family decision touches all of it.
            <span className="text-[var(--brand-muted)]">
              {' '}
              LifeNavigator is the first layer that reasons across them together.
            </span>
          </p>
        </div>
      </section>

      {/* ── Product: six intelligences ───────────────────────────────────── */}
      <section id="product" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              One platform. Six kinds of intelligence.
            </h2>
            <p className="mt-4 text-[var(--brand-muted)]">
              Each domain is grounded in your real data — and connected to the others, because
              that&apos;s how real decisions work.
            </p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-line)] sm:grid-cols-2 lg:grid-cols-3">
            {DOMAINS.map((x) => (
              <div
                key={x.k}
                className="bg-[var(--brand-paper)] p-7 transition-colors hover:bg-white/70 dark:hover:bg-white/5"
              >
                <div className="text-xs font-medium uppercase tracking-wider text-[var(--brand-accent)]">
                  Intelligence
                </div>
                <h3 className="mt-2 text-xl font-semibold">{x.k}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust / architecture ─────────────────────────────────────────── */}
      <section
        id="trust"
        className="border-t border-[var(--brand-line)] bg-white/40 px-6 py-24 dark:bg-white/[0.02]"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              Built to be trusted.
            </h2>
            <p className="mt-4 text-[var(--brand-muted)]">
              Advice about your life has to be right. Our architecture separates how we reason from
              what is true about you.
            </p>
          </div>

          {/* simple two-layer architecture diagram */}
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--brand-line)] p-7 [box-shadow:var(--brand-elev)]">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--brand-muted)]">
                Central knowledge — governs HOW
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">
                Shared methodology, compliance, and safety policy. The same for everyone. Contains
                no personal data.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--brand-accent)]/30 bg-[var(--brand-accent-soft)] p-7 [box-shadow:var(--brand-elev)]">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--brand-accent)]">
                Your data — determines WHAT is true
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--brand-ink)]/70">
                Your accounts, goals, and history — isolated to you. The only source for any
                personal fact. If it is missing, the system says so.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-line)] sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((x) => (
              <div key={x.t} className="bg-[var(--brand-paper)] p-6">
                <h3 className="text-base font-semibold">{x.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--brand-muted)]">{x.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Link
              href="/trust"
              className="text-sm font-medium text-[var(--brand-accent)] hover:underline"
            >
              Visit the Trust Center →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Beta clarity ─────────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--brand-line)] p-10 [box-shadow:var(--brand-elev)]">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">
            What the beta is — and what comes next
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--brand-accent)]">
                Today · Beta
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">
                Preview the full system safely with{' '}
                <strong className="text-[var(--brand-ink)]">realistic sample profiles</strong>.
                Activate a profile and see grounded insights, recommendations, and chat — no real
                data required.
              </p>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--brand-muted)]">
                Full product
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">
                Connect your{' '}
                <strong className="text-[var(--brand-ink)]">real accounts via Plaid</strong>, your
                goals, history, and context — and the same intelligence runs on your actual life.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--brand-line)] px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-semibold">Questions</h2>
          <dl className="mt-10 divide-y divide-[var(--brand-line)]">
            {FAQ.map((x) => (
              <div key={x.q} className="py-6">
                <dt className="font-medium">{x.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">{x.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="px-6 pb-28">
        <div className="mx-auto max-w-4xl rounded-3xl bg-[var(--brand-ink)] px-8 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-[var(--brand-paper)] sm:text-4xl">
            Stop managing information.
            <br />
            Start making better decisions.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--brand-paper)]/60">
            LifeNavigator is in invite-only beta. Request access and preview the future of personal
            decision intelligence.
          </p>
          <div className="mt-9">
            <Link
              href="/beta"
              className="inline-block rounded-xl bg-[var(--brand-paper)] px-8 py-3.5 font-medium text-[var(--brand-ink)] transition-transform hover:-translate-y-0.5"
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
