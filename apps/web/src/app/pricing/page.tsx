'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';

/* ── Inline SVG Icons ── */

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
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
      width="20"
      height="20"
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
      width="24"
      height="24"
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
      width="24"
      height="24"
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
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
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
  colorClasses: {
    iconBg: string;
    iconText: string;
    ctaAvailable: string;
  };
  available: boolean;
  popular?: boolean;
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

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const tiers: Tier[] = [
    {
      id: 'freemium',
      name: 'Freemium',
      description: 'Get started with Life Navigator basics',
      price: { monthly: 0, annual: 0 },
      icon: <SparklesIcon />,
      colorClasses: {
        iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
        iconText: 'text-cyan-600',
        ctaAvailable: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg hover:shadow-xl',
      },
      available: true,
      features: [
        { name: '5 chat queries per day', included: true },
        { name: '5 scenario lab runs per day', included: true },
        { name: 'Unlimited onboarding queries', included: true },
        { name: 'Financial overview & insights', included: true },
        { name: 'Insurance information upload', included: true },
        { name: 'Basic goal tracking', included: true },
        { name: 'Purchase additional credits anytime', included: true },
        { name: 'Career module access', included: false },
        { name: 'Advanced health analytics', included: false },
        { name: 'Education planning tools', included: false },
        { name: 'Priority support', included: false },
      ],
      cta: 'Get Started Free',
      ctaLink: '/auth/register',
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Unlock full potential with unlimited access',
      price: { monthly: 25, annual: 250 },
      icon: <RocketIcon />,
      colorClasses: {
        iconBg: 'bg-purple-100 dark:bg-purple-900/30',
        iconText: 'text-purple-600',
        ctaAvailable: 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl',
      },
      available: false,
      popular: true,
      features: [
        { name: '200 chat queries per month', included: true },
        { name: 'Unlimited scenario lab runs', included: true },
        { name: 'Full career module access', included: true },
        { name: 'Resume builder & job matching', included: true },
        { name: 'Advanced health analytics', included: true },
        { name: 'Wearable device integrations', included: true },
        { name: 'Education planning & ROI analysis', included: true },
        { name: 'Tax optimization strategies', included: true },
        { name: 'Priority email support', included: true },
        { name: 'White-label branding', included: false },
        { name: 'Multi-user access', included: false },
        { name: 'Dedicated account manager', included: false },
      ],
      cta: 'Join Waitlist',
      ctaLink: '/waitlist?tier=pro',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for teams and advisors',
      price: { monthly: 99, annual: 990 },
      icon: <BuildingIcon />,
      colorClasses: {
        iconBg: 'bg-green-100 dark:bg-green-900/30',
        iconText: 'text-green-600',
        ctaAvailable: 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl',
      },
      available: false,
      features: [
        { name: 'Unlimited everything', included: true },
        { name: 'White-label branding', included: true },
        { name: 'Custom domain', included: true },
        { name: 'Multi-user access (up to 50)', included: true },
        { name: 'SSO & advanced security', included: true },
        { name: 'Dedicated account manager', included: true },
        { name: 'Custom integrations', included: true },
        { name: 'API access', included: true },
        { name: 'Priority phone support', included: true },
        { name: 'Onboarding & training', included: true },
        { name: 'Custom SLA', included: true },
      ],
      cta: 'Join Waitlist',
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
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-sky-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Start free, upgrade when you&apos;re ready. All plans include unlimited onboarding
            queries.
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 p-1 bg-white dark:bg-gray-800 rounded-full shadow-md">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                billingPeriod === 'annual'
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Annual
              <span className="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden ${
                tier.popular ? 'ring-4 ring-purple-600' : ''
              }`}
            >
              {/* Coming Soon Badge */}
              {!tier.available && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full shadow-lg">
                    COMING SOON
                  </span>
                </div>
              )}

              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <span className="px-4 py-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs font-bold rounded-full shadow-lg">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className={`p-8 ${!tier.available ? 'opacity-75' : ''}`}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-3 rounded-xl ${tier.colorClasses.iconBg}`}>
                    <div className={tier.colorClasses.iconText}>{tier.icon}</div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {tier.name}
                    </h3>
                  </div>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-6 min-h-[3rem]">
                  {tier.description}
                </p>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-gray-900 dark:text-white">
                      $
                      {billingPeriod === 'monthly'
                        ? tier.price.monthly
                        : Math.floor(tier.price.annual / 12)}
                    </span>
                    {tier.price.monthly > 0 && (
                      <span className="text-gray-600 dark:text-gray-400">/month</span>
                    )}
                  </div>
                  {billingPeriod === 'annual' && tier.price.annual > 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      ${tier.price.annual} billed annually
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <Link
                  href={tier.ctaLink}
                  className={`block w-full py-3 px-6 rounded-xl font-semibold text-center transition-all mb-6 ${
                    tier.available
                      ? tier.colorClasses.ctaAvailable
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {tier.cta}
                </Link>

                {/* Features */}
                <ul className="space-y-3">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      {feature.included ? (
                        <CheckIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-sm ${
                          feature.included
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* One-Time Credit Packs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              One-Time Credit Packs
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Need more queries? Purchase credits that never expire.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chat Query Packs */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="text-cyan-600">
                  <MessageIcon />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Chat Query Packs
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {creditPacks.chat.map((pack) => (
                  <div
                    key={pack.priceId}
                    className={`p-4 border-2 rounded-xl text-center ${
                      pack.popular
                        ? 'border-cyan-600 bg-cyan-50 dark:bg-cyan-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {pack.popular && (
                      <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-2">
                        POPULAR
                      </div>
                    )}
                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                      {pack.credits}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">queries</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${pack.price}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scenario Run Packs */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="text-purple-600">
                  <ZapIcon />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Scenario Run Packs
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {creditPacks.scenario.map((pack) => (
                  <div
                    key={pack.priceId}
                    className={`p-4 border-2 rounded-xl text-center ${
                      pack.popular
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {pack.popular && (
                      <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-2">
                        POPULAR
                      </div>
                    )}
                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                      {pack.credits}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">scenarios</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${pack.price}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
            Credits are available for purchase from your dashboard once you&apos;ve signed up.
          </p>
        </div>

        {/* FAQ */}
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Have questions?{' '}
            <Link href="/contact" className="text-cyan-600 hover:text-cyan-700 font-medium">
              Contact us
            </Link>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
