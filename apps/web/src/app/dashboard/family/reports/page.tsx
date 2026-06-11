import FamilyTabEmpty from '@/components/domain/family/FamilyTabEmpty';

// Family → reports tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function FamilyReportsPage() {
  return <FamilyTabEmpty tab="reports" />;
}
