import FamilyTabEmpty from '@/components/domain/family/FamilyTabEmpty';

// Family → emergency-contacts tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function FamilyEmergencycontactsPage() {
  return <FamilyTabEmpty tab="emergency-contacts" />;
}
