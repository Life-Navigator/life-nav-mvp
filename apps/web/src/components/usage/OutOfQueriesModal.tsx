'use client';

import React, { useState } from 'react';
import { X, MessageCircle, Zap, CreditCard, Clock } from 'lucide-react';

interface OutOfQueriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryType: 'chat' | 'scenario';
}

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  savings?: string;
  priceId: string; // Stripe Price ID
}

const CHAT_PACKS: CreditPack[] = [
  {
    id: 'chat_small',
    name: 'Starter',
    credits: 10,
    price: 2,
    priceId: 'price_chat_10', // Replace with actual Stripe Price ID
  },
  {
    id: 'chat_medium',
    name: 'Popular',
    credits: 30,
    price: 5,
    savings: 'Save 17%',
    priceId: 'price_chat_30',
  },
  {
    id: 'chat_large',
    name: 'Best Value',
    credits: 60,
    price: 9,
    savings: 'Save 25%',
    priceId: 'price_chat_60',
  },
];

const SCENARIO_PACKS: CreditPack[] = [
  {
    id: 'scenario_small',
    name: 'Starter',
    credits: 10,
    price: 3,
    priceId: 'price_scenario_10', // Replace with actual Stripe Price ID
  },
  {
    id: 'scenario_medium',
    name: 'Popular',
    credits: 30,
    price: 7,
    savings: 'Save 22%',
    priceId: 'price_scenario_30',
  },
  {
    id: 'scenario_large',
    name: 'Best Value',
    credits: 60,
    price: 12,
    savings: 'Save 33%',
    priceId: 'price_scenario_60',
  },
];

export function OutOfQueriesModal({
  isOpen,
  onClose,
  queryType,
}: OutOfQueriesModalProps) {
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  if (!isOpen) return null;

  const packs = queryType === 'chat' ? CHAT_PACKS : SCENARIO_PACKS;
  const icon = queryType === 'chat' ? MessageCircle : Zap;
  const Icon = icon;
  const title =
    queryType === 'chat' ? 'Chat Queries' : 'Scenario Lab Runs';
  const color = queryType === 'chat' ? 'blue' : 'purple';

  const handlePurchase = async (pack: CreditPack) => {
    try {
      setPurchasing(true);
      setSelectedPack(pack.id);

      // Create Stripe checkout session
      const response = await fetch('/api/integrations/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: pack.priceId,
          mode: 'payment', // One-time payment
          productType: queryType === 'chat' ? 'chat_queries' : 'scenario_runs',
          quantity: pack.credits,
          successUrl: `${window.location.origin}/dashboard?purchase=success&type=${queryType}`,
          cancelUrl: `${window.location.origin}/dashboard?purchase=canceled`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { checkoutUrl } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Failed to start purchase process. Please try again.');
    } finally {
      setPurchasing(false);
      setSelectedPack(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${color === 'blue' ? 'from-blue-600 to-blue-700' : 'from-purple-600 to-purple-700'} p-6 text-white`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <Icon className="w-8 h-8" />
            <h2 className="text-2xl font-bold">Out of {title}</h2>
          </div>
          <p className="text-white/90">
            You've used your daily free {queryType === 'chat' ? 'queries' : 'scenario runs'}.
            Purchase a credit pack to continue!
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Info Banner */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <p className="font-medium mb-1">Your free daily limit resets at midnight UTC</p>
              <p className="text-gray-600 dark:text-gray-400">
                Credits you purchase never expire and can be used anytime!
              </p>
            </div>
          </div>

          {/* Credit Packs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className={`relative p-5 border-2 rounded-xl cursor-pointer transition-all ${
                  selectedPack === pack.id
                    ? `border-${color}-600 bg-${color}-50 dark:bg-${color}-900/20`
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => setSelectedPack(pack.id)}
              >
                {pack.savings && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r ${
                    color === 'blue' ? 'from-blue-600 to-blue-700' : 'from-purple-600 to-purple-700'
                  } text-white shadow-lg`}>
                    {pack.savings}
                  </div>
                )}

                <div className="text-center">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    {pack.name}
                  </div>
                  <div className="mb-3">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {pack.credits}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 ml-1">credits</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    ${pack.price}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ${(pack.price / pack.credits).toFixed(2)} per credit
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePurchase(pack);
                  }}
                  disabled={purchasing}
                  className={`w-full mt-4 py-2 px-4 rounded-lg font-medium transition-all ${
                    purchasing && selectedPack === pack.id
                      ? 'bg-gray-300 dark:bg-gray-700 cursor-wait'
                      : `bg-gradient-to-r ${
                          color === 'blue'
                            ? 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                            : 'from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'
                        } text-white`
                  }`}
                >
                  {purchasing && selectedPack === pack.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <CreditCard className="w-4 h-4 animate-pulse" />
                      Processing...
                    </span>
                  ) : (
                    'Purchase'
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>
              Secure checkout powered by{' '}
              <span className="font-semibold">Stripe</span>
            </p>
            <button
              onClick={onClose}
              className="mt-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
