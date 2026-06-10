import CareerTabEmpty from '@/components/domain/career/CareerTabEmpty';

// Career → documents tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function CareerDocumentsPage() {
  return <CareerTabEmpty tab="documents" />;
}
