import HealthTabEmpty from '@/components/domain/health/HealthTabEmpty';

// Health → nutrition tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function HealthNutritionPage() {
  return <HealthTabEmpty tab="nutrition" />;
}
