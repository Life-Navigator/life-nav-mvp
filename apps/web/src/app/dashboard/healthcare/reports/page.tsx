'use client';

// Health → Reports. REAL report from the working pipeline (/api/reports/health/pdf → Health & Wellness
// Report: sleep, activity, vitals, wellness recommendations). No fabricated health data; medical-safety note below.
import { DomainReports } from '@/components/domain/framework';

export default function HealthReportsPage() {
  return (
    <>
      <DomainReports
        heading="Health reports"
        reports={[
          {
            type: 'health',
            title: 'Health & Wellness Report',
            description:
              'Your sleep, activity, vitals, and wellness guidance — generated from your real health logs.',
          },
          {
            type: 'full',
            title: 'Full Life Report',
            description:
              'Your whole picture across finance, career, health, education, and family.',
          },
        ]}
        note="Generated from your logged health data — missing inputs render as honest gaps, never fabricated numbers."
      />
      <p className="px-6 pb-6 text-xs text-gray-500 dark:text-gray-400">
        LifeNavigator is not medical advice. Health features are for organization, planning, and
        discussion with qualified professionals.
      </p>
    </>
  );
}
