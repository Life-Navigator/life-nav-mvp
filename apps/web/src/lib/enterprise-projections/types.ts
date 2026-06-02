/**
 * Sprint S — Enterprise Projection types.
 *
 * The constitutional layering is a 4-tier hierarchy:
 *
 *   global       → platform constitution (Sprint L2 + N.3 baseline)
 *      ↓
 *   industry     → vertical baseline (regulator-aligned)
 *      ↓
 *   organization → tenant-specific policies
 *      ↓
 *   user         → per-user overrides (very narrow — cannot override safety)
 *
 * Hard invariant: a lower layer can NEVER override a higher-layer
 * rule whose `is_overridable === false`. Safety + lawfulness rules
 * are seeded with `is_overridable = false` so even an organization
 * cannot silently turn them off.
 */

export type ConstitutionalLayer = 'global' | 'industry' | 'organization' | 'user';

export type Industry =
  | 'financial_services'
  | 'healthcare'
  | 'payroll'
  | 'education'
  | 'government'
  | 'energy';

export type PolicyOutcome = 'approved' | 'prohibited' | 'escalate' | 'requires_compliance_review';

export type ProjectionStatus = 'draft' | 'active' | 'deprecated';

export interface LayerRule {
  layer: ConstitutionalLayer;
  industry?: Industry | null;
  tenant_id?: string | null;
  user_id?: string | null;
  entity_kind: string;
  slug: string;
  name: string;
  body: string;
  source?: string;
  citation_reference?: string;
  version: string;
  is_overridable: boolean;
  review_status: 'active' | 'draft' | 'superseded' | 'retired';
  tags: string[];
}

export interface OrganizationPolicy {
  tenant_id: string;
  policy_key: string;
  display_name: string;
  applies_to: string[];
  match_pattern?: string;
  outcome: PolicyOutcome;
  escalation_to?: string;
  compliance_note?: string;
  priority: number;
  active: boolean;
}

export interface EnterpriseProjection {
  tenant_id: string;
  display_name: string;
  industry: Industry;
  status: ProjectionStatus;
  rule_set_version?: string;
  primary_regulator?: string;
  compliance_tags: string[];
}

export interface IndustryTemplate {
  industry: Industry;
  display_name: string;
  description?: string;
  rule_count: number;
  references: string[];
  status: ProjectionStatus;
}

export const ALL_INDUSTRIES: ReadonlyArray<Industry> = Object.freeze([
  'financial_services',
  'healthcare',
  'payroll',
  'education',
  'government',
  'energy',
]);
