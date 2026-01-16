'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Rocket, Building2, Loader2 } from 'lucide-react';

function WaitlistContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tier = searchParams.get('tier') || 'pro';

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tierInfo = {
    pro: {
      name: 'Pro',
      icon: Rocket,
      color: 'purple',
      description: 'Unlock full potential with 200 queries/month and unlimited scenario runs',
      features: [
        'Full career module access',
        'Advanced health analytics',
        'Education planning & ROI analysis',
        'Tax optimization strategies',
        'Priority email support',
      ],
    },
    enterprise: {
      name: 'Enterprise',
      icon: Building2,
      color: 'green',
      description: 'Custom solutions for teams and financial advisors',
      features: [
        'White-label branding',
        'Multi-user access (up to 50)',
        'Dedicated account manager',
        'Custom integrations',
        'Priority phone support',
        'Custom SLA',
      ],
    },
  };

  const currentTier = tierInfo[tier as keyof typeof tierInfo] || tierInfo.pro;
  const Icon = currentTier.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          company,
          tier,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to join waitlist');
      }

      setSuccess(true);

      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    } catch (err: any) {
      console.error('Waitlist error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              You're on the list!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              We'll notify you as soon as {currentTier.name} tier launches.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              In the meantime, start exploring Life Navigator with your{' '}
              <span className="font-semibold">5 free daily queries</span> and{' '}
              <span className="font-semibold">5 free scenario runs</span>!
            </p>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Left Panel - Info */}
        <div className={`bg-gradient-to-br from-${currentTier.color}-600 to-${currentTier.color}-700 p-8 text-white`}>
          <div className="mb-6">
            <Icon className="w-12 h-12 mb-4" />
            <h1 className="text-4xl font-bold mb-2">
              Join the {currentTier.name} Waitlist
            </h1>
            <p className="text-white/90">
              {currentTier.description}
            </p>
          </div>

          <div className="space-y-3 mb-8">
            {currentTier.features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="text-white/90">{feature}</span>
              </div>
            ))}
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <p className="text-sm text-white/90">
              <span className="font-semibold">Early access benefit:</span> Get priority
              onboarding and exclusive launch pricing when {currentTier.name} goes live!
            </p>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Reserve Your Spot
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Full Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="john@example.com"
              />
            </div>

            {tier === 'enterprise' && (
              <div>
                <label
                  htmlFor="company"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Company Name
                </label>
                <input
                  type="text"
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Acme Financial Advisors"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                loading
                  ? 'bg-gray-400 cursor-wait'
                  : `bg-gradient-to-r from-${currentTier.color}-600 to-${currentTier.color}-700 hover:from-${currentTier.color}-700 hover:to-${currentTier.color}-800 shadow-lg hover:shadow-xl`
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Joining...
                </span>
              ) : (
                'Join Waitlist'
              )}
            </button>

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              By joining, you'll receive email updates about {currentTier.name} tier launch.
              No spam, unsubscribe anytime.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function WaitlistPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <WaitlistContent />
    </Suspense>
  );
}
