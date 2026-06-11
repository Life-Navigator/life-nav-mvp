import FamilyTabEmpty from '@/components/domain/family/FamilyTabEmpty';

// Family → dependents tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function FamilyDependentsPage() {
  return <FamilyTabEmpty tab="dependents" />;
}
