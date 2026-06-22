import FamilyOfficePanel from '@/components/domain/family/FamilyOfficePanel';

// Family Office is now surfaced inside the Family experience (the Estate tab). This route is kept for
// backward-compat / direct links and renders the same panel. The primary entry point is
// /dashboard/family/estate ("Estate & Family Office").
export default function FamilyOfficePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Family Office</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">
        Estate, trust, beneficiary, survivor &amp; legacy readiness — grounded in your documents.
      </p>
      <FamilyOfficePanel />
    </div>
  );
}
