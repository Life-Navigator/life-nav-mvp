import HealthIntelligencePanel from '@/components/domain/health/HealthIntelligencePanel';

// Health Intelligence is now surfaced inside the Health experience (the Analysis tab). This route is kept
// for backward-compat / direct links and renders the same panel. Primary entry: /dashboard/healthcare/analysis.
export default function HealthIntelligencePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Health Intelligence</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">
        Your labs, supplements, medications, fitness &amp; nutrition — organized from your
        documents.
      </p>
      <HealthIntelligencePanel />
    </div>
  );
}
