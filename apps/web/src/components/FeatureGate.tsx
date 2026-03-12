'use client';

import React from 'react';

type FeatureKey = 'health';

const LOCKED_FEATURES: Record<FeatureKey, { title: string; description: string }> = {
  health: {
    title: 'Health & Wellness',
    description:
      'Health tracking, wearable connections, and wellness insights are coming soon. Stay tuned for updates.',
  },
};

interface FeatureGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
}

/**
 * Wraps content that is behind a feature lock.
 * Shows a lock overlay instead of the children when the feature is disabled.
 */
export default function FeatureGate({ feature, children }: FeatureGateProps) {
  const locked = feature in LOCKED_FEATURES;

  if (!locked) {
    return <>{children}</>;
  }

  const info = LOCKED_FEATURES[feature];

  return (
    <div className="relative min-h-[400px]">
      {/* Blurred/dimmed content */}
      <div className="pointer-events-none select-none opacity-20 blur-sm">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center max-w-md px-6 py-8 rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {info.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {info.description}
          </p>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-sm font-medium">
            Coming Soon
          </span>
        </div>
      </div>
    </div>
  );
}
