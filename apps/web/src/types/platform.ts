/**
 * Sprint P — Enterprise Foundation types.
 */

export type TenantKind =
  | 'consumer'
  | 'employer'
  | 'arcana'
  | 'enterprise'
  | 'partner'
  | 'internal'
  | 'dev';
export type TenantIsolation = 'shared' | 'industry' | 'dedicated';
export type TenantRole = 'owner' | 'admin' | 'operator' | 'viewer';
export type ApiKeyStatus = 'active' | 'rotated' | 'revoked' | 'expired';

export interface TenantRow {
  id: string;
  slug: string;
  display_name: string;
  tenant_kind: TenantKind;
  isolation: TenantIsolation;
  industry_code?: string | null;
  status: 'active' | 'suspended' | 'closed';
  data_residency?: string | null;
  retention_default?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TenantUserRow {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TenantRole;
  joined_at: string;
  invited_by?: string | null;
  removed_at?: string | null;
}

export interface TenantApiKeyRow {
  id: string;
  tenant_id: string;
  name: string;
  prefix: string;
  key_hash: string;
  scopes: string[];
  status: ApiKeyStatus;
  created_by?: string | null;
  expires_at?: string | null;
  last_used_at?: string | null;
}

export type ConnectorKind =
  | 'payroll'
  | 'brokerage'
  | 'retirement'
  | 'bank'
  | 'health'
  | 'insurance'
  | 'other';
export type ConnectorAuthFlow =
  | 'oauth2'
  | 'partner_token'
  | 'custom'
  | 'plaid_link'
  | 'sftp'
  | 'webhook';
export type ConnectionStatus =
  | 'pending'
  | 'active'
  | 'syncing'
  | 'paused'
  | 'revoked'
  | 'error'
  | 'expired';

export interface ConnectorRegistryRow {
  id: string;
  slug: string;
  display_name: string;
  vendor: string;
  kind: ConnectorKind;
  auth_flow: ConnectorAuthFlow;
  docs_url?: string | null;
  enabled: boolean;
  beta: boolean;
  scopes_supported: string[];
  metadata: Record<string, unknown>;
}

export interface TenantConnectionRow {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  connector_slug: string;
  status: ConnectionStatus;
  display_label?: string | null;
  scopes_granted: string[];
  creds_vault_ref?: string | null;
  last_sync_at?: string | null;
  last_sync_error?: string | null;
  metadata: Record<string, unknown>;
}
