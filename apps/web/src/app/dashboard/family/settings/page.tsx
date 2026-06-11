import FamilyTabEmpty from '@/components/domain/family/FamilyTabEmpty';

// Family → settings tab. Honest missing-state via the shared framework (no 404, no fake data).
export default function FamilySettingsPage() {
  return <FamilyTabEmpty tab="settings" />;
}
