/**
 * Empower (formerly Personal Capital / Empower Retirement) connector
 *  — Sprint S Phase 3.
 *
 * Targets Empower's institutional / recordkeeper API.
 *
 *   - access_token (OAuth2)
 *   - EMPOWER_API_BASE (default https://api.empower.com)
 *
 * Endpoints:
 *   GET /v1/participants/{participantId}/accounts
 *   GET /v1/participants/{participantId}/positions
 */

import { BaseConnector } from './base';
import type {
  ConnectorCredentials,
  ConnectorSyncResult,
  NormalizedAccount,
  NormalizedPosition,
} from './base';

const EMPOWER_BASE = process.env.EMPOWER_API_BASE ?? 'https://api.empower.com';

interface EmpowerAccount {
  accountId?: string;
  planType?: string;
  planName?: string;
  balance?: number;
}
interface EmpowerPosition {
  accountId?: string;
  investmentTicker?: string;
  cusip?: string;
  units?: number;
  costBasis?: number;
  marketValue?: number;
}

export class EmpowerConnector extends BaseConnector {
  readonly slug = 'empower.retirement';
  readonly kind = 'retirement' as const;
  readonly vendor = 'Empower';

  async sync(creds: ConnectorCredentials): Promise<ConnectorSyncResult> {
    const participant_id = creds.custom?.participant_id;
    if (!creds.access_token || !participant_id) {
      return {
        ok: false,
        error_kind: 'not_configured',
        errors: [{ stage: 'auth', message: 'missing access_token or participant_id' }],
      };
    }
    const t0 = Date.now();
    const auth = { authorization: `Bearer ${creds.access_token}`, accept: 'application/json' };
    try {
      const aRes = await this.fetchJson<{ accounts?: EmpowerAccount[] }>(
        `${EMPOWER_BASE}/v1/participants/${encodeURIComponent(participant_id)}/accounts`,
        { headers: auth }
      );
      if (aRes.status === 401 || aRes.status === 403) {
        return {
          ok: false,
          error_kind: 'auth_failed',
          errors: [{ stage: 'accounts', message: `http ${aRes.status}` }],
        };
      }
      if (aRes.status === 429) {
        return {
          ok: false,
          error_kind: 'rate_limited',
          errors: [{ stage: 'accounts', message: 'http 429' }],
        };
      }
      if (aRes.status >= 500 || aRes.status === 0) {
        return {
          ok: false,
          error_kind: 'upstream_error',
          errors: [{ stage: 'accounts', message: `http ${aRes.status}` }],
        };
      }
      const accounts: NormalizedAccount[] = (aRes.data?.accounts ?? []).map((a) => ({
        vendor: 'Empower',
        external_account_id: a.accountId ?? '',
        account_kind: 'retirement' as const,
        display_name: a.planName ?? a.planType ?? 'Empower plan',
        currency: 'USD',
        balance: Number(a.balance ?? 0),
        metadata: { plan_type: a.planType, participant_id },
      }));
      const pRes = await this.fetchJson<{ positions?: EmpowerPosition[] }>(
        `${EMPOWER_BASE}/v1/participants/${encodeURIComponent(participant_id)}/positions`,
        { headers: auth }
      );
      const positions: NormalizedPosition[] = (pRes.data?.positions ?? []).map((p) => ({
        vendor: 'Empower',
        external_account_id: p.accountId ?? '',
        symbol: p.investmentTicker ?? p.cusip ?? '',
        asset_class: 'fund',
        quantity: Number(p.units ?? 0),
        cost_basis_usd: p.costBasis !== undefined ? Number(p.costBasis) : undefined,
        market_value_usd: p.marketValue !== undefined ? Number(p.marketValue) : undefined,
        metadata: { cusip: p.cusip },
      }));
      return { ok: true, accounts, positions, duration_ms: Date.now() - t0, cursors: {} };
    } catch (e) {
      return {
        ok: false,
        error_kind: 'upstream_error',
        errors: [{ stage: 'fetch', message: e instanceof Error ? e.message : 'unknown' }],
        duration_ms: Date.now() - t0,
      };
    }
  }
}
