import CareerTabEmpty from '@/components/domain/career/CareerTabEmpty';

// Career → recommendations tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function CareerRecommendationsPage() {
  return <CareerTabEmpty tab="recommendations" />;
}
