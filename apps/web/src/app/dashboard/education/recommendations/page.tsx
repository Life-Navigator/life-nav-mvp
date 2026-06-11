import EducationTabEmpty from '@/components/domain/education/EducationTabEmpty';

// Education → recommendations tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function EducationRecommendationsPage() {
  return <EducationTabEmpty tab="recommendations" />;
}
