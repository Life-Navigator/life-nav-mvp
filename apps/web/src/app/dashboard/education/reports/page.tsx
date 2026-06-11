'use client';

// Education → Reports. REAL reports from the working pipeline (/api/reports/education/pdf →
// 9-section Education report: program ROI, confidence bands, family impact). No fake numbers.
import { DomainReports } from '@/components/domain/framework';

export default function EducationReportsPage() {
  return (
    <DomainReports
      heading="Education reports"
      reports={[
        {
          type: 'education',
          title: 'Education Report',
          description:
            'Programs, ROI analysis, credential gaps, and confidence bands — generated from your education data.',
        },
        {
          type: 'full',
          title: 'Full Life Report',
          description: 'Your whole picture across finance, career, health, education, and family.',
        },
      ]}
      note="ROI figures come from the backend report engine — never fabricated. Missing inputs render as honest gaps."
    />
  );
}
