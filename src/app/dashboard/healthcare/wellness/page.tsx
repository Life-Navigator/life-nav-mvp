'use client';

import React, { Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';
import ActivityTracker from '@/components/health/wellness/components/ActivityTracker';
import SleepAnalysis from '@/components/health/wellness/components/SleepAnalysis';
import NutritionLog from '@/components/health/wellness/components/NutritionLog';

export default function WellnessPage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Wellness Tracking</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Track your daily activity, sleep patterns, and nutrition to maintain a healthy lifestyle
        </p>
      </div>

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
    </div>
  );
}
