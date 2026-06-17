'use client';

import FamilyEntityCrud from '@/components/domain/family/FamilyEntityCrud';

// Family → Family Members: REAL CRUD (add/list/delete), persisted to family.family_members (RLS).
export default function FamilyMembersPage() {
  return (
    <FamilyEntityCrud
      slug="members"
      title="Family members"
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'relationship',
          label: 'Relationship',
          type: 'select',
          options: ['Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Other'],
        },
        { name: 'date_of_birth', label: 'Date of birth' },
        { name: 'age', label: 'Age', type: 'number' },
        { name: 'is_dependent', label: 'Dependent?', type: 'select', options: ['Yes', 'No'] },
        {
          name: 'lives_in_household',
          label: 'In household?',
          type: 'select',
          options: ['Yes', 'No'],
        },
        { name: 'school_name', label: 'School' },
        { name: 'grade_level', label: 'Grade' },
        {
          name: 'college_planning_status',
          label: 'College planning',
          type: 'select',
          options: ['Not started', 'Saving', 'On track', 'Funded', 'N/A'],
        },
        {
          name: 'financial_dependency_level',
          label: 'Financial dependency',
          type: 'select',
          options: ['Full', 'Partial', 'None'],
        },
        { name: 'emergency_priority', label: 'Emergency priority', type: 'number' },
        { name: 'special_needs_notes', label: 'Special needs notes' },
        { name: 'notes', label: 'Notes' },
      ]}
      summarize={(r) =>
        [
          String(r.name || ''),
          r.relationship && String(r.relationship),
          r.age ? `age ${r.age}` : '',
          r.is_dependent === true || r.is_dependent === 'true' ? 'dependent' : '',
          r.school_name && String(r.school_name),
        ]
          .filter(Boolean)
          .join(' · ')
      }
    />
  );
}
