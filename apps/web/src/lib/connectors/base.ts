/**
 * Connector framework — Sprint P Phase 3.
 *
 * Every connector (payroll / brokerage / retirement / bank / health /
 * insurance) implements `BaseConnector`. The framework is generic
 * over the data shape; specific connectors normalize their vendor
 * response into the shared `NormalizedRecord` set so the downstream
 * GraphRAG sync stays uniform.
 *
 * No mocks: each concrete connector either authenticates against the
 * real vendor and pulls real data, OR returns
 * `{ ok: false, error_kind: 'not_configured' }` when its credentials
 * are absent. The framework never silently fakes a sync.
 */

import type { ConnectorKind } from '@/types/platform';

// ---------------------------------------------------------------------------
// Normalized record shapes — what every connector emits
// ---------------------------------------------------------------------------

export interface NormalizedAccount {
  vendor: string;
  external_account_id: string;
  account_kind:
    | 'checking'
    | 'savings'
    | 'brokerage'
    | 'retirement'
    | 'hsa'
    | 'payroll'
    | 'credit_card'
    | 'loan'
    | 'other';
  display_name: string;
  currency?: string;
  balance?: number;
  metadata?: Record<string, unknown>;
}

export interface NormalizedPosition {
  vendor: string;
  external_account_id: string;
  symbol: string;
  asset_class?: 'equity' | 'fund' | 'bond' | 'option' | 'crypto' | 'other';
  quantity: number;
  cost_basis_usd?: number;
  market_value_usd?: number;
  metadata?: Record<string, unknown>;
}

export interface NormalizedTransaction {
  vendor: string;
  external_account_id: string;
  external_transaction_id: string;
  amount_usd: number;
  description?: string;
  category?: string;
  posted_at: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedPaystub {
  vendor: string;
  external_employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  gross_pay_usd: number;
  net_pay_usd: number;
  taxes_usd?: number;
  ytd_gross_usd?: number;
  metadata?: Record<string, unknown>;
}

export interface ConnectorSyncResult {
  ok: boolean;
  accounts?: NormalizedAccount[];
  positions?: NormalizedPosition[];
  transactions?: NormalizedTransaction[];
  paystubs?: NormalizedPaystub[];
  cursors?: Record<string, string>;
  errors?: Array<{ stage: string; message: string }>;
  duration_ms?: number;
  error_kind?:
    | 'not_configured'
    | 'auth_failed'
    | 'rate_limited'
    | 'bad_request'
    | 'upstream_error'
    | 'timeout';
}

// ---------------------------------------------------------------------------
// Credential shape — abstract; specific connectors define their own
// ---------------------------------------------------------------------------

export interface ConnectorCredentials {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  custom?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Base abstract
// ---------------------------------------------------------------------------

export abstract class BaseConnector {
  abstract readonly slug: string;
  abstract readonly kind: ConnectorKind;
  abstract readonly vendor: string;

  /**
   * One-shot sync — the orchestrator calls this and persists the
   * results. Subclasses MAY return partial results + errors when
   * some stages succeed and others fail.
   */
  abstract sync(
    creds: ConnectorCredentials,
    options?: { cursors?: Record<string, string> }
  ): Promise<ConnectorSyncResult>;

  // Helper for connectors that need to fetch and JSON-decode:
  protected async fetchJson<T>(
    url: string,
    init: RequestInit,
    timeoutMs = 30_000
  ): Promise<{ status: number; data: T | null }> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      let data: T | null = null;
      try {
        data = text ? (JSON.parse(text) as T) : null;
      } catch {
        /* leave raw */
      }
      return { status: res.status, data };
    } finally {
      clearTimeout(t);
    }
  }
}
