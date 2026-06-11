import EducationTabEmpty from '@/components/domain/education/EducationTabEmpty';

// Education → degrees tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function EducationDegreesPage() {
  return <EducationTabEmpty tab="degrees" />;
}
