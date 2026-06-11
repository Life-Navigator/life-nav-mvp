import HealthTabEmpty from '@/components/domain/health/HealthTabEmpty';

// Health → documents tab. Honest missing-state + PII warning via the shared framework; the upload CTA
// routes to the canonical /dashboard/documents uploader (no 404, no fake data).
export default function HealthDocumentsPage() {
  return <HealthTabEmpty tab="documents" />;
}
