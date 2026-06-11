import HealthTabEmpty from '@/components/domain/health/HealthTabEmpty';

// Health → reports tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function HealthReportsPage() {
  return <HealthTabEmpty tab="reports" />;
}
