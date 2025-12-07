import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Life Navigator",
  description: "Life Navigator Terms of Service - Rules and guidelines for using our platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Last updated: December 7, 2025
          </p>

          <div className="prose dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                By accessing or using Life Navigator (&quot;the Service&quot;), you agree to be bound by
                these Terms of Service. If you do not agree to these terms, please do not use
                the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                2. Description of Service
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Life Navigator is an AI-powered life management platform that helps you organize
                and optimize various aspects of your life including finances, health, career,
                education, and personal goals through intelligent insights and integrations with
                third-party services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                3. User Accounts
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-3">
                To use certain features of the Service, you must create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Be responsible for all activities under your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                4. Acceptable Use
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-3">
                You agree not to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Use the Service for any illegal purpose</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Interfere with or disrupt the Service</li>
                <li>Share your account credentials with others</li>
                <li>Use the Service to harm or exploit others</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                5. Third-Party Integrations
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                The Service integrates with third-party services (such as Google, Microsoft,
                Plaid, health platforms, and others). Your use of these integrations is also
                subject to the terms and policies of those third-party providers. We are not
                responsible for the practices of these third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                6. Intellectual Property
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                The Service and its original content, features, and functionality are owned by
                Life Navigator and are protected by international copyright, trademark, and
                other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                7. Disclaimer of Warranties
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                The Service is provided &quot;as is&quot; without warranties of any kind. We do not
                guarantee that the Service will be uninterrupted, secure, or error-free.
                AI-generated insights and recommendations are for informational purposes only
                and should not replace professional financial, medical, or legal advice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                8. Limitation of Liability
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                To the maximum extent permitted by law, Life Navigator shall not be liable for
                any indirect, incidental, special, consequential, or punitive damages resulting
                from your use of or inability to use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                9. Changes to Terms
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                We reserve the right to modify these Terms at any time. We will notify you of
                any changes by posting the new Terms on this page and updating the &quot;Last updated&quot;
                date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                10. Contact Us
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                If you have any questions about these Terms, please contact us at:{" "}
                <a
                  href="mailto:legal@lifenavigator.tech"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  legal@lifenavigator.tech
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
