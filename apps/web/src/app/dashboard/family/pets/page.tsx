'use client';

import FamilyEntityCrud from '@/components/domain/family/FamilyEntityCrud';

// Family → Pets: REAL CRUD (add/list/delete), persisted to family.pets (RLS). Pets are first-class
// household records (emergency/travel/insurance planning).
export default function FamilyPetsPage() {
  return (
    <FamilyEntityCrud
      slug="pets"
      title="Pets"
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'species',
          label: 'Species',
          type: 'select',
          options: ['Dog', 'Cat', 'Bird', 'Reptile', 'Small mammal', 'Fish', 'Horse', 'Other'],
        },
        { name: 'breed', label: 'Breed' },
        { name: 'age', label: 'Age', type: 'number' },
        { name: 'date_of_birth', label: 'Date of birth' },
        { name: 'medical_needs', label: 'Medical needs' },
        { name: 'medications', label: 'Medications' },
        { name: 'vet_name', label: 'Vet' },
        { name: 'vet_phone', label: 'Vet phone' },
        { name: 'insurance_provider', label: 'Insurance' },
        { name: 'monthly_cost_estimate', label: 'Monthly cost ($)', type: 'number' },
        { name: 'emergency_care_notes', label: 'Emergency care notes' },
        { name: 'notes', label: 'Notes' },
      ]}
      summarize={(r) =>
        [
          String(r.name || ''),
          [r.species, r.breed].filter(Boolean).join(' '),
          r.monthly_cost_estimate != null && r.monthly_cost_estimate !== ''
            ? `$${r.monthly_cost_estimate}/mo`
            : '',
          r.medical_needs && `needs: ${String(r.medical_needs)}`,
        ]
          .filter(Boolean)
          .join(' · ')
      }
    />
  );
}
