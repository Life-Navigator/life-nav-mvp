'use client';

import React, { Suspense, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';
import ActivityTracker from '@/components/health/wellness/components/ActivityTracker';
import SleepAnalysis from '@/components/health/wellness/components/SleepAnalysis';
import NutritionLog from '@/components/health/wellness/components/NutritionLog';
import HealthIntegrations from '@/components/health/HealthIntegrations';

export default function WellnessPage() {
  const [activeTab, setActiveTab] = useState<'tracking' | 'integrations'>('tracking');

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Wellness Tracking</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Track your daily activity, sleep patterns, and nutrition to maintain a healthy lifestyle
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('tracking')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'tracking'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Wellness Data
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'integrations'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Device Integrations
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'tracking' ? (
        <div className="space-y-6">
          {/* Activity Tracking Section */}
          <Suspense fallback={<LoadingSpinner />}>
            <ActivityTracker />
          </Suspense>

          {/* Sleep Analysis Section */}
          <Suspense fallback={<LoadingSpinner />}>
            <SleepAnalysis />
          </Suspense>

          {/* Nutrition Tracking Section */}
          <Suspense fallback={<LoadingSpinner />}>
            <NutritionLog />
          </Suspense>
        </div>
      ) : (
        <HealthIntegrations />
      )}
    </div>
  );
}
