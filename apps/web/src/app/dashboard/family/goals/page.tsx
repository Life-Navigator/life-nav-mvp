import FamilyTabEmpty from '@/components/domain/family/FamilyTabEmpty';

// Family → goals tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function FamilyGoalsPage() {
  return <FamilyTabEmpty tab="goals" />;
}
