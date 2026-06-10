import CareerTabEmpty from '@/components/domain/career/CareerTabEmpty';

// Career → analysis tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function CareerAnalysisPage() {
  return <CareerTabEmpty tab="analysis" />;
}
