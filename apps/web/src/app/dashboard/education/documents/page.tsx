import EducationTabEmpty from '@/components/domain/education/EducationTabEmpty';

// Education → documents tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function EducationDocumentsPage() {
  return <EducationTabEmpty tab="documents" />;
}
