import HealthTabEmpty from '@/components/domain/health/HealthTabEmpty';

// Health → labs tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function HealthLabsPage() {
  return <HealthTabEmpty tab="labs" />;
}
