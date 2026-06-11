'use client';

// Career → Reports. REAL reports from the working pipeline (/api/reports/{type}/pdf). Career's
// compensation analysis is its grounded report today; the Full Life Report includes the career section.
import { DomainReports } from '@/components/domain/framework';

export default function CareerReportsPage() {
  return (
    <DomainReports
      heading="Career reports"
      reports={[
        {
          type: 'compensation',
          title: 'Compensation & Benefits Report',
          description:
            'Total comp, 5-year value, and cited market bands — grounded in your career profile.',
        },
        {
          type: 'full',
          title: 'Full Life Report',
          description: 'Your whole picture across finance, career, health, education, and family.',
        },
      ]}
      note="A dedicated Career Snapshot / Skills-Gap report is on the roadmap; today your career data powers the Compensation and Full reports."
    />
  );
}
