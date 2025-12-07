import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Life Navigator",
  description: "Life Navigator Privacy Policy - How we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Last updated: December 7, 2025
          </p>

          <div className="prose dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                1. Introduction
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Life Navigator (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your
                information when you use our life management platform and services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                2. Information We Collect
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-3">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Account information (name, email, password)</li>
                <li>Profile information (preferences, goals, settings)</li>
                <li>Financial data (when you connect financial accounts via Plaid)</li>
                <li>Health data (when you connect health and fitness apps)</li>
                <li>Calendar and email data (when you connect these services)</li>
                <li>Career and education information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                3. How We Use Your Information
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-3">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Personalize your experience and provide AI-powered insights</li>
                <li>Send you notifications and updates</li>
                <li>Respond to your comments, questions, and requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                4. Data Security
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                We implement appropriate technical and organizational security measures to protect
                your personal information. This includes encryption at rest and in transit,
                access controls, and regular security assessments. Health data is handled in
                compliance with HIPAA requirements, and financial data follows GLBA and PCI DSS standards.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                5. Third-Party Services
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                We integrate with third-party services (such as Google, Microsoft, Plaid, and
                health platforms) to provide our services. When you connect these accounts,
                you authorize us to access certain information from those services in accordance
                with their respective privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                6. Your Rights
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-3">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Access and receive a copy of your personal data</li>
                <li>Rectify or update your personal data</li>
                <li>Delete your personal data</li>
                <li>Disconnect third-party integrations at any time</li>
                <li>Export your data in a portable format</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                7. Contact Us
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                If you have any questions about this Privacy Policy, please contact us at:{" "}
                <a
                  href="mailto:privacy@lifenavigator.tech"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  privacy@lifenavigator.tech
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
