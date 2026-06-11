import FamilyEntityCrud from '@/components/domain/family/FamilyEntityCrud';

// Family → Beneficiaries: REAL CRUD (add/list/delete), persisted to family.beneficiaries.
export default function FamilyBeneficiariesPage() {
  return (
    <FamilyEntityCrud
      slug="beneficiaries"
      title="Beneficiaries"
      legal
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'relationship',
          label: 'Relationship',
          type: 'select',
          options: ['Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Trust', 'Other'],
        },
        {
          name: 'account_type',
          label: 'Account',
          type: 'select',
          options: ['Retirement', 'Life insurance', 'Bank', 'Brokerage', 'Other'],
        },
        { name: 'allocation_pct', label: 'Allocation %', type: 'number' },
      ]}
      summarize={(r) =>
        [
          String(r.name || ''),
          r.relationship && String(r.relationship),
          r.account_type && String(r.account_type),
          r.allocation_pct != null && r.allocation_pct !== '' ? `${r.allocation_pct}%` : '',
        ]
          .filter(Boolean)
          .join(' · ')
      }
    />
  );
}
