import HealthTabEmpty from '@/components/domain/health/HealthTabEmpty';

// Health → goals tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function HealthGoalsPage() {
  return <HealthTabEmpty tab="goals" />;
}
