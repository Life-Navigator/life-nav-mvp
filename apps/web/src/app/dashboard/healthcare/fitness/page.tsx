import HealthTabEmpty from '@/components/domain/health/HealthTabEmpty';

// Health → fitness tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function HealthFitnessPage() {
  return <HealthTabEmpty tab="fitness" />;
}
