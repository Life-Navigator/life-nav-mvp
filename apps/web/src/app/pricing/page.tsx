'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import ParallaxBackdrop from '@/components/site/ParallaxBackdrop';
import MotionSection from '@/components/site/MotionSection';

/* ── Inline icons ── */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function SparklesIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}
function RocketIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  );
}

/* ── Types ── */
interface TierFeature {
  name: string;
  included: boolean;
}
interface Tier {
  id: string;
  name: string;
  description: string;
  price: { monthly: number; annual: number };
  icon: React.ReactNode;
  available: boolean;
  popular?: boolean;
  custom?: boolean;
  comingSoon?: boolean;
  features: TierFeature[];
  cta: string;
  ctaLink: string;
}
interface CreditPack {
  credits: number;
  price: number;
  priceId: string;
  popular?: boolean;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#5eead4]">
      <span className="h-1 w-1 rounded-full bg-[#2dd4bf]" />
      {children}
    </div>
  );
}

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const tiers: Tier[] = [
    {
      id: 'freemium',
      name: 'Freemium',
      description: 'Get started with the LifeNavigator basics — free, forever.',
      price: { monthly: 0, annual: 0 },
      icon: <SparklesIcon />,
      available: true,
      features: [
        { name: '5 chat queries per day', included: true },
        { name: '5 scenario lab runs per day', included: true },
        { name: 'Unlimited onboarding queries', included: true },
        { name: 'Financial overview & insights', included: true },
        { name: 'Basic goal tracking', included: true },
        { name: 'Purchase additional credits anytime', included: true },
        { name: 'Career module access', included: false },
        { name: 'Advanced health analytics', included: false },
        { name: 'Priority support', included: false },
      ],
      cta: 'Get Started Free',
      ctaLink: '/auth?mode=create',
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Unlock the full platform with unlimited access.',
      price: { monthly: 25, annual: 250 },
      icon: <RocketIcon />,
      available: true,
      popular: true,
      comingSoon: true,
      features: [
        { name: '200 chat queries per month', included: true },
        { name: 'Unlimited scenario lab runs', included: true },
        { name: 'Full career module access', included: true },
        { name: 'Resume builder & job matching', included: true },
        { name: 'Advanced health analytics', included: true },
        { name: 'Education planning & ROI analysis', included: true },
        { name: 'Tax optimization strategies', included: true },
        { name: 'Priority email support', included: true },
        { name: 'Multi-user access', included: false },
      ],
      cta: 'Join the Pro Waitlist',
      ctaLink: '/waitlist?tier=pro',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for teams and advisors. Pricing varies with your team.',
      price: { monthly: 0, annual: 0 },
      icon: <BuildingIcon />,
      available: true,
      custom: true,
      features: [
        { name: 'Unlimited everything', included: true },
        { name: 'White-label branding & custom domain', included: true },
        { name: 'Multi-user access (50+)', included: true },
        { name: 'SSO & advanced security', included: true },
        { name: 'Dedicated account manager', included: true },
        { name: 'Custom integrations & API access', included: true },
        { name: 'Priority phone support', included: true },
        { name: 'Onboarding, training & custom SLA', included: true },
      ],
      cta: 'Book a Consultation',
      ctaLink: '/waitlist?tier=enterprise',
    },
  ];

  const creditPacks: { chat: CreditPack[]; scenario: CreditPack[] } = {
    chat: [
      { credits: 10, price: 2, priceId: 'price_chat_10' },
      { credits: 30, price: 5, priceId: 'price_chat_30', popular: true },
      { credits: 60, price: 9, priceId: 'price_chat_60' },
    ],
    scenario: [
      { credits: 10, price: 3, priceId: 'price_scenario_10' },
      { credits: 30, price: 7, priceId: 'price_scenario_30', popular: true },
      { credits: 60, price: 12, priceId: 'price_scenario_60' },
    ],
  };

  return (
    <div className="relative min-h-screen text-white antialiased">
      <ParallaxBackdrop />
      <Navbar />

      <div className="mx-auto max-w-6xl px-6 pt-36 pb-20 sm:pt-40">
        {/* Header */}
        <div className="text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight sm:text-6xl">
            Start free. <em className="italic-display text-gradient">Upgrade when you’re ready.</em>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-white/60">
            Every plan includes unlimited onboarding queries and the grounded, governed assistant.
            No surprises — and the beta is free during preview.
          </p>

          {/* Billing toggle */}
          <div
            role="group"
            aria-label="Billing period"
            className="mt-9 inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] p-1 backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              aria-pressed={billingPeriod === 'monthly'}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-[#07070a]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('annual')}
              aria-pressed={billingPeriod === 'annual'}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all ${
                billingPeriod === 'annual'
                  ? 'bg-white text-[#07070a]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Annual
              <span className="rounded-full bg-[#2dd4bf]/15 px-2 py-0.5 text-[11px] font-semibold text-[#5eead4]">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Tiers */}
        <MotionSection as="div" className="mt-14">
          <div className="stagger grid grid-cols-1 gap-6 md:grid-cols-3">
            {tiers.map((tier) => {
              const isPrimary = tier.popular || tier.custom;
              return (
                <div
                  key={tier.id}
                  className={`edge-glow relative flex flex-col rounded-3xl border bg-white/[0.03] p-7 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1.5 ${
                    tier.popular ? 'border-[#2dd4bf]/40' : 'border-white/10'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-gradient-to-r from-[#2dd4bf] to-[#5eead4] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#07070a]">
                        Most popular
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-transparent text-[#5eead4]">
                      {tier.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-white">
                        {tier.name}
                      </h3>
                      {tier.comingSoon && (
                        <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                          Coming soon
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-4 min-h-[2.75rem] text-sm leading-relaxed text-white/55">
                    {tier.description}
                  </p>

                  {/* Price */}
                  <div className="mt-5">
                    {tier.custom ? (
                      <div className="font-display text-4xl font-medium tracking-tight">Custom</div>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-5xl font-medium tracking-tight">
                          $
                          {billingPeriod === 'monthly'
                            ? tier.price.monthly
                            : Math.floor(tier.price.annual / 12)}
                        </span>
                        {tier.price.monthly > 0 && <span className="text-white/45">/mo</span>}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-white/40">
                      {tier.custom
                        ? 'Tailored to your team — let’s find the right fit.'
                        : billingPeriod === 'annual' && tier.price.annual > 0
                          ? `$${tier.price.annual} billed annually`
                          : tier.price.monthly === 0
                            ? 'No credit card required'
                            : 'Billed monthly'}
                    </p>
                  </div>

                  {/* CTA */}
                  <Link
                    href={tier.ctaLink}
                    className={`mt-6 block rounded-xl px-6 py-3 text-center text-sm font-semibold transition-all ${
                      isPrimary
                        ? 'btn-primary'
                        : 'border border-white/15 bg-white/[0.03] text-white hover:-translate-y-0.5 hover:bg-white/[0.07]'
                    }`}
                  >
                    {tier.cta}
                  </Link>

                  {/* Features */}
                  <ul className="mt-7 space-y-3">
                    {tier.features.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        {f.included ? (
                          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#2dd4bf]/15 text-[#5eead4]">
                            <CheckIcon className="h-2.5 w-2.5" />
                          </span>
                        ) : (
                          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center text-white/25">
                            <XIcon className="h-3 w-3" />
                          </span>
                        )}
                        <span className={f.included ? 'text-white/75' : 'text-white/30'}>
                          {f.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </MotionSection>

        {/* Credit packs */}
        <MotionSection as="div" className="mt-10">
          <div className="edge-glow rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
            <div className="text-center">
              <h2 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
                One-time credit packs
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Need more? Buy credits that never expire — purchased from your dashboard once you’re
                in.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
              {(
                [
                  ['Chat query packs', creditPacks.chat, 'queries'],
                  ['Scenario run packs', creditPacks.scenario, 'scenarios'],
                ] as const
              ).map(([label, packs, unit]) => (
                <div key={label}>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#5eead4]">
                    {label}
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {packs.map((pack) => (
                      <Link
                        key={pack.priceId}
                        href="/auth?mode=create"
                        className={`group relative rounded-2xl border p-4 text-center transition-all hover:-translate-y-1 ${
                          pack.popular
                            ? 'border-[#2dd4bf]/40 bg-[#2dd4bf]/[0.06]'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                        }`}
                      >
                        {pack.popular && (
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#5eead4]">
                            Popular
                          </div>
                        )}
                        <div className="font-display text-2xl font-medium tracking-tight">
                          {pack.credits}
                        </div>
                        <div className="text-[11px] text-white/45">{unit}</div>
                        <div className="mt-2 text-lg font-semibold">${pack.price}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </MotionSection>

        {/* Enterprise / contact */}
        <div className="mt-10 text-center text-white/55">
          Need a plan for a team, or have questions about Enterprise?{' '}
          <Link
            href="/waitlist?tier=enterprise"
            className="font-medium text-[#5eead4] hover:underline"
          >
            Talk to our team →
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
