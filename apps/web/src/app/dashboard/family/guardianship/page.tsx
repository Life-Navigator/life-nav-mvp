'use client';

import FamilyEntityCrud from '@/components/domain/family/FamilyEntityCrud';

// Family → Guardianship: REAL CRUD (add/list/delete), persisted to family.guardianship (RLS).
export default function FamilyGuardianshipPage() {
  return (
    <FamilyEntityCrud
      slug="guardianship"
      title="Guardianship plan"
      legal
      fields={[
        { name: 'guardian_name', label: 'Guardian name', required: true },
        {
          name: 'relationship',
          label: 'Relationship',
          type: 'select',
          options: ['Grandparent', 'Aunt/Uncle', 'Sibling', 'Friend', 'Godparent', 'Other'],
        },
        { name: 'backup_guardian', label: 'Backup guardian' },
        {
          name: 'legal_doc_status',
          label: 'Legal documentation',
          type: 'select',
          options: ['Not started', 'Drafted', 'Signed', 'Notarized', 'Filed'],
        },
        { name: 'children_covered', label: 'Children covered' },
        { name: 'notes', label: 'Notes' },
      ]}
      summarize={(r) =>
        [
          String(r.guardian_name || ''),
          r.relationship && String(r.relationship),
          r.legal_doc_status && `docs: ${String(r.legal_doc_status)}`,
          r.children_covered && `for ${String(r.children_covered)}`,
        ]
          .filter(Boolean)
          .join(' · ')
      }
    />
  );
}
