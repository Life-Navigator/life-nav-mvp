import HealthIntelligencePanel from '@/components/domain/health/HealthIntelligencePanel';

// Health → Analysis tab. Surfaces Health Intelligence (GET /v1/health/intelligence) — labs vs reference
// ranges, supplements, medications, fitness, nutrition, action items — directly in the Health nav,
// replacing the former empty stub. The engine already existed (HealthIntelligenceService); this makes it
// discoverable. Honest empty state lives inside the panel when there's no data.
export default function HealthAnalysisPage() {
  return (
    <div className="px-1 py-2">
      <h1 className="text-xl font-bold text-gray-900">Health Intelligence</h1>
      <p className="mt-1 mb-4 text-sm text-gray-500">
        Your labs, supplements, medications, fitness &amp; nutrition — organized from your
        documents.
      </p>
      <HealthIntelligencePanel />
    </div>
  );
}
