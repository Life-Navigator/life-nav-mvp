import FamilyOfficePanel from '@/components/domain/family/FamilyOfficePanel';

// Family → Estate tab. Surfaces the Family Office intelligence (GET /v1/family/office) — the 5-pillar
// estate/trust/beneficiary/survivor/legacy readiness — directly in the Family nav, replacing the former
// empty stub. The engine already existed (FamilyOfficeService); this makes it discoverable. Honest empty
// state lives inside the panel when there's no data.
export default function FamilyEstatePage() {
  return (
    <div className="px-1 py-2">
      <h1 className="text-xl font-bold text-gray-900">Estate &amp; Family Office</h1>
      <p className="mt-1 mb-4 text-sm text-gray-500">
        Estate, trust, beneficiary, survivor &amp; legacy readiness — grounded in your real data.
      </p>
      <FamilyOfficePanel />
    </div>
  );
}
