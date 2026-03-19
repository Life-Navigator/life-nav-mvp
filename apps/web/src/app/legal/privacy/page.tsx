import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Life Navigator',
  description: 'Life Navigator Privacy Policy - How we collect, use, and protect your data.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Last updated: March 18, 2026
          </p>

          <div className="prose dark:prose-invert max-w-none space-y-8">
            {/* 1. Introduction */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                1. Introduction
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Life Navigator (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates a
                personal life management platform that helps users organize and optimize their
                finances, health, career, education, and personal goals through AI-powered insights.
                This Privacy Policy explains how we collect, use, disclose, retain, and safeguard
                your information when you use our web application, mobile application, and related
                services (collectively, the &quot;Service&quot;).
              </p>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                By creating an account or using the Service, you agree to the collection and use of
                information in accordance with this policy. If you do not agree, please do not use
                the Service.
              </p>
            </section>

            {/* 2. Information We Collect */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                2. Information We Collect
              </h2>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-4 mb-2">
                2.1 Information You Provide
              </h3>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1">
                <li>Account registration information (email address, password, display name)</li>
                <li>Profile preferences (timezone, language, theme, notification settings)</li>
                <li>Goals, milestones, habits, and personal development plans</li>
                <li>Career information (job title, employer, skills, resumes)</li>
                <li>Education records (institutions, degrees, courses, study logs)</li>
                <li>Family information (family members, dependents, pets)</li>
                <li>
                  Documents you upload (financial statements, medical records, education
                  transcripts)
                </li>
                <li>Risk assessment responses and financial planning preferences</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-4 mb-2">
                2.2 Information from Third-Party Services
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                When you choose to connect third-party accounts, we receive information from those
                services:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1">
                <li>
                  <strong>Plaid (Financial Data):</strong> Account names, types, balances, and
                  transaction history from your linked bank accounts, credit cards, and investment
                  accounts. We do not receive your bank login credentials. See Section 5 for
                  details.
                </li>
                <li>
                  <strong>Google (OAuth):</strong> Basic profile information (name, email) for
                  authentication. If you connect Gmail or Google Calendar, we access email metadata
                  and calendar events as authorized by you.
                </li>
                <li>
                  <strong>Health Platforms:</strong> Health metrics, activity data, and wellness
                  records from connected wearables and health apps, only when you explicitly
                  authorize the connection.
                </li>
              </ul>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-4 mb-2">
                2.3 Automatically Collected Information
              </h3>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1">
                <li>Device information (browser type, operating system)</li>
                <li>Usage data (features accessed, session duration)</li>
                <li>IP address (for security monitoring and abuse prevention)</li>
                <li>Authentication events (login times, failed attempts for security)</li>
              </ul>
            </section>

            {/* 3. How We Use Your Information */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                3. How We Use Your Information
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                We use the information we collect for the following purposes:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1">
                <li>
                  <strong>Provide the Service:</strong> Deliver personalized AI-powered insights,
                  scenario analysis, goal tracking, and financial planning features.
                </li>
                <li>
                  <strong>Knowledge Graph:</strong> Build a private, per-user knowledge graph that
                  connects your goals, finances, career, and health data to provide holistic,
                  context-aware recommendations. Your knowledge graph is strictly isolated to your
                  account.
                </li>
                <li>
                  <strong>Document Processing:</strong> Extract structured data from uploaded
                  documents (e.g., bank statements, pay stubs, medical bills) using AI-powered OCR
                  to populate your profile.
                </li>
                <li>
                  <strong>Security:</strong> Detect and prevent fraud, unauthorized access, and
                  abuse.
                </li>
                <li>
                  <strong>Communication:</strong> Send service notifications, goal reminders, and
                  (with your consent) marketing communications.
                </li>
                <li>
                  <strong>Improvement:</strong> Analyze usage patterns to improve the Service. We
                  use aggregated, anonymized data only.
                </li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                We do <strong>not</strong> sell your personal information. We do{' '}
                <strong>not</strong> use your financial, health, or personal data to serve
                advertisements. We do <strong>not</strong> share your data with third parties for
                their marketing purposes.
              </p>
            </section>

            {/* 4. Data Security */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                4. Data Security
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                We implement multiple layers of security to protect your data:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1">
                <li>
                  <strong>Encryption in Transit:</strong> All data is transmitted over TLS 1.2 or
                  higher. No plaintext connections are permitted.
                </li>
                <li>
                  <strong>Encryption at Rest:</strong> Sensitive data including financial account
                  numbers, OAuth tokens, and health records are encrypted using AES-256 encryption
                  before database storage. Encryption keys are stored separately from encrypted
                  data.
                </li>
                <li>
                  <strong>Tenant Isolation:</strong> Row-level security policies enforce strict data
                  isolation. Every database query is filtered by your authenticated identity. No
                  user can access another user&apos;s data through any API path.
                </li>
                <li>
                  <strong>Access Controls:</strong> Role-based access control limits data access to
                  authorized personnel only. Production systems require multi-factor authentication.
                </li>
                <li>
                  <strong>Audit Logging:</strong> Security-sensitive operations are logged for
                  monitoring and incident response.
                </li>
              </ul>
            </section>

            {/* 5. Plaid and Financial Data */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                5. Financial Data and Plaid
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                We use Plaid Inc. (&quot;Plaid&quot;) to connect your bank accounts and retrieve
                financial data. When you use Plaid Link to connect an account:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1">
                <li>
                  You provide your bank credentials directly to Plaid through their secure
                  interface. We never see or store your bank login credentials.
                </li>
                <li>
                  Plaid provides us with account information (names, types, balances) and
                  transaction data (date, amount, merchant, category) that you authorize.
                </li>
                <li>
                  Plaid access tokens are encrypted with AES-256 before storage in our database.
                  Tokens are decrypted only server-side for authorized data retrieval.
                </li>
                <li>
                  You can disconnect any linked account at any time. When you disconnect, we revoke
                  the Plaid access token and delete associated data within 30 days.
                </li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                By using our financial features, you also agree to Plaid&apos;s{' '}
                <a
                  href="https://plaid.com/legal/#end-user-privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  End User Privacy Policy
                </a>
                .
              </p>
            </section>

            {/* 6. AI and Automated Processing */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                6. AI and Automated Processing
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                Our Service uses artificial intelligence to provide personalized insights and
                recommendations:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1">
                <li>
                  We use Google&apos;s Gemini AI models to generate text embeddings (numerical
                  representations of your data) and to produce personalized responses to your
                  questions.
                </li>
                <li>
                  Your data is sent to the AI model as part of a query and is not retained by the AI
                  provider after processing. We do not use your data to train AI models.
                </li>
                <li>
                  AI-generated insights are recommendations only and should not be considered
                  financial, medical, legal, or professional advice.
                </li>
                <li>
                  Document OCR processing uses AI to extract structured data from uploaded files.
                  Sensitive patterns (SSNs, credit card numbers) are redacted during processing.
                </li>
              </ul>
            </section>

            {/* 7. Data Sharing */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                7. Data Sharing and Third Parties
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                We share your information only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1">
                <li>
                  <strong>Service Providers:</strong> We use Supabase (database and authentication),
                  Vercel (application hosting), Neo4j (knowledge graph), Qdrant (vector search),
                  Google AI (embeddings and generation), and Plaid (financial data). These providers
                  process data on our behalf under contractual obligations to protect your
                  information.
                </li>
                <li>
                  <strong>Legal Requirements:</strong> We may disclose your information if required
                  by law, subpoena, court order, or government request.
                </li>
                <li>
                  <strong>Safety:</strong> We may disclose information to prevent fraud, protect the
                  safety of our users, or defend our legal rights.
                </li>
                <li>
                  <strong>Business Transfers:</strong> In the event of a merger, acquisition, or
                  sale of assets, your data may be transferred. We will notify you before your data
                  becomes subject to a different privacy policy.
                </li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                We do <strong>not</strong> sell, rent, or trade your personal information to third
                parties for their commercial purposes.
              </p>
            </section>

            {/* 8. Data Retention */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                8. Data Retention
              </h2>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1">
                <li>
                  <strong>Account Data:</strong> Retained for the duration of your account. When you
                  delete your account, all personal data is deleted within 30 days.
                </li>
                <li>
                  <strong>Financial Data:</strong> Transaction data and account information are
                  retained while your financial accounts are linked. Data is deleted within 30 days
                  of disconnecting an account.
                </li>
                <li>
                  <strong>Knowledge Graph:</strong> Your personal knowledge graph nodes and vector
                  embeddings are deleted when the associated source data is deleted.
                </li>
                <li>
                  <strong>Uploaded Documents:</strong> Retained until you delete them. Extracted
                  data follows the same retention as account data.
                </li>
                <li>
                  <strong>Security Logs:</strong> Authentication and audit logs are retained for 90
                  days for security purposes.
                </li>
                <li>
                  <strong>Cached AI Responses:</strong> Query cache entries expire automatically
                  after 1 hour and are purged daily.
                </li>
              </ul>
            </section>

            {/* 9. Your Rights */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                9. Your Rights
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                You have the following rights regarding your personal data:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1">
                <li>
                  <strong>Access:</strong> Request a copy of all personal data we hold about you.
                </li>
                <li>
                  <strong>Correction:</strong> Update or correct inaccurate personal data.
                </li>
                <li>
                  <strong>Deletion:</strong> Request deletion of your account and all associated
                  data.
                </li>
                <li>
                  <strong>Portability:</strong> Export your data in a machine-readable format.
                </li>
                <li>
                  <strong>Disconnect:</strong> Remove any third-party integration at any time from
                  your account settings.
                </li>
                <li>
                  <strong>Opt-Out:</strong> Opt out of non-essential communications at any time.
                </li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                To exercise any of these rights, contact us at{' '}
                <a
                  href="mailto:privacy@lifenavigator.tech"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  privacy@lifenavigator.tech
                </a>
                . We will respond within 30 days.
              </p>
            </section>

            {/* 10. California Residents (CCPA) */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                10. California Residents (CCPA/CPRA)
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                If you are a California resident, you have additional rights under the California
                Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA):
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1">
                <li>
                  <strong>Right to Know:</strong> You may request the categories and specific pieces
                  of personal information we have collected about you.
                </li>
                <li>
                  <strong>Right to Delete:</strong> You may request deletion of your personal
                  information, subject to certain legal exceptions.
                </li>
                <li>
                  <strong>Right to Opt-Out of Sale:</strong> We do not sell your personal
                  information. We do not share your personal information for cross-context
                  behavioral advertising.
                </li>
                <li>
                  <strong>Non-Discrimination:</strong> We will not discriminate against you for
                  exercising your privacy rights.
                </li>
              </ul>
            </section>

            {/* 11. Children */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                11. Children&apos;s Privacy
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                The Service is not intended for individuals under the age of 18. We do not knowingly
                collect personal information from children under 18. If we become aware that we have
                collected data from a child under 18, we will delete that information promptly. If
                you believe a child has provided us with personal information, please contact us at{' '}
                <a
                  href="mailto:privacy@lifenavigator.tech"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  privacy@lifenavigator.tech
                </a>
                .
              </p>
            </section>

            {/* 12. Changes */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                12. Changes to This Policy
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                We may update this Privacy Policy from time to time. We will notify you of material
                changes by posting the updated policy on this page and updating the &quot;Last
                updated&quot; date. For significant changes, we will provide additional notice (such
                as an in-app notification or email). Your continued use of the Service after changes
                are posted constitutes your acceptance of the revised policy.
              </p>
            </section>

            {/* 13. Contact */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                13. Contact Us
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                If you have questions about this Privacy Policy or our data practices, please
                contact us at:
              </p>
              <div className="mt-2 text-gray-600 dark:text-gray-300">
                <p>Life Navigator</p>
                <p>
                  Email:{' '}
                  <a
                    href="mailto:privacy@lifenavigator.tech"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    privacy@lifenavigator.tech
                  </a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
