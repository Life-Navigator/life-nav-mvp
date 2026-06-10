import CareerTabEmpty from '@/components/domain/career/CareerTabEmpty';

// Career → experience tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function CareerExperiencePage() {
  return <CareerTabEmpty tab="experience" />;
}
