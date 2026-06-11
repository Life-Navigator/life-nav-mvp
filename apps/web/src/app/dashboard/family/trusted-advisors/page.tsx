'use client';

import FamilyEntityCrud from '@/components/domain/family/FamilyEntityCrud';

// Family → Trusted advisors: REAL CRUD (add/list/delete), persisted to family.trusted_advisors.
export default function FamilyTrustedAdvisorsPage() {
  return (
    <FamilyEntityCrud
      slug="trusted-advisors"
      title="Trusted advisors"
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'advisor_type',
          label: 'Type',
          type: 'select',
          options: ['CPA', 'Attorney', 'Financial Advisor', 'Insurance Agent', 'Other'],
        },
        { name: 'firm', label: 'Firm' },
        { name: 'email', label: 'Email' },
        { name: 'phone', label: 'Phone' },
      ]}
      summarize={(r) =>
        [String(r.name || ''), r.advisor_type && String(r.advisor_type), r.firm && String(r.firm)]
          .filter(Boolean)
          .join(' · ')
      }
    />
  );
}
