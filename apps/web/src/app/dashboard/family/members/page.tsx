import FamilyTabEmpty from '@/components/domain/family/FamilyTabEmpty';

// Family → members tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function FamilyMembersPage() {
  return <FamilyTabEmpty tab="members" />;
}
