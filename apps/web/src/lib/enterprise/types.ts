/**
 * Enterprise readiness shared types.
 */

export type AssetKind =
  | 'infrastructure'
  | 'database'
  | 'storage'
  | 'provider'
  | 'integration'
  | 'queue'
  | 'observability'
  | 'identity'
  | 'source_code'
  | 'secrets_store';

export type RiskTier = 'high' | 'medium' | 'low';
export type VendorStatus = 'active' | 'pending_review' | 'deprecated' | 'offboarded';
export type AccessReviewStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue';
export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';

export interface Vendor {
  vendor_key: string;
  display_name: string;
  risk_tier: RiskTier;
  subprocessors: string[];
  data_shared?: string;
  certifications: string[];
  dpa_signed: boolean;
  baa_signed: boolean;
  last_reviewed_at?: string;
  next_review_due?: string;
  status: VendorStatus;
}

export interface SecretRotationItem {
  secret_key: string;
  owner_team: string;
  rotation_period_days: number;
  last_rotated_at?: string;
  next_due_at?: string;
  storage_location: string;
  rotation_method: 'manual' | 'gsm_managed' | 'iam_rotated';
}

export interface AccessReview {
  review_period: string;
  scope: string;
  status: AccessReviewStatus;
  scheduled_for: string;
  completed_at?: string;
  subjects_total: number;
  subjects_revoked: number;
  subjects_modified: number;
}
