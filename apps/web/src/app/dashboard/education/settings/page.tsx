import EducationTabEmpty from '@/components/domain/education/EducationTabEmpty';

// Education → settings tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function EducationSettingsPage() {
  return <EducationTabEmpty tab="settings" />;
}
