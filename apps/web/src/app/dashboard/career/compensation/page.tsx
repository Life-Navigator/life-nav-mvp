import CareerTabEmpty from '@/components/domain/career/CareerTabEmpty';

// Career → compensation tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function CareerCompensationPage() {
  return <CareerTabEmpty tab="compensation" />;
}
