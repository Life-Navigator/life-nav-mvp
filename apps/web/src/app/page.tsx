import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
            Life Navigator
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/features" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/security" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Security
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            AI-Powered Personal Advisory
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            Navigate your life
            <br />
            <span className="text-indigo-600 dark:text-indigo-400">with confidence</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Your AI-powered personal advisor for goals, finances, career, and
            education. Get personalized advice grounded in your actual data —
            not generic tips.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 text-center"
            >
              Start Free
            </Link>
            <Link
              href="/features"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-all text-center"
            >
              See How It Works
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            No credit card required. GDPR compliant. Bank-grade encryption.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              Everything you need to thrive
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              One platform that connects all areas of your life — powered by AI
              that actually knows you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon="🎯"
              title="Smart Goal Tracking"
              description="Set goals with AI-suggested milestones. Track progress across career, finances, education, and personal development."
            />
            <FeatureCard
              icon="💡"
              title="AI Personal Advisor"
              description="Ask anything about your life trajectory. Get advice grounded in YOUR data — your goals, risk tolerance, and real progress."
            />
            <FeatureCard
              icon="💰"
              title="Financial Intelligence"
              description="Track accounts, analyze spending, monitor investments. AI connects your financial picture to your life goals."
            />
            <FeatureCard
              icon="📈"
              title="Career Navigation"
              description="Track job applications, grow your skills, build your network. AI identifies opportunities aligned with your goals."
            />
            <FeatureCard
              icon="📧"
              title="Email & Calendar"
              description="Connect Gmail and Outlook. Your AI advisor sees your schedule and communications for better context."
            />
            <FeatureCard
              icon="🛡️"
              title="Bank-Grade Security"
              description="AES-256 encryption, row-level security, GDPR compliance. Your data is yours — always encrypted, never shared."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              Up and running in minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              step="1"
              title="Set Your Goals"
              description="Complete a quick onboarding to define your goals and risk tolerance. The AI builds your personal knowledge graph."
            />
            <StepCard
              step="2"
              title="Connect Your Data"
              description="Optionally link your email, calendar, and financial accounts. More context means better advice."
            />
            <StepCard
              step="3"
              title="Get Personalized Advice"
              description="Ask your AI advisor anything. It combines all your data to give specific, actionable recommendations."
            />
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Built for people who take their future seriously
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-12">
            Whether you&apos;re a career professional, student, veteran, or
            entrepreneur — Life Navigator adapts to your unique situation.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <StatCard value="5+" label="Life Domains" />
            <StatCard value="AES-256" label="Encryption" />
            <StatCard value="GDPR" label="Compliant" />
            <StatCard value="24/7" label="AI Advisor" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Ready to take control?
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Join Life Navigator today and start getting AI-powered advice
            tailored to your actual life.
          </p>
          <div className="mt-8">
            <Link
              href="/auth/register"
              className="inline-flex px-8 py-3.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-500">
            &copy; {new Date().getFullYear()} Life Navigator. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-500">
            <Link href="/security" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              Privacy & Security
            </Link>
            <Link href="/pricing" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xl flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
        {value}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {label}
      </div>
    </div>
  );
}
