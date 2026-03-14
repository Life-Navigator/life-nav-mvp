import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';

export const metadata = {
  title: 'Security & Privacy - Life Navigator',
  description:
    'Learn how Life Navigator protects your data with bank-grade encryption, GDPR compliance, and row-level security.',
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm mb-6 border border-green-200/50 dark:border-green-800/50">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Bank-Grade Security
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
          Your data is sacred
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          We built Life Navigator with security-first architecture. Your personal, financial, and
          career data is protected by multiple layers of encryption and access control.
        </p>
      </section>

      {/* Security Features */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          <SecuritySection
            title="Encryption"
            icon={<LockIcon />}
            items={[
              {
                title: 'AES-256 Encryption at Rest',
                description:
                  'All data stored in our database is encrypted using AES-256, the same standard used by banks and government agencies.',
              },
              {
                title: 'Column-Level Encryption',
                description:
                  'Sensitive fields like OAuth tokens, account numbers, and SSNs have an additional layer of encryption using pgcrypto with unique per-field keys.',
              },
              {
                title: 'TLS 1.3 in Transit',
                description:
                  'All data transmitted between your browser and our servers is encrypted with TLS 1.3. API keys and tokens never leave server-side code.',
              },
            ]}
          />

          <SecuritySection
            title="Access Control"
            icon={<ShieldCheckIcon />}
            items={[
              {
                title: 'Row-Level Security (RLS)',
                description:
                  'Every database table has PostgreSQL Row-Level Security policies. Users can only access their own data — enforced at the database level, not just the application layer.',
              },
              {
                title: 'Multi-Tenant Isolation',
                description:
                  'Your AI knowledge graph is completely isolated. Every Neo4j node and Qdrant vector is tagged with your unique tenant ID and filtered on every query.',
              },
              {
                title: 'Service-Role Separation',
                description:
                  'Administrative operations use a separate service-role key with higher privileges. This key is never exposed to client-side code.',
              },
            ]}
          />

          <SecuritySection
            title="GDPR Compliance"
            icon={<GlobeIcon />}
            items={[
              {
                title: 'Right to Access (Article 15)',
                description:
                  'Export all your data as a JSON file at any time. One click gives you everything we store about you.',
              },
              {
                title: 'Right to Erasure (Article 17)',
                description:
                  'Delete your account and all associated data permanently. Cascading deletion removes your data from every table, graph node, and vector store.',
              },
              {
                title: 'Consent Tracking (Article 7)',
                description:
                  'Every consent you give is timestamped and versioned. You can review and revoke consent at any time from your settings.',
              },
              {
                title: 'Data Portability (Article 20)',
                description:
                  'Your data export includes goals, financial records, career information, and all other personal data in a standard JSON format.',
              },
            ]}
          />

          <SecuritySection
            title="Integration Security"
            icon={<LinkIcon />}
            items={[
              {
                title: 'OAuth 2.0 Token Vault',
                description:
                  'Gmail and Outlook tokens are stored in an encrypted vault table accessible only by server-side service role. Tokens are automatically refreshed and re-encrypted.',
              },
              {
                title: 'Minimal Scope Requests',
                description:
                  "We request only the OAuth scopes needed for the features you use. Email read access doesn't grant write access unless you enable sending.",
              },
              {
                title: 'No Data Selling',
                description:
                  'We will never sell, share, or monetize your personal data. Your data is used only to provide you with personalized advice.',
              },
            ]}
          />

          <SecuritySection
            title="Infrastructure"
            icon={<ServerIcon />}
            items={[
              {
                title: 'Supabase Platform',
                description:
                  'Hosted on Supabase with SOC 2 Type II certified infrastructure. Database backups, point-in-time recovery, and 99.9% uptime SLA.',
              },
              {
                title: 'Edge Function Isolation',
                description:
                  'Background processing (email sync, GraphRAG) runs in isolated Deno edge functions with per-request sandboxing.',
              },
              {
                title: 'Audit Logging',
                description:
                  'All sensitive operations are logged in our security audit trail. Data exports, deletions, and token operations are tracked with timestamps.',
              },
            ]}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 text-center border-t border-gray-200 dark:border-gray-800">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Questions about security?
        </h2>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          We&apos;re happy to answer any security questions. Reach out to our team.
        </p>
        <Link
          href="/auth/register"
          className="mt-8 inline-flex px-8 py-3.5 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-600/25"
        >
          Get Started Free
        </Link>
      </section>

      <Footer />
    </div>
  );
}

/* ── Helper components ── */

function SecuritySection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ title: string; description: string }>;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.title}
            className="p-5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{item.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Inline SVG Icons ── */

function LockIcon() {
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
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldCheckIcon() {
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

function GlobeIcon() {
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
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function LinkIcon() {
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
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ServerIcon() {
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
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}
