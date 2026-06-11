'use client';

import FamilyEntityCrud from '@/components/domain/family/FamilyEntityCrud';

// Family → Emergency contacts: REAL CRUD (add/list/delete), persisted to family.emergency_contacts.
export default function FamilyEmergencyContactsPage() {
  return (
    <FamilyEntityCrud
      slug="emergency-contacts"
      title="Emergency contacts"
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'relationship',
          label: 'Relationship',
          type: 'select',
          options: ['Spouse', 'Partner', 'Parent', 'Sibling', 'Friend', 'Caregiver', 'Other'],
        },
        { name: 'phone', label: 'Phone' },
        { name: 'email', label: 'Email' },
      ]}
      summarize={(r) =>
        [String(r.name || ''), r.relationship && String(r.relationship), r.phone && String(r.phone)]
          .filter(Boolean)
          .join(' · ')
      }
    />
  );
}
