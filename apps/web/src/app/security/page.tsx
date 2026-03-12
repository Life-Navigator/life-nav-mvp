import Link from 'next/link';

export const metadata = {
  title: 'Security & Privacy - Life Navigator',
  description: 'Learn how Life Navigator protects your data with bank-grade encryption, GDPR compliance, and row-level security.',
};

export default function SecurityPage() {
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm mb-6">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Bank-Grade Security
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
          Your data is sacred
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          We built Life Navigator with security-first architecture. Your
          personal, financial, and career data is protected by multiple layers
          of encryption and access control.
        </p>
      </section>

      {/* Security Features */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          <SecuritySection
            title="Encryption"
            icon="🔐"
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
            icon="🛡️"
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
            icon="🇪🇺"
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
            icon="🔗"
            items={[
              {
                title: 'OAuth 2.0 Token Vault',
                description:
                  'Gmail and Outlook tokens are stored in an encrypted vault table accessible only by server-side service role. Tokens are automatically refreshed and re-encrypted.',
              },
              {
                title: 'Minimal Scope Requests',
                description:
                  'We request only the OAuth scopes needed for the features you use. Email read access doesn\'t grant write access unless you enable sending.',
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
            icon="🏗️"
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
          className="mt-8 inline-flex px-8 py-3.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all"
        >
          Get Started Free
        </Link>
      </section>
    </div>
  );
}

function SecuritySection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: string;
  items: Array<{ title: string; description: string }>;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.title}
            className="p-5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              {item.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
