import Link from 'next/link';

export const metadata = {
  title: 'Features - Life Navigator',
  description: 'Explore all features of Life Navigator — AI-powered goal tracking, financial intelligence, career navigation, and more.',
};

const features = [
  {
    category: 'AI Intelligence',
    items: [
      {
        title: 'GraphRAG Personal Advisor',
        description:
          'Your AI advisor builds a personal knowledge graph from your goals, finances, and career data. Ask anything and get advice grounded in your actual situation — not generic tips.',
        icon: '🧠',
      },
      {
        title: 'Risk-Aware Recommendations',
        description:
          'During onboarding, we assess your risk tolerance. Every piece of financial and career advice is calibrated to your comfort level.',
        icon: '📊',
      },
      {
        title: 'Conversational Interface',
        description:
          'Chat naturally with your AI advisor. It remembers your context, tracks your goals, and proactively suggests next steps.',
        icon: '💬',
      },
    ],
  },
  {
    category: 'Goal Management',
    items: [
      {
        title: 'SMART Goal Framework',
        description:
          'Create goals with specific targets, deadlines, and milestones. Track progress with visual indicators and AI-suggested adjustments.',
        icon: '🎯',
      },
      {
        title: 'Cross-Domain Connections',
        description:
          'See how your career goals connect to financial targets, how education impacts career trajectory, and more.',
        icon: '🔗',
      },
      {
        title: 'Goal Dependencies',
        description:
          'Map out goal prerequisites. Complete a certification before applying for a promotion. Save enough before investing.',
        icon: '🗺️',
      },
    ],
  },
  {
    category: 'Financial Tools',
    items: [
      {
        title: 'Account Tracking',
        description:
          'Monitor bank accounts, investments, and loans in one place. See your complete financial picture at a glance.',
        icon: '💰',
      },
      {
        title: 'Document Ingestion',
        description:
          'Upload bank statements, tax documents, and financial reports. AI automatically extracts and categorizes transactions.',
        icon: '📄',
      },
      {
        title: 'Financial Calculators',
        description:
          'Loan amortization, mortgage comparison, retirement planning, and debt payoff calculators — all connected to your goals.',
        icon: '🧮',
      },
    ],
  },
  {
    category: 'Integrations',
    items: [
      {
        title: 'Gmail & Outlook',
        description:
          'Connect your email for full context. Your AI advisor understands your communications and schedule.',
        icon: '📧',
      },
      {
        title: 'Google & Outlook Calendar',
        description:
          'Sync your calendar events. Create, update, and manage events directly from Life Navigator.',
        icon: '📅',
      },
      {
        title: 'Plaid Financial Connect',
        description:
          'Securely link bank accounts via Plaid for real-time balance and transaction data.',
        icon: '🏦',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
            Life Navigator
          </Link>
          <Link
            href="/auth/register"
            className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
          Features
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Everything you need to manage your goals, finances, career, and
          education — powered by AI that actually knows you.
        </p>
      </section>

      {/* Feature Sections */}
      {features.map((section) => (
        <section
          key={section.category}
          className="py-16 px-4 sm:px-6 lg:px-8 border-t border-gray-100 dark:border-gray-900"
        >
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
              {section.category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {section.items.map((feature) => (
                <div
                  key={feature.title}
                  className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow"
                >
                  <div className="text-3xl mb-4">{feature.icon}</div>
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 text-center bg-indigo-600 dark:bg-indigo-700">
        <h2 className="text-3xl font-bold text-white">Start navigating your life today</h2>
        <p className="mt-4 text-indigo-100 text-lg">Free to start. No credit card required.</p>
        <Link
          href="/auth/register"
          className="mt-8 inline-flex px-8 py-3.5 rounded-xl bg-white text-indigo-600 font-medium hover:bg-gray-100 transition-all"
        >
          Get Started Free
        </Link>
      </section>
    </div>
  );
}
