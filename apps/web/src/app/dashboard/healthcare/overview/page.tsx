'use client';

import React, { Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';
import HealthScore from '@/components/health/overview/components/HealthScore';
import VitalsTrends from '@/components/health/overview/components/VitalsTrends';
import MedicationTracker from '@/components/health/overview/components/MedicationTracker';

export default function HealthcareOverviewPage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Health Overview</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Monitor your overall health status, vitals, and medications in one place
        </p>
      </div>

      <div className="space-y-6">
        {/* Health Score Section */}
        <Suspense fallback={<LoadingSpinner />}>
          <HealthScore />
        </Suspense>

        {/* Vitals Trends Section */}
        <Suspense fallback={<LoadingSpinner />}>
          <VitalsTrends />
        </Suspense>

        {/* Medication Tracker Section */}
        <Suspense fallback={<LoadingSpinner />}>
          <MedicationTracker />
        </Suspense>
      </div>
    </div>
  );
}
