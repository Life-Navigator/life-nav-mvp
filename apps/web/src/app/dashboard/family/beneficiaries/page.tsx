import FamilyTabEmpty from '@/components/domain/family/FamilyTabEmpty';

// Family → beneficiaries tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function FamilyBeneficiariesPage() {
  return <FamilyTabEmpty tab="beneficiaries" />;
}
