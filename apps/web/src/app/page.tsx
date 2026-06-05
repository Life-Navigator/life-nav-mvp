import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import HeroScene from '@/components/site/HeroScene';
import MotionSection from '@/components/site/MotionSection';
import DeviceMockup from '@/components/site/DeviceMockup';
import DataConnectionMap from '@/components/site/DataConnectionMap';
import TrustArchitectureVisual from '@/components/site/TrustArchitectureVisual';
import ScenarioCard from '@/components/site/ScenarioCard';
import EnterpriseCTA from '@/components/site/EnterpriseCTA';

export const metadata = {
  title: 'LifeNavigator — Decision Intelligence for Life',
  description:
    'LifeNavigator connects your finances, career, education, health, and goals into one trusted AI system — helping you make better decisions grounded in your own data.',
};

function Ico({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const DOMAINS = [
  {
    domain: 'Finance',
    title: 'Financial Intelligence',
    detail:
      'Cash flow, debt, and net worth — and the trade-offs between them, read from your real accounts.',
    metric: 'Plaid-connected',
    icon: <Ico d="M3 7h18M3 12h18M3 17h10" />,
  },
  {
    domain: 'Career',
    title: 'Career Intelligence',
    detail: 'Roles, compensation, and timing, weighed against your goals and runway.',
    metric: 'Goal-aware',
    icon: <Ico d="M4 7h16v13H4zM9 7V4h6v3" />,
  },
  {
    domain: 'Education',
    title: 'Education Intelligence',
    detail: 'Programs, costs, and ROI — connected to the career and finances they affect.',
    metric: 'ROI-modeled',
    icon: <Ico d="M12 4 2 9l10 5 10-5zM6 11v5l6 3 6-3v-5" />,
  },
  {
    domain: 'Health',
    title: 'Health Intelligence',
    detail: 'The decisions where money, time, and wellbeing intersect.',
    metric: 'Holistic',
    icon: <Ico d="M12 21s-7-4.5-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.5-9 9-9 9z" />,
  },
  {
    domain: 'Family',
    title: 'Family Intelligence',
    detail: 'Childcare, housing, and care — modeled across the whole picture.',
    metric: 'Multi-earner',
    icon: (
      <Ico d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a7 7 0 0 1 14 0M17 11a3 3 0 1 0-1-5.8M22 20a6.5 6.5 0 0 0-5-6.3" />
    ),
  },
  {
    domain: 'Decisions',
    title: 'Decision Intelligence',
    detail: 'The layer above all of them — connected reasoning, not five separate apps.',
    metric: 'Connected',
    icon: <Ico d="M12 3v6m0 6v6M5 8l4 4-4 4M19 8l-4 4 4 4" />,
  },
];

const STEPS = [
  {
    n: '01',
    t: 'Connect your world',
    d: 'Accounts via Plaid, plus goals, career, education, and family context. In the beta, a sample profile stands in.',
  },
  {
    n: '02',
    t: 'Ground every fact',
    d: 'Your real figures are read from your system of record and labeled authoritative. Nothing is invented.',
  },
  {
    n: '03',
    t: 'Reason under governance',
    d: 'Central methodology and a safety + compliance layer shape how the answer forms — never what is true.',
  },
  {
    n: '04',
    t: 'Decide with confidence',
    d: 'A connected recommendation across every domain — or an honest “I don’t have that yet.”',
  },
];

const FAQ = [
  {
    q: 'Is this budgeting software?',
    a: 'No. Budgeting tools record what happened. LifeNavigator reasons across your finances, career, education, health, and family to help you decide what to do next.',
  },
  {
    q: 'What does the beta use?',
    a: 'The beta uses realistic sample life profiles so you can preview the full system safely. The final product uses your real connected data via Plaid, your goals, history, and context.',
  },
  {
    q: 'How do you prevent AI from making things up?',
    a: 'Personal facts are read deterministically from your system of record and labeled authoritative. If a fact is not present, the assistant refuses rather than inventing it — fail-closed.',
  },
  {
    q: 'Is my data private?',
    a: 'Your personal graph is isolated per user with row-level security and encryption. Central policy knowledge is shared and contains no personal data. Plaid connectivity is read-only.',
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wider text-[var(--brand-accent)]">
      {children}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--brand-paper)] text-[var(--brand-ink)] antialiased">
      <Navbar />

      {/* 1 · Hero */}
      <HeroScene />

      {/* 2 · Product mockup / dashboard */}
      <MotionSection as="section" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>The product</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              One dashboard for every decision that matters.
            </h2>
            <p className="mt-4 text-[var(--brand-muted)]">
              Insights, recommendations, and a grounded assistant — reading from your real data,
              presented with the restraint of a tool you&apos;ll trust with your life.
            </p>
          </div>
          <div className="mx-auto mt-14 max-w-4xl">
            <DeviceMockup variant="laptop" />
          </div>
        </div>
      </MotionSection>

      {/* 3 · Your data layer */}
      <MotionSection
        as="section"
        className="border-y border-[var(--brand-line)] bg-white/40 px-6 py-24 dark:bg-white/[0.02]"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Your data layer</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              Your whole life, in one private graph.
            </h2>
            <p className="mt-4 text-[var(--brand-muted)]">
              A career move changes your finances. A degree changes your career. A family decision
              touches all of it. LifeNavigator builds a personal knowledge graph — isolated to you —
              so the system reasons across your domains together, not in five disconnected apps.
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--brand-line)] bg-[var(--brand-paper)] p-6 [box-shadow:var(--brand-elev)]">
            <DataConnectionMap tone="light" />
          </div>
        </div>
      </MotionSection>

      {/* 4 · What LifeNavigator helps with */}
      <MotionSection as="section" id="product" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Eyebrow>What it helps with</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              Six kinds of intelligence. One system.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DOMAINS.map((d) => (
              <ScenarioCard key={d.domain} {...d} />
            ))}
          </div>
        </div>
      </MotionSection>

      {/* 5 · How it works */}
      <MotionSection as="section" className="border-t border-[var(--brand-line)] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              From your data to a decision you can trust.
            </h2>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-line)] sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-[var(--brand-paper)] p-7">
                <div className="text-sm font-semibold text-[var(--brand-accent)]">{s.n}</div>
                <h3 className="mt-2 font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </MotionSection>

      {/* 6 · Trust architecture */}
      <MotionSection
        as="section"
        id="trust"
        className="border-t border-[var(--brand-line)] bg-white/40 px-6 py-24 dark:bg-white/[0.02]"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Eyebrow>Trust architecture</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              Built to be trusted.
            </h2>
            <p className="mt-4 text-[var(--brand-muted)]">
              Advice about your life has to be right. Our architecture separates how we reason from
              what is true about you.
            </p>
          </div>
          <TrustArchitectureVisual className="mt-12" />
        </div>
      </MotionSection>

      {/* 7 · Beta experience */}
      <MotionSection as="section" className="px-6 py-24">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-[var(--brand-line)] [box-shadow:var(--brand-elev)]">
          <div className="grid sm:grid-cols-2">
            <div className="bg-[var(--brand-paper)] p-9">
              <Eyebrow>Today · Beta</Eyebrow>
              <h3 className="mt-3 text-xl font-semibold">Safe sample life profiles</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">
                Preview the entire system on a realistic profile — grounded insights,
                recommendations, and chat. No real data required. This is a preview, not the final
                experience.
              </p>
            </div>
            <div className="bg-[#07070a] p-9 text-white">
              <div className="text-xs font-medium uppercase tracking-wider text-[#5eead4]">
                The full product
              </div>
              <h3 className="mt-3 text-xl font-semibold">Your real connected data</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Connect your accounts via Plaid, your goals, history, and context — and the same
                intelligence runs on your actual life.
              </p>
            </div>
          </div>
        </div>
      </MotionSection>

      {/* 8 · Security & privacy */}
      <MotionSection as="section" className="border-t border-[var(--brand-line)] px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-line)] sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              'Per-user isolation',
              'Row-level security across every store; your graph is never mixed with anyone else’s.',
            ],
            ['Encryption', 'Encryption in transit and at rest; least-privilege access throughout.'],
            ['Read-only Plaid', 'Bank-grade connectivity that can read, never move, your money.'],
            [
              'Governed output',
              'A constitutional + compliance layer reviews advice before it reaches you.',
            ],
          ].map(([t, d]) => (
            <div key={t} className="bg-[var(--brand-paper)] p-6">
              <h3 className="text-sm font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--brand-muted)]">{d}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-6 max-w-6xl">
          <Link
            href="/trust"
            className="text-sm font-medium text-[var(--brand-accent)] hover:underline"
          >
            Visit the Trust Center →
          </Link>
        </div>
      </MotionSection>

      {/* 9 · Pricing / beta access */}
      <MotionSection as="section" className="px-6 pb-8 pt-4">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-2xl border border-[var(--brand-line)] p-8 text-center sm:flex-row sm:justify-between sm:text-left [box-shadow:var(--brand-elev)]">
          <div>
            <h3 className="font-display text-xl font-semibold">
              Invite-only beta · free during preview
            </h3>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              Pricing for the full product will be announced at general availability.
            </p>
          </div>
          <Link
            href="/beta"
            className="rounded-xl bg-[var(--brand-ink)] px-6 py-3 font-medium text-[var(--brand-paper)] transition-transform hover:-translate-y-0.5"
          >
            Request Beta Invite
          </Link>
        </div>
      </MotionSection>

      {/* 10 · FAQ */}
      <MotionSection as="section" className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-semibold">Questions</h2>
          <dl className="mt-10 divide-y divide-[var(--brand-line)]">
            {FAQ.map((x) => (
              <div key={x.q} className="py-6">
                <dt className="font-medium">{x.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">{x.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </MotionSection>

      {/* 11 · Final CTA */}
      <EnterpriseCTA />

      <Footer />
    </div>
  );
}
