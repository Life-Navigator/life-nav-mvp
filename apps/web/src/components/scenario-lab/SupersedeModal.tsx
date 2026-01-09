'use client';

/**
 * Supersede Commit Modal
 * Requires user to type "SUPERSEDE" to confirm destructive action
 */

import { useState } from 'react';

interface SupersedeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onFork: () => void;
  committedVersionName?: string;
}

export default function SupersedeModal({
  isOpen,
  onClose,
  onConfirm,
  onFork,
  committedVersionName,
}: SupersedeModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const isValid = confirmText === 'SUPERSEDE';

  const handleSupersede = async () => {
    if (!isValid) return;

    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
      setConfirmText('');
    }
  };

  const handleFork = () => {
    onFork();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Supersede Committed Roadmap?
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              This action will replace your current committed roadmap
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">
              ⚠️ What will happen:
            </h4>
            <ul className="text-sm text-red-800 dark:text-red-200 space-y-1 list-disc list-inside">
              <li>Your current committed version will be marked as "superseded"</li>
              <li>Your existing roadmap will be preserved (read-only in History)</li>
              <li>A new roadmap will be generated from the new committed version</li>
              <li>This action is logged and audited, but cannot be undone</li>
            </ul>
          </div>

          {committedVersionName && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Current committed version:</strong> {committedVersionName}
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              💡 Recommended: Fork Instead
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Forking creates a new scenario while preserving your committed roadmap.
              This lets you explore alternatives without replacing your current plan.
            </p>
          </div>

          {/* Confirmation Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-red-600 dark:text-red-400 font-mono">SUPERSEDE</code> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="Type SUPERSEDE here"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleFork}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Fork Instead (Recommended)
          </button>
          <button
            onClick={handleSupersede}
            disabled={!isValid || isConfirming}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming ? 'Superseding...' : 'Supersede Commit'}
          </button>
        </div>
      </div>
    </div>
  );
}
