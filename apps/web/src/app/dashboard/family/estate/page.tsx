import FamilyTabEmpty from '@/components/domain/family/FamilyTabEmpty';

// Family → estate tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function FamilyEstatePage() {
  return <FamilyTabEmpty tab="estate" />;
}
