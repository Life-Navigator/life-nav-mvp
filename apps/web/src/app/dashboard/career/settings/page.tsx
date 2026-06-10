import CareerTabEmpty from '@/components/domain/career/CareerTabEmpty';

// Career → settings tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function CareerSettingsPage() {
  return <CareerTabEmpty tab="settings" />;
}
