import FamilyTabEmpty from '@/components/domain/family/FamilyTabEmpty';

// Family → documents tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function FamilyDocumentsPage() {
  return <FamilyTabEmpty tab="documents" />;
}
