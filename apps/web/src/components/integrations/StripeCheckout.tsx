'use client';

/**
 * Stripe Checkout Component
 *
 * Handles subscription checkout and customer portal access.
 */

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  priceId: string;
  popular?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Essential features for getting started',
    price: 9.99,
    interval: 'month',
    features: [
      'Financial tracking',
      'Goal setting',
      'Basic health metrics',
      'Email support',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC || '',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Advanced features for power users',
    price: 19.99,
    interval: 'month',
    features: [
      'Everything in Basic',
      'Google integrations',
      'Advanced analytics',
      'Health Connect sync',
      'Priority support',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || '',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Full access for teams and businesses',
    price: 49.99,
    interval: 'month',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Custom integrations',
      'API access',
      'Dedicated support',
      'HIPAA compliance',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE || '',
  },
];

interface StripeCheckoutProps {
  currentPlan?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function StripeCheckout({
  currentPlan,
  onSuccess,
  onError,
}: StripeCheckoutProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string, planId: string) => {
    if (!priceId) {
      onError?.('Price not configured');
      return;
    }

    setLoading(planId);

    try {
      const response = await fetch('/api/integrations/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}/settings/billing?success=true`,
          cancelUrl: `${window.location.origin}/settings/billing?canceled=true`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create checkout session');
      }

      const { sessionId, checkoutUrl } = await response.json();

      // Redirect to Stripe Checkout
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        const stripe = await stripePromise;
        if (stripe && sessionId) {
          const { error } = await stripe.redirectToCheckout({ sessionId });
          if (error) {
            throw new Error(error.message);
          }
        }
      }
    } catch (err) {
      console.error('Checkout error:', err);
      onError?.((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading('portal');

    try {
      const response = await fetch('/api/integrations/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create portal session');
      }

      const { portalUrl } = await response.json();
      window.location.href = portalUrl;
    } catch (err) {
      console.error('Portal error:', err);
      onError?.((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Current Plan Banner */}
      {currentPlan && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Current Plan
            </p>
            <p className="font-semibold text-blue-900 dark:text-blue-100 capitalize">
              {currentPlan}
            </p>
          </div>
          <button
            onClick={handleManageSubscription}
            disabled={loading === 'portal'}
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading === 'portal' ? 'Loading...' : 'Manage Subscription'}
          </button>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border-2 p-6 ${
              plan.popular
                ? 'border-blue-500 dark:border-blue-400'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {plan.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {plan.description}
              </p>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  ${plan.price}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  /{plan.interval}
                </span>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center text-sm">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-300">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout(plan.priceId, plan.id)}
              disabled={loading === plan.id || currentPlan === plan.id}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
                plan.popular
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              {loading === plan.id
                ? 'Loading...'
                : currentPlan === plan.id
                  ? 'Current Plan'
                  : 'Get Started'}
            </button>
          </div>
        ))}
      </div>

      {/* Money-back guarantee */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        <p>30-day money-back guarantee. Cancel anytime.</p>
      </div>
    </div>
  );
}

export default StripeCheckout;
