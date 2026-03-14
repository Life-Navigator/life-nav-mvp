import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-white to-sky-50 dark:from-gray-950 dark:via-gray-950 dark:to-cyan-950/20" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 text-sm mb-6 border border-cyan-200/50 dark:border-cyan-800/50">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            AI-Powered Personal Advisory
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            Navigate your life
            <br />
            <span className="text-cyan-600 dark:text-cyan-400">with confidence</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Your AI-powered personal advisor for goals, finances, career, and education. Get
            personalized advice grounded in your actual data &mdash; not generic tips.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-600/25 text-center"
            >
              Get Started Free
            </Link>
            <Link
              href="/features"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-all text-center"
            >
              See Features
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
              One platform that connects all areas of your life &mdash; powered by AI that actually
              knows you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<TargetIcon />}
              title="Smart Goal Tracking"
              description="Set goals with AI-suggested milestones. Track progress across career, finances, education, and personal development."
            />
            <FeatureCard
              icon={<LightbulbIcon />}
              title="AI Personal Advisor"
              description="Ask anything about your life trajectory. Get advice grounded in YOUR data — your goals, risk tolerance, and real progress."
            />
            <FeatureCard
              icon={<WalletIcon />}
              title="Financial Intelligence"
              description="Track accounts, analyze spending, monitor investments. AI connects your financial picture to your life goals."
            />
            <FeatureCard
              icon={<TrendingUpIcon />}
              title="Career Navigation"
              description="Track job applications, grow your skills, build your network. AI identifies opportunities aligned with your goals."
            />
            <FeatureCard
              icon={<MailIcon />}
              title="Email & Calendar"
              description="Connect Gmail and Outlook. Your AI advisor sees your schedule and communications for better context."
            />
            <FeatureCard
              icon={<ShieldIcon />}
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

      {/* Social Proof / Stats */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Built for people who take their future seriously
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-12">
            Whether you&apos;re a career professional, student, veteran, or entrepreneur &mdash;
            Life Navigator adapts to your unique situation.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <StatCard value="5+" label="Life Domains" />
            <StatCard value="AES-256" label="Encryption" />
            <StatCard value="GDPR" label="Compliant" />
            <StatCard value="24/7" label="AI Advisor" />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Ready to take control?
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Join Life Navigator today and start getting AI-powered advice tailored to your actual
            life.
          </p>
          <div className="mt-8">
            <Link
              href="/auth/register"
              className="inline-flex px-8 py-3.5 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-600/25"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ── Helper components ── */

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow">
      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{description}</p>
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
      <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 font-bold text-xl flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{value}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{label}</div>
    </div>
  );
}

/* ── Inline SVG Icons ── */

function TargetIcon() {
  return (
    <svg
      width="20"
      height="20"
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
  );
}

function LightbulbIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      width="20"
      height="20"
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
  );
}

function TrendingUpIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
