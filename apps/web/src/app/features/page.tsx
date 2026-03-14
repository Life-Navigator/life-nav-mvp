import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';

export const metadata = {
  title: 'Features - Life Navigator',
  description:
    'Explore all features of Life Navigator — AI-powered goal tracking, financial intelligence, career navigation, and more.',
};

const features = [
  {
    category: 'AI Intelligence',
    icon: (
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
        <path d="M12 2a8 8 0 0 0-8 8c0 3.36 2.07 6.24 5 7.42V22h6v-4.58c2.93-1.18 5-4.06 5-7.42a8 8 0 0 0-8-8z" />
        <path d="M10 17h4" />
      </svg>
    ),
    items: [
      {
        title: 'GraphRAG Personal Advisor',
        description:
          'Your AI advisor builds a personal knowledge graph from your goals, finances, and career data. Ask anything and get advice grounded in your actual situation — not generic tips.',
      },
      {
        title: 'Risk-Aware Recommendations',
        description:
          'During onboarding, we assess your risk tolerance. Every piece of financial and career advice is calibrated to your comfort level.',
      },
      {
        title: 'Conversational Interface',
        description:
          'Chat naturally with your AI advisor. It remembers your context, tracks your goals, and proactively suggests next steps.',
      },
    ],
  },
  {
    category: 'Goal Management',
    icon: (
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
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    items: [
      {
        title: 'SMART Goal Framework',
        description:
          'Create goals with specific targets, deadlines, and milestones. Track progress with visual indicators and AI-suggested adjustments.',
      },
      {
        title: 'Cross-Domain Connections',
        description:
          'See how your career goals connect to financial targets, how education impacts career trajectory, and more.',
      },
      {
        title: 'Goal Dependencies',
        description:
          'Map out goal prerequisites. Complete a certification before applying for a promotion. Save enough before investing.',
      },
    ],
  },
  {
    category: 'Financial Tools',
    icon: (
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
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M16 14h.01" />
        <path d="M2 10h20" />
      </svg>
    ),
    items: [
      {
        title: 'Account Tracking',
        description:
          'Monitor bank accounts, investments, and loans in one place. See your complete financial picture at a glance.',
      },
      {
        title: 'Document Ingestion',
        description:
          'Upload bank statements, tax documents, and financial reports. AI automatically extracts and categorizes transactions.',
      },
      {
        title: 'Financial Calculators',
        description:
          'Loan amortization, mortgage comparison, retirement planning, and debt payoff calculators — all connected to your goals.',
      },
    ],
  },
  {
    category: 'Integrations',
    icon: (
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
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    items: [
      {
        title: 'Gmail & Outlook',
        description:
          'Connect your email for full context. Your AI advisor understands your communications and schedule.',
      },
      {
        title: 'Google & Outlook Calendar',
        description:
          'Sync your calendar events. Create, update, and manage events directly from Life Navigator.',
      },
      {
        title: 'Plaid Financial Connect',
        description:
          'Securely link bank accounts via Plaid for real-time balance and transaction data.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">Features</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Everything you need to manage your goals, finances, career, and education &mdash; powered
          by AI that actually knows you.
        </p>
      </section>

      {/* Feature Sections */}
      {features.map((section) => (
        <section
          key={section.category}
          className="py-16 px-4 sm:px-6 lg:px-8 border-t border-gray-100 dark:border-gray-900"
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
                {section.icon}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {section.category}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {section.items.map((feature) => (
                <div
                  key={feature.title}
                  className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 text-center bg-cyan-600 dark:bg-cyan-700">
        <h2 className="text-3xl font-bold text-white">Start navigating your life today</h2>
        <p className="mt-4 text-cyan-100 text-lg">Free to start. No credit card required.</p>
        <Link
          href="/auth/register"
          className="mt-8 inline-flex px-8 py-3.5 rounded-xl bg-white text-cyan-600 font-medium hover:bg-gray-100 transition-all"
        >
          Get Started Free
        </Link>
      </section>

      <Footer />
    </div>
  );
}
