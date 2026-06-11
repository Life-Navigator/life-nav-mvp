import HealthTabEmpty from '@/components/domain/health/HealthTabEmpty';

// Health → medications tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function HealthMedicationsPage() {
  return <HealthTabEmpty tab="medications" />;
}
