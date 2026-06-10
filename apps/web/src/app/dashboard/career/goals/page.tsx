import CareerTabEmpty from '@/components/domain/career/CareerTabEmpty';

// Career → goals tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function CareerGoalsPage() {
  return <CareerTabEmpty tab="goals" />;
}
