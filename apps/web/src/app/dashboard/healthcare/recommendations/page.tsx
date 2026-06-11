import HealthTabEmpty from '@/components/domain/health/HealthTabEmpty';

// Health → recommendations tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function HealthRecommendationsPage() {
  return <HealthTabEmpty tab="recommendations" />;
}
