import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import ParallaxBackdrop from '@/components/site/ParallaxBackdrop';
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
    <div className="text-xs font-medium uppercase tracking-wider text-[#5eead4]">{children}</div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen text-white antialiased">
      <ParallaxBackdrop />
      <Navbar />

      {/* 1 · Hero */}
      <HeroScene />

      {/* 2 · Product dashboard */}
      <MotionSection as="section" className="px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>The product</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-5xl">
              One dashboard for every decision that matters.
            </h2>
            <p className="mt-4 text-white/55">
              Insights, recommendations, and a grounded assistant — reading from your real data,
              presented with the restraint of a tool you&apos;ll trust with your life.
            </p>
          </div>
          <div className="relative mx-auto mt-16 max-w-4xl [perspective:1600px]">
            <div
              className="pointer-events-none absolute -inset-x-16 -top-12 bottom-0 -z-10 rounded-[3rem] blur-3xl"
              style={{
                background:
                  'radial-gradient(60% 60% at 50% 30%, rgba(45,212,191,0.18), transparent 70%)',
              }}
            />
            <div className="[transform:rotateX(6deg)]">
              <DeviceMockup variant="laptop" />
            </div>
          </div>
        </div>
      </MotionSection>

      {/* 3 · Your data layer */}
      <MotionSection as="section" className="border-y border-white/10 px-6 py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <Eyebrow>Your data layer</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-5xl">
              Your whole life, in one private graph.
            </h2>
            <p className="mt-4 text-white/55">
              A career move changes your finances. A degree changes your career. A family decision
              touches all of it. LifeNavigator builds a personal knowledge graph — isolated to you —
              so the system reasons across your domains together, not in five disconnected apps.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
            <DataConnectionMap tone="dark" />
          </div>
        </div>
      </MotionSection>

      {/* 4 · What it helps with */}
      <MotionSection as="section" id="product" className="px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Eyebrow>What it helps with</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-5xl">
              Six kinds of intelligence. One system.
            </h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DOMAINS.map((d) => (
              <ScenarioCard key={d.domain} {...d} />
            ))}
          </div>
        </div>
      </MotionSection>

      {/* 5 · How it works */}
      <MotionSection as="section" className="border-t border-white/10 px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-5xl">
              From your data to a decision you can trust.
            </h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm"
              >
                <div className="text-sm font-semibold text-[#5eead4]">{s.n}</div>
                <h3 className="mt-2 font-semibold text-white">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </MotionSection>

      {/* 6 · Trust architecture */}
      <MotionSection as="section" id="trust" className="border-t border-white/10 px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Eyebrow>Trust architecture</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-5xl">
              Built to be trusted.
            </h2>
            <p className="mt-4 text-white/55">
              Advice about your life has to be right. Our architecture separates how we reason from
              what is true about you.
            </p>
          </div>
          <TrustArchitectureVisual className="mt-14" />
        </div>
      </MotionSection>

      {/* 7 · Beta experience */}
      <MotionSection as="section" className="px-6 py-28">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10">
          <div className="grid sm:grid-cols-2">
            <div className="bg-white/[0.03] p-10 backdrop-blur-sm">
              <Eyebrow>Today · Beta</Eyebrow>
              <h3 className="mt-3 text-xl font-semibold text-white">Safe sample life profiles</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Preview the entire system on a realistic profile — grounded insights,
                recommendations, and chat. No real data required. This is a preview, not the final
                experience.
              </p>
            </div>
            <div
              className="p-10"
              style={{
                background: 'linear-gradient(135deg, rgba(45,212,191,0.12), rgba(99,102,241,0.08))',
              }}
            >
              <div className="text-xs font-medium uppercase tracking-wider text-[#5eead4]">
                The full product
              </div>
              <h3 className="mt-3 text-xl font-semibold text-white">Your real connected data</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Connect your accounts via Plaid, your goals, history, and context — and the same
                intelligence runs on your actual life.
              </p>
            </div>
          </div>
        </div>
      </MotionSection>

      {/* 8 · Security & privacy */}
      <MotionSection as="section" className="border-t border-white/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                'Per-user isolation',
                'Row-level security across every store; your graph is never mixed with anyone else’s.',
              ],
              [
                'Encryption',
                'Encryption in transit and at rest; least-privilege access throughout.',
              ],
              ['Read-only Plaid', 'Bank-grade connectivity that can read, never move, your money.'],
              [
                'Governed output',
                'A constitutional + compliance layer reviews advice before it reaches you.',
              ],
            ].map(([t, d]) => (
              <div
                key={t}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm"
              >
                <h3 className="text-sm font-semibold text-white">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Link href="/trust" className="text-sm font-medium text-[#5eead4] hover:underline">
              Visit the Trust Center →
            </Link>
          </div>
        </div>
      </MotionSection>

      {/* 9 · Pricing / beta access */}
      <MotionSection as="section" className="px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-sm sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h3 className="font-display text-xl font-semibold text-white">
              Invite-only beta · free during preview
            </h3>
            <p className="mt-1 text-sm text-white/55">
              Pricing for the full product will be announced at general availability.
            </p>
          </div>
          <Link
            href="/beta"
            className="rounded-xl bg-white px-6 py-3 font-medium text-[#06060a] transition-transform hover:-translate-y-0.5"
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
          <dl className="mt-10 divide-y divide-white/10">
            {FAQ.map((x) => (
              <div key={x.q} className="py-6">
                <dt className="font-medium text-white">{x.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-white/55">{x.a}</dd>
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
