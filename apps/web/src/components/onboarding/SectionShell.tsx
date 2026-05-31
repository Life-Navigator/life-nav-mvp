'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SectionShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave: () => Promise<void>;
  saving?: boolean;
  saveLabel?: string;
  /** When provided, called instead of `router.push('/onboarding/hub')`. */
  onAfterSave?: () => void;
}

/**
 * Standard wrapper for the per-section onboarding pages. Handles header,
 * back-to-hub link, Save / Skip controls, and post-save navigation.
 */
export default function SectionShell({
  title,
  description,
  children,
  onSave,
  saving = false,
  saveLabel = 'Save & continue',
  onAfterSave,
}: SectionShellProps) {
  const router = useRouter();

  const handleSave = async () => {
    await onSave();
    if (onAfterSave) onAfterSave();
    else router.push('/onboarding/hub');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/onboarding/hub" className="text-sm text-blue-600 hover:underline">
          ← Back to setup
        </Link>

        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {description && <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>}
        </header>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
          {children}
        </div>

        <div className="flex justify-between items-center">
          <Link
            href="/onboarding/hub"
            className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
          >
            Skip for now
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:bg-blue-400"
          >
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
