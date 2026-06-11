import EducationTabEmpty from '@/components/domain/education/EducationTabEmpty';

// Education → skills tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function EducationSkillsPage() {
  return <EducationTabEmpty tab="skills" />;
}
