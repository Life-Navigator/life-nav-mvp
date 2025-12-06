'use client';

import { useState } from 'react';
import Link from 'next/link';

interface FinancialPrivacyNoticeProps {
  variant?: 'full' | 'compact' | 'inline';
  onAccept?: () => void;
  showAcceptButton?: boolean;
  className?: string;
}

/**
 * GLBA-compliant Financial Privacy Notice
 *
 * Gramm-Leach-Bliley Act (GLBA) requires financial institutions to:
 * 1. Provide clear privacy notices explaining data collection
 * 2. Offer opt-out mechanisms for non-essential data sharing
 * 3. Implement safeguards to protect customer information
 *
 * This component should be displayed before users connect financial accounts.
 */
export function FinancialPrivacyNotice({
  variant = 'full',
  onAccept,
  showAcceptButton = false,
  className = '',
}: FinancialPrivacyNoticeProps) {
  const [isExpanded, setIsExpanded] = useState(variant === 'full');

  if (variant === 'inline') {
    return (
      <p className={`text-xs text-gray-500 ${className}`}>
        By connecting your accounts, you agree to our{' '}
        <Link href="/privacy" className="text-blue-600 hover:underline">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/privacy#financial" className="text-blue-600 hover:underline">
          Financial Privacy Notice
        </Link>
        .
      </p>
    );
  }

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h4 className="font-semibold text-gray-900">Financial Privacy Notice</h4>
        </div>
        {variant === 'compact' && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:underline"
          >
            {isExpanded ? 'Show less' : 'Learn more'}
          </button>
        )}
      </div>

      <div className={`mt-3 text-sm text-gray-600 space-y-3 ${!isExpanded && variant === 'compact' ? 'hidden' : ''}`}>
        <div>
          <h5 className="font-medium text-gray-800 mb-1">What We Collect</h5>
          <p>
            When you connect your financial accounts through Plaid, we access:
          </p>
          <ul className="list-disc list-inside mt-1 ml-2 text-gray-500">
            <li>Account names, types, and last 4 digits of account numbers</li>
            <li>Account balances and available credit</li>
            <li>Transaction history (amounts, dates, merchants, categories)</li>
          </ul>
        </div>

        <div>
          <h5 className="font-medium text-gray-800 mb-1">How We Use It</h5>
          <p>
            Your financial data helps us provide personalized insights, track spending,
            and help you achieve your financial goals. We analyze patterns to offer
            budgeting recommendations and identify potential savings.
          </p>
        </div>

        <div>
          <h5 className="font-medium text-gray-800 mb-1">Who We Share With</h5>
          <ul className="list-disc list-inside ml-2 text-gray-500">
            <li><strong>Plaid</strong> - Securely connects to your bank (required)</li>
            <li><strong>No one else</strong> - We never sell your financial data</li>
          </ul>
        </div>

        <div>
          <h5 className="font-medium text-gray-800 mb-1">Your Rights</h5>
          <ul className="list-disc list-inside ml-2 text-gray-500">
            <li>Disconnect accounts at any time in Settings</li>
            <li>Request deletion of all financial data</li>
            <li>Export your data in standard formats</li>
          </ul>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            This notice is provided in compliance with the Gramm-Leach-Bliley Act (GLBA).
            For complete details, see our{' '}
            <Link href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>

      {showAcceptButton && onAccept && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <button
            onClick={onAccept}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            I Understand and Accept
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Compact banner version for use in connection flows
 */
export function FinancialPrivacyBanner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs text-gray-500 ${className}`}>
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
      <span>
        Your financial data is encrypted and never sold.{' '}
        <Link href="/privacy#financial" className="text-blue-600 hover:underline">
          Privacy Notice
        </Link>
      </span>
    </div>
  );
}

export default FinancialPrivacyNotice;
