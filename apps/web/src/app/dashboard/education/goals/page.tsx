import EducationTabEmpty from '@/components/domain/education/EducationTabEmpty';

// Education → goals tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function EducationGoalsPage() {
  return <EducationTabEmpty tab="goals" />;
}
