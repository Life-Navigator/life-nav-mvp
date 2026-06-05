'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Rocket, Building2, Loader2, CalendarClock, Mail } from 'lucide-react';

// Configurable contact points (fall back to brand defaults when env is unset).
const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL || 'enterprise@lifenavigator.tech';
const SCHEDULE_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || '';

// Explicit accent gradients (avoids Tailwind's inability to generate
// dynamically-interpolated `from-${color}` classes).
const ACCENT: Record<string, { from: string; to: string }> = {
  pro: { from: '#7c3aed', to: '#6d28d9' },
  enterprise: { from: '#059669', to: '#047857' },
};

function WaitlistContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tier = searchParams.get('tier') || 'pro';
  const isEnterprise = tier === 'enterprise';

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [message, setMessage] = useState('');
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
      description:
        'Custom solutions for teams and financial advisors. Pricing varies with your team and needs — let’s set up a quick call to scope the right plan.',
      features: [
        'White-label branding',
        'Multi-user access (up to 50+)',
        'Dedicated account manager',
        'Custom integrations & SSO',
        'Priority phone support',
        'Custom SLA & onboarding',
      ],
    },
  };

  const currentTier = tierInfo[tier as keyof typeof tierInfo] || tierInfo.pro;
  const Icon = currentTier.icon;
  const accent = ACCENT[tier] || ACCENT.pro;
  const gradient = { backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})` };

  const interestSummary = isEnterprise
    ? [
        'Enterprise consultation request',
        `Company: ${company || '—'}`,
        `Team size: ${teamSize || '—'}`,
        `Phone: ${phone || '—'}`,
        `Preferred time: ${preferredTime || '—'}`,
        `Message: ${message || '—'}`,
      ].join('\n')
    : `${currentTier.name} tier waitlist`;

  const mailtoHref = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(
    `Enterprise consultation — ${company || name || 'LifeNavigator'}`
  )}&body=${encodeURIComponent(interestSummary)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, company, tier, interest: interestSummary }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit');
      }

      setSuccess(true);

      // Self-serve tiers go straight to the product; Enterprise stays on the
      // confirmation so they can book a time / reach the team.
      if (!isEnterprise) {
        setTimeout(() => router.push('/dashboard'), 3000);
      }
    } catch (err: any) {
      console.error('Waitlist error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Success ── */
  if (success) {
    if (isEnterprise) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Thanks{name ? `, ${name.split(' ')[0]}` : ''} — let&apos;s find a time
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your details are in. Pick a slot below and we&apos;ll walk you through Enterprise and
              tailor pricing to your team.
            </p>

            <div className="space-y-3">
              {SCHEDULE_URL && (
                <a
                  href={SCHEDULE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 px-6 font-semibold text-white shadow-lg transition-all hover:shadow-xl"
                  style={gradient}
                >
                  <CalendarClock className="w-5 h-5" />
                  Book your consultation
                </a>
              )}
              <a
                href={mailtoHref}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 px-6 font-semibold transition-all ${
                  SCHEDULE_URL
                    ? 'border-2 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    : 'text-white shadow-lg hover:shadow-xl'
                }`}
                style={SCHEDULE_URL ? undefined : gradient}
              >
                <Mail className="w-5 h-5" />
                Email the team directly
              </a>
            </div>

            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              We&apos;ll also reach out at <span className="font-medium">{email}</span>
              {preferredTime ? (
                <>
                  {' '}
                  around <span className="font-medium">{preferredTime}</span>
                </>
              ) : null}
              .
            </p>
            <p className="mt-4 text-sm">
              <Link
                href="/"
                className="text-green-700 dark:text-green-400 font-medium hover:underline"
              >
                ← Back to home
              </Link>
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              You&apos;re on the list!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              We&apos;ll notify you as soon as {currentTier.name} tier launches.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              In the meantime, start exploring Life Navigator with your{' '}
              <span className="font-semibold">5 free daily queries</span> and{' '}
              <span className="font-semibold">5 free scenario runs</span>!
            </p>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Left Panel - Info */}
        <div className="p-8 text-white" style={gradient}>
          <div className="mb-6">
            <Icon className="w-12 h-12 mb-4" />
            <h1 className="text-4xl font-bold mb-2">
              {isEnterprise ? 'Let’s talk Enterprise' : `Join the ${currentTier.name} Waitlist`}
            </h1>
            <p className="text-white/90">{currentTier.description}</p>
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
              {isEnterprise ? (
                <>
                  <span className="font-semibold">No commitment:</span> share a few details and book
                  a 30-minute call. We&apos;ll scope the right plan and pricing together.
                </>
              ) : (
                <>
                  <span className="font-semibold">Early access benefit:</span> Get priority
                  onboarding and exclusive launch pricing when {currentTier.name} goes live!
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {isEnterprise ? 'Request a Consultation' : 'Reserve Your Spot'}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {isEnterprise ? 'Work Email *' : 'Email Address *'}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="jane@company.com"
              />
            </div>

            {isEnterprise && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="company"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Company
                    </label>
                    <input
                      type="text"
                      id="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Acme Advisors"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="teamSize"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Team size
                    </label>
                    <input
                      type="text"
                      id="teamSize"
                      value={teamSize}
                      onChange={(e) => setTeamSize(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g. 25"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="preferredTime"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Best times to reach you
                    </label>
                    <input
                      type="text"
                      id="preferredTime"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g. Weekdays 1–4pm ET"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    What would you like to discuss?
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Team size, use case, timeline, integrations…"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl ${
                loading ? 'cursor-wait opacity-70' : ''
              }`}
              style={gradient}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </span>
              ) : isEnterprise ? (
                'Submit & Pick a Time'
              ) : (
                'Join Waitlist'
              )}
            </button>

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              {isEnterprise ? (
                <>
                  We&apos;ll review your details and help you book a 30-minute call. Prefer email?{' '}
                  <a
                    href={mailtoHref}
                    className="font-medium text-green-700 dark:text-green-400 hover:underline"
                  >
                    {SALES_EMAIL}
                  </a>
                </>
              ) : (
                <>
                  By joining, you&apos;ll receive email updates about {currentTier.name} tier
                  launch. No spam, unsubscribe anytime.
                </>
              )}
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
