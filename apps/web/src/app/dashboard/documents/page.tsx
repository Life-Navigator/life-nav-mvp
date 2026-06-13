'use client';

// Standalone Document Intelligence — now a thin wrapper over the reusable component (same behavior:
// full catalog, all readiness categories, advisor onboarding deep-link).
import DocumentIntelligence from '@/components/documents/DocumentIntelligence';

export default function DocumentsPage() {
  return <DocumentIntelligence />;
}
