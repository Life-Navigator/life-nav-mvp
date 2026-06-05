import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import ParallaxBackdrop from '@/components/site/ParallaxBackdrop';
import HeroScene from '@/components/site/HeroScene';
import MotionSection from '@/components/site/MotionSection';
import DataConnectionMap from '@/components/site/DataConnectionMap';
import ScrollZoom from '@/components/site/ScrollZoom';
import TrustArchitectureVisual from '@/components/site/TrustArchitectureVisual';
import ScenarioCard from '@/components/site/ScenarioCard';
import EnterpriseCTA from '@/components/site/EnterpriseCTA';
import Photo from '@/components/site/Photo';
import { IMG } from '@/components/site/media';

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
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#5eead4]">
      <span className="h-1 w-1 rounded-full bg-[#2dd4bf]" />
      {children}
    </div>
  );
}

const STATS = [
  ['6', 'life domains, one connected system'],
  ['0', 'invented facts — grounded or it refuses'],
  ['100%', 'per-user data isolation'],
  ['<3 min', 'from invite to first insight'],
];

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

const PERSONAS = [
  {
    name: 'Young Professional',
    tag: 'Alex · 28',
    line: 'Pay down a 21.99% card before investing, then capture the full 401(k) match.',
    stats: [
      ['Net worth', '$148,920'],
      ['Runway', '6.2 mo'],
    ],
  },
  {
    name: 'Dual-Income Family',
    tag: 'The Morales · 2 kids',
    line: 'Balance childcare costs, a home upgrade, and two 529 plans on one timeline.',
    stats: [
      ['Net worth', '$612,400'],
      ['Goals', '5 / 7'],
    ],
  },
  {
    name: 'Career Switcher',
    tag: 'Priya · 34',
    line: 'Model a bootcamp + pay cut against a higher-ceiling role two years out.',
    stats: [
      ['Program ROI', '3.1×'],
      ['Break-even', '22 mo'],
    ],
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

function SectionHead({
  eyebrow,
  title,
  body,
  center,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-5xl">{title}</h2>
      {body && <p className="mt-4 text-white/55">{body}</p>}
    </div>
  );
}

function FeatureRow({
  eyebrow,
  title,
  body,
  points,
  img,
  alt,
  reverse,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  img: string;
  alt: string;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <div className={reverse ? 'lg:order-2' : ''}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
          {title}
        </h3>
        <p className="mt-4 text-white/55">{body}</p>
        <ul className="mt-6 space-y-3">
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
      <div className={reverse ? 'lg:order-1' : ''}>
        <Photo src={img} alt={alt} className="aspect-[4/3]" rounded="rounded-3xl" />
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen text-white antialiased">
      <ParallaxBackdrop />
      <Navbar />

      {/* 1 · Hero */}
      <HeroScene />

      {/* Stats credibility band */}
      <MotionSection as="section" className="px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] sm:grid-cols-4">
          {STATS.map(([n, l]) => (
            <div key={l} className="bg-[#06060a]/40 px-6 py-7 backdrop-blur-sm">
              <div className="font-display text-3xl font-medium tracking-tight text-white">{n}</div>
              <div className="mt-1 text-xs leading-snug text-white/50">{l}</div>
            </div>
          ))}
        </div>
      </MotionSection>

      {/* 2 · Connected data layer — bento */}
      <MotionSection as="section" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            center
            eyebrow="Your connected data layer"
            title={
              <>
                Your whole life, in one{' '}
                <em className="italic-display text-gradient">private graph.</em>
              </>
            }
            body="LifeNavigator builds a personal knowledge graph — isolated to you — so the system reasons across every domain together, not in five disconnected apps."
          />

          <div className="stagger mt-14 grid auto-rows-[minmax(0,1fr)] gap-4 md:grid-cols-3">
            {/* big tile: data map */}
            <div className="edge-glow relative row-span-2 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm md:col-span-2">
              <div className="text-sm font-medium text-white">Connected data graph</div>
              <p className="mt-1 max-w-md text-sm text-white/50">
                Six domains feeding one decision-intelligence core — every link a path your data
                actually travels.
              </p>
              <ScrollZoom className="mt-4" from={0.6} to={1.04}>
                <DataConnectionMap tone="dark" />
              </ScrollZoom>
            </div>

            {/* grounded chat tile */}
            <div className="edge-glow relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wider text-[#5eead4]">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" /> Grounded
              </div>
              <div className="mt-3 rounded-xl bg-white/[0.04] p-3 text-xs text-white/70">
                What&apos;s my checking balance?
              </div>
              <div className="mt-2 rounded-xl border border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.06] p-3 text-xs text-white/85">
                Your Everyday Checking balance is{' '}
                <span className="font-semibold text-white">$3,200.00</span>. <br />
                <span className="text-white/45">Cited from your accounts — not guessed.</span>
              </div>
            </div>

            {/* plaid / read-only tile */}
            <div className="edge-glow relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#818cf8]/[0.08] to-transparent p-6 backdrop-blur-sm">
              <div className="text-[0.7rem] font-medium uppercase tracking-wider text-white/55">
                Plaid-connected · read-only
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ['Everyday Checking', '$3,200.00'],
                  ['High-Yield Savings', '$24,500.00'],
                  ['Brought-forward 401(k)', '$96,210.00'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="text-white/55">{k}</span>
                    <span className="font-semibold text-white">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-[0.7rem] text-white/40">
                Bank-grade. It can read, never move.
              </div>
            </div>
          </div>
        </div>
      </MotionSection>

      {/* 3 · Built for real life — photo collage */}
      <MotionSection as="section" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            center
            eyebrow="Built for real life"
            title={
              <>
                For the decisions that{' '}
                <em className="italic-display text-gradient">actually shape a life.</em>
              </>
            }
            body="Not dashboards for their own sake — the moments where money, time, work, and family collide."
          />
          <div className="stagger mt-14 grid gap-5 sm:grid-cols-3">
            <Photo src={IMG.team} alt="Professionals collaborating" className="aspect-[3/4]" />
            <Photo src={IMG.family} alt="A family at home" className="aspect-[3/4] sm:mt-10" />
            <Photo src={IMG.wellness} alt="Wellness and performance" className="aspect-[3/4]" />
          </div>
        </div>
      </MotionSection>

      {/* 4 · Decision domains */}
      <MotionSection as="section" id="product" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Decision domains"
            title={
              <>
                Six kinds of intelligence.{' '}
                <em className="italic-display text-gradient">One system.</em>
              </>
            }
          />
          <div className="stagger mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DOMAINS.map((d) => (
              <ScenarioCard key={d.domain} {...d} />
            ))}
          </div>
        </div>
      </MotionSection>

      {/* Feature rows with imagery */}
      <MotionSection as="section" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <FeatureRow
            eyebrow="Financial intelligence"
            title="Your money, finally in context."
            body="LifeNavigator reads your real accounts via Plaid and reasons about the trade-offs — debt vs. investing, runway vs. opportunity — instead of just charting the past."
            points={[
              'Debt-before-invest, weighed against your goals',
              'Net worth, cash, and APRs cited from your accounts',
              'Read-only — it can never move your money',
            ]}
            img={IMG.finance}
            alt="Financial dashboard and planning"
          />
        </div>
      </MotionSection>
      <MotionSection as="section" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <FeatureRow
            reverse
            eyebrow="Career & education"
            title="Decisions that compound over decades."
            body="A role change, a degree, a relocation — each one ripples through your finances and your life. LifeNavigator models them together so you can see the whole board."
            points={[
              'Compensation and timing vs. your runway',
              'Program ROI connected to the career it unlocks',
              'Scenario modeling across domains',
            ]}
            img={IMG.journey}
            alt="A long road ahead — decisions that compound over decades"
          />
        </div>
      </MotionSection>

      {/* 5 · How it works */}
      <MotionSection as="section" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="How it works"
            title={
              <>
                From your data to a decision{' '}
                <em className="italic-display text-gradient">you can trust.</em>
              </>
            }
          />
          <div className="relative mt-14">
            <div className="hairline absolute inset-x-0 top-6 hidden lg:block" />
            <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="edge-glow relative rounded-2xl border border-white/10 bg-[#08080c]/70 p-7 backdrop-blur-sm"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-full border border-[#2dd4bf]/30 bg-[#2dd4bf]/10 text-sm font-semibold text-[#5eead4]">
                    {s.n}
                  </div>
                  <h3 className="mt-4 font-semibold tracking-tight text-white">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MotionSection>

      {/* 6 · Trust architecture */}
      <MotionSection as="section" id="trust" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Trust architecture"
            title={
              <>
                Built to be <em className="italic-display text-gradient">trusted.</em>
              </>
            }
            body="Advice about your life has to be right. Our architecture separates how we reason from what is true about you."
          />
          <TrustArchitectureVisual className="mt-12" />
        </div>
      </MotionSection>

      {/* Vision quote */}
      <MotionSection as="section" className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-display text-2xl font-medium leading-snug text-white sm:text-[2.1rem]">
            “Most software manages information. LifeNavigator is built to help people make the
            decisions that actually change their lives —{' '}
            <span className="italic-display text-gradient">
              grounded in their own data, governed for trust.
            </span>
            ”
          </p>
          <p className="mt-6 text-sm text-white/45">The LifeNavigator vision</p>
        </div>
      </MotionSection>

      {/* 7 · Beta sample profiles */}
      <MotionSection as="section" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="The beta experience"
            title={
              <>
                Preview the system with{' '}
                <em className="italic-display text-gradient">safe sample profiles.</em>
              </>
            }
            body="Explore full insights, recommendations, and grounded chat on realistic lives — no real data required. When you're ready, bring your own."
          />
          <div className="stagger mt-12 grid gap-5 lg:grid-cols-3">
            {PERSONAS.map((p) => (
              <div
                key={p.name}
                className="edge-glow relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[0.7rem] font-medium uppercase tracking-wider text-[#5eead4]">
                    Sample profile
                  </div>
                  <div className="rounded-full bg-white/8 px-2.5 py-0.5 text-[0.7rem] text-white/55">
                    {p.tag}
                  </div>
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">{p.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{p.line}</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {p.stats.map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
                      <div className="text-[0.65rem] uppercase tracking-wider text-white/35">
                        {k}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-white">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div
            className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 p-6 text-center sm:flex-row sm:text-left"
            style={{
              background: 'linear-gradient(135deg, rgba(45,212,191,0.1), rgba(99,102,241,0.06))',
            }}
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-white/60">
                The full product
              </div>
              <p className="mt-1 text-sm text-white/70">
                Your real connected data via Plaid, your goals, history, and context.
              </p>
            </div>
            <Link href="/beta" className="btn-primary shrink-0 rounded-xl px-6 py-3 font-medium">
              Request Beta Invite
            </Link>
          </div>
        </div>
      </MotionSection>

      {/* 8 · Security */}
      <MotionSection as="section" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Security & privacy"
            title={
              <>
                Private by <em className="italic-display text-gradient">architecture.</em>
              </>
            }
          />
          <div className="stagger mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                'Per-user isolation',
                'Row-level security across every store; your graph is never mixed with anyone else’s.',
              ],
              ['Encryption', 'In transit and at rest; least-privilege access throughout.'],
              ['Read-only Plaid', 'Bank-grade connectivity that can read, never move, your money.'],
              [
                'Governed output',
                'A constitutional + compliance layer reviews advice before it reaches you.',
              ],
            ].map(([t, d]) => (
              <div
                key={t}
                className="edge-glow relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm"
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

      {/* 9 · FAQ */}
      <MotionSection as="section" className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
            Questions
          </h2>
          <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {FAQ.map((x) => (
              <details key={x.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-white marker:hidden">
                  {x.q}
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 text-white/60 transition-transform duration-300 group-open:rotate-45">
                    <svg
                      viewBox="0 0 20 20"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                    >
                      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{x.a}</p>
              </details>
            ))}
          </div>
        </div>
      </MotionSection>

      {/* 10 · Final CTA */}
      <EnterpriseCTA />
      <Footer />
    </div>
  );
}
