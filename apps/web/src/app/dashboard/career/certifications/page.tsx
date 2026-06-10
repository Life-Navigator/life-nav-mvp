import CareerTabEmpty from '@/components/domain/career/CareerTabEmpty';

// Career → certifications tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function CareerCertificationsPage() {
  return <CareerTabEmpty tab="certifications" />;
}
