'use client';

// Family → Documents: the Document Intelligence experience scoped to family documents (wills, trusts,
// POAs, beneficiary forms, life insurance). Same real upload/extract/readiness engine, family-focused.
import DocumentIntelligence, { FAMILY_DOC_GROUPS } from '@/components/documents/DocumentIntelligence';

export default function FamilyDocumentsPage() {
  return (
    <DocumentIntelligence
      title="Family Documents & Readiness"
      intro="Add wills, trusts, powers of attorney, beneficiary forms, and insurance policies — LifeNavigator extracts the facts and tracks what's missing. Nothing is invented."
      groups={FAMILY_DOC_GROUPS}
      categoryFilter={['family', 'estate', 'insurance']}
      defaultDocType="will"
      domain="family"
    />
  );
}
