import HealthTabEmpty from '@/components/domain/health/HealthTabEmpty';

// Health → biometrics tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function HealthBiometricsPage() {
  return <HealthTabEmpty tab="biometrics" />;
}
