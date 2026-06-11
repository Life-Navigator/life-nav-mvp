import FamilyTabEmpty from '@/components/domain/family/FamilyTabEmpty';

// Family → recommendations tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function FamilyRecommendationsPage() {
  return <FamilyTabEmpty tab="recommendations" />;
}
