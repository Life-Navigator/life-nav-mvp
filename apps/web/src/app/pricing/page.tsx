'use client';

import React, { useState } from 'react';
import { Check, X, Sparkles, Rocket, Building2, MessageCircle, Zap } from 'lucide-react';
import Link from 'next/link';

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const tiers = [
    {
      id: 'freemium',
      name: 'Freemium',
      description: 'Get started with Life Navigator basics',
      price: { monthly: 0, annual: 0 },
      icon: Sparkles,
      color: 'blue',
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
      icon: Rocket,
      color: 'purple',
      available: false, // Coming Soon
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
      icon: Building2,
      color: 'green',
      available: false, // Coming Soon
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

  const creditPacks = {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Start free, upgrade when you're ready. All plans include unlimited onboarding queries.
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 p-1 bg-white dark:bg-gray-800 rounded-full shadow-md">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                billingPeriod === 'annual'
                  ? 'bg-blue-600 text-white'
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
          {tiers.map((tier) => {
            const Icon = tier.icon;
            return (
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
                    <div className={`p-3 rounded-xl bg-${tier.color}-100 dark:bg-${tier.color}-900/30`}>
                      <Icon className={`w-6 h-6 text-${tier.color}-600`} />
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
                        ${billingPeriod === 'monthly' ? tier.price.monthly : Math.floor(tier.price.annual / 12)}
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
                        ? `bg-gradient-to-r from-${tier.color}-600 to-${tier.color}-700 hover:from-${tier.color}-700 hover:to-${tier.color}-800 text-white shadow-lg hover:shadow-xl`
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
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
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
            );
          })}
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
                <MessageCircle className="w-6 h-6 text-blue-600" />
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
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {pack.popular && (
                      <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">
                        POPULAR
                      </div>
                    )}
                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                      {pack.credits}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      queries
                    </div>
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
                <Zap className="w-6 h-6 text-purple-600" />
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
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      scenarios
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${pack.price}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
            Credits are available for purchase from your dashboard once you've signed up.
          </p>
        </div>

        {/* FAQ */}
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Have questions?{' '}
            <Link href="/contact" className="text-blue-600 hover:text-blue-700 font-medium">
              Contact us
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
