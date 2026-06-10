import CareerTabEmpty from '@/components/domain/career/CareerTabEmpty';

// Career → reports tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function CareerReportsPage() {
  return <CareerTabEmpty tab="reports" />;
}
