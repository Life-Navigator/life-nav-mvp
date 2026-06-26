import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import ParallaxBackdrop from '@/components/site/ParallaxBackdrop';
import MotionSection from '@/components/site/MotionSection';
import DeviceMockup from '@/components/site/DeviceMockup';
import FloatingInsightCard from '@/components/site/FloatingInsightCard';
import DataConnectionMap from '@/components/site/DataConnectionMap';
import Photo from '@/components/site/Photo';
import { IMG } from '@/components/site/media';

export const metadata = {
  title: 'Product — LifeNavigator',
  description:
    'The LifeNavigator platform: a grounded decision-intelligence dashboard across finance, career, education, health, and family.',
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wider text-[#5eead4]">{children}</div>
  );
}

const CAPS = [
  {
    title: 'Financial Intelligence',
    img: IMG.finance,
    body: 'Real accounts via Plaid, reasoned in context — debt vs. investing, runway vs. opportunity, net worth cited from your data.',
    points: [
      'Authoritative balances, debts & APRs',
      'Debt-before-invest gating',
      'Read-only connectivity',
    ],
  },
  {
    title: 'Career & Education',
    img: IMG.education,
    body: 'Roles, compensation, programs, and ROI — modeled against your goals and the finances they move.',
    points: ['Compensation vs. runway', 'Program ROI → career impact', 'Cross-domain scenarios'],
  },
  {
    title: 'Health & Family',
    img: IMG.family,
    body: 'The decisions where money, time, and wellbeing intersect — childcare, housing, care, performance.',
    points: ['Whole-picture trade-offs', 'Multi-earner modeling', 'Major-moment planning'],
  },
];

export default function ProductPage() {
  return (
    <div className="relative min-h-screen text-white antialiased">
      <ParallaxBackdrop />
      <Navbar />

      <section className="relative overflow-hidden px-6 pt-40 pb-20 text-center">
        <div aria-hidden className="aurora pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-3xl rise">
          <Eyebrow>The platform</Eyebrow>
          <h1 className="mt-3 font-display text-5xl font-semibold sm:text-6xl">
            A decision-intelligence dashboard for your whole life.
          </h1>
          <p className="measure mx-auto mt-6 text-lg text-white/60">
            Insights, recommendations, and a grounded assistant — reading from your real data across
            every domain, in one trusted system.
          </p>
          <div className="mt-9 flex justify-center gap-3">
            <Link
              href="/auth?mode=magic"
              className="rounded-xl bg-white px-7 py-3.5 font-medium text-[#06060a] transition-transform hover:-translate-y-0.5"
            >
              Request Beta Invite
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-xl border border-white/20 px-7 py-3.5 font-medium text-white hover:bg-white/5"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* big product scene */}
      <MotionSection as="section" className="px-6 pb-24">
        <div className="relative mx-auto max-w-5xl [perspective:1600px]">
          <div
            className="pointer-events-none absolute -inset-12 -z-10 rounded-[3rem] blur-3xl"
            style={{
              background:
                'radial-gradient(60% 60% at 50% 30%, rgba(45,212,191,0.2), transparent 70%)',
            }}
          />
          <div className="[transform:rotateX(5deg)]">
            <DeviceMockup variant="laptop" />
          </div>
          <div className="absolute -right-4 top-8 hidden w-60 md:block">
            <FloatingInsightCard
              eyebrow="Grounded"
              spark
              title="Cited from your accounts"
              detail="Every figure traces to a source."
            />
          </div>
          <div className="absolute -left-6 bottom-6 hidden w-56 lg:block">
            <FloatingInsightCard
              eyebrow="Governed"
              spark
              title="Refuses when unknown"
              detail="No data? It says so."
            />
          </div>
        </div>
      </MotionSection>

      {/* capability deep-dives */}
      {CAPS.map((c, i) => (
        <MotionSection key={c.title} as="section" className="border-t border-white/10 px-6 py-20">
          <div className="mx-auto grid max-w-[1600px] items-center gap-12 lg:grid-cols-2">
            <div className={i % 2 ? 'lg:order-2' : ''}>
              <Eyebrow>{c.title}</Eyebrow>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{c.title}</h2>
              <p className="mt-4 text-white/55">{c.body}</p>
              <ul className="mt-6 space-y-3">
                {c.points.map((p) => (
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
            <div className={i % 2 ? 'lg:order-1' : ''}>
              <Photo src={c.img} alt={c.title} className="aspect-[4/3]" rounded="rounded-3xl" />
            </div>
          </div>
        </MotionSection>
      ))}

      <MotionSection as="section" className="border-t border-white/10 px-6 py-24">
        <div className="mx-auto grid max-w-[1600px] items-center gap-14 lg:grid-cols-2">
          <div>
            <Eyebrow>One private graph</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              Connected reasoning, not five apps.
            </h2>
            <p className="mt-4 text-white/55">
              Your domains feed a single decision-intelligence core, isolated to you — so a change
              in one is reflected across all.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
            <DataConnectionMap tone="dark" />
          </div>
        </div>
      </MotionSection>

      <section className="px-6 pb-28 pt-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center backdrop-blur-sm">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            See it on a sample profile.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-white/55">
            Request a beta invite and preview the entire platform in minutes.
          </p>
          <Link
            href="/auth?mode=magic"
            className="mt-8 inline-block rounded-xl bg-white px-8 py-3.5 font-medium text-[#06060a] transition-transform hover:-translate-y-0.5"
          >
            Request Beta Invite
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
