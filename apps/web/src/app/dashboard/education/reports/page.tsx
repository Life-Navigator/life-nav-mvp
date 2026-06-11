import EducationTabEmpty from '@/components/domain/education/EducationTabEmpty';

// Education → reports tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function EducationReportsPage() {
  return <EducationTabEmpty tab="reports" />;
}
