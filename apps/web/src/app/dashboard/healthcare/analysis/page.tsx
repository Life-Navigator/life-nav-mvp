import HealthTabEmpty from '@/components/domain/health/HealthTabEmpty';

// Health → analysis tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function HealthAnalysisPage() {
  return <HealthTabEmpty tab="analysis" />;
}
