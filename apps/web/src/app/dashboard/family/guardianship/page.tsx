import FamilyTabEmpty from '@/components/domain/family/FamilyTabEmpty';

// Family → guardianship tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function FamilyGuardianshipPage() {
  return <FamilyTabEmpty tab="guardianship" />;
}
