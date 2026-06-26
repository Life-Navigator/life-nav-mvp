import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import ParallaxBackdrop from '@/components/site/ParallaxBackdrop';

export const metadata = {
  title: 'Trust Center — LifeNavigator',
  description: 'How LifeNavigator keeps your data private and its advice grounded and governed.',
};

const PILLARS = [
  {
    t: 'Grounded AI',
    d: 'Every personal fact — balances, APRs, goals, history — is read deterministically from your system of record and labeled authoritative. The model is instructed never to invent personal data.',
  },
  {
    t: 'Fail-Closed',
    d: 'If a fact is missing or unavailable, the assistant says so and offers to help you add it. It does not estimate, infer, or fill in from an example.',
  },
  {
    t: 'Personal GraphRAG',
    d: 'Your data lives in a private knowledge graph isolated per user, with row-level security across every store.',
  },
  {
    t: 'Two-Layer Separation',
    d: 'Central knowledge (shared methodology, compliance, safety) governs how we answer. Your personal data — never shared — determines what is true.',
  },
  {
    t: 'Governed Recommendations',
    d: 'Advice passes a constitutional + compliance layer before it reaches you; unsafe or non-compliant output is blocked.',
  },
  {
    t: 'Privacy by Design',
    d: 'Least-privilege access, encryption, and per-user isolation throughout. Plaid connectivity (full product) is read-only.',
  },
];

export default function TrustPage() {
  return (
    <div className="dark relative min-h-screen text-[var(--brand-ink)] antialiased">
      <ParallaxBackdrop />
      <Navbar />
      <section className="px-6 pt-36 pb-16">
        <div className="mx-auto max-w-3xl rise">
          <h1 className="font-display text-5xl font-semibold sm:text-6xl">Trust Center</h1>
          <p className="measure mt-6 text-lg text-[var(--brand-muted)]">
            Advice about your life has to be right. Here is exactly how we keep it grounded,
            governed, and private.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto grid max-w-[1600px] gap-px overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-line)] sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.t} className="bg-[var(--brand-paper)] p-7">
              <h3 className="font-semibold">{p.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--brand-line)] px-6 py-14">
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[var(--brand-muted)]">Looking for specifics?</p>
          <div className="flex gap-6">
            <Link
              href="/security"
              className="font-medium text-[var(--brand-accent)] hover:underline"
            >
              Security →
            </Link>
            <Link
              href="/legal/privacy"
              className="font-medium text-[var(--brand-accent)] hover:underline"
            >
              Privacy Policy →
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
