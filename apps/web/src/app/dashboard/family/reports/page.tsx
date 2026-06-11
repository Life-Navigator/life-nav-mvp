'use client';

// Family → Reports. REAL reports from the working pipeline (/api/reports/family/pdf → Family &
// Protection Report). No fabricated readiness scores — missing inputs render as honest gaps.
import { DomainReports } from '@/components/domain/framework';

export default function FamilyReportsPage() {
  return (
    <>
      <DomainReports
        heading="Family reports"
        reports={[
          {
            type: 'family',
            title: 'Family & Protection Report',
            description:
              'Protection coverage, dependents, estate readiness, and beneficiaries — from your real family data.',
          },
          {
            type: 'full',
            title: 'Full Life Report',
            description:
              'Your whole picture across finance, career, health, education, and family.',
          },
        ]}
        note="Estate/beneficiary sections are grounded in your data and carry the attorney disclaimer below."
      />
      <p className="px-6 pb-6 text-xs text-gray-500 dark:text-gray-400">
        LifeNavigator is not a law firm and does not provide legal advice. Estate planning decisions
        should be reviewed with a qualified attorney.
      </p>
    </>
  );
}
