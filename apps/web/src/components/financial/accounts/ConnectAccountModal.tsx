'use client';

import React from 'react';
import Link from 'next/link';

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// HONEST STATE (no-mock-data rule): automated bank linking (Plaid) is not yet
// enabled for the private beta, so we do NOT show a fabricated institution picker
// that does nothing. We tell the user the truth and point them at the capture
// paths that DO work today — the finance advisor chat and document upload.
export default function ConnectAccountModal({ isOpen, onClose }: ConnectAccountModalProps) {
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-account-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2
            id="connect-account-title"
            className="text-xl font-semibold text-gray-900 dark:text-white"
          >
            Add a Financial Account
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Automatic bank connections aren&apos;t available yet during the private beta.
              We&apos;ll turn on secure bank linking soon.
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            In the meantime, your financial picture is built from what you tell your advisor and the
            documents you share — both count toward your net worth and readiness:
          </p>

          <div className="space-y-2">
            <Link
              href="/dashboard/advisor"
              onClick={onClose}
              className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-white">Tell your advisor</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Mention your accounts, balances, or goals in chat.
                </p>
              </div>
              <span aria-hidden className="text-gray-400">
                &rsaquo;
              </span>
            </Link>

            <Link
              href="/dashboard/documents"
              onClick={onClose}
              className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-white">Upload a statement</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Add a bank, brokerage, or loan statement and we&apos;ll read it.
                </p>
              </div>
              <span aria-hidden className="text-gray-400">
                &rsaquo;
              </span>
            </Link>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
