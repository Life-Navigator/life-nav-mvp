/**
 * Vanguard connector — Sprint S Phase 3.
 *
 * Vanguard does not publish a general retail OAuth API. Institutional
 * access exists through Vanguard Institutional (VIS) and aggregator
 * partnerships. This connector targets the aggregator-compatible
 * institutional shape (Akoya / Finicity tokens via Vanguard's data
 * agreements):
 *
 *   - access_token (aggregator-issued)
 *   - VANGUARD_API_BASE (default https://api.vanguard.com)
 *
 * Returns `not_configured` when credentials are absent.
 */

import { BaseConnector } from './base';
import type {
  ConnectorCredentials,
  ConnectorSyncResult,
  NormalizedAccount,
  NormalizedPosition,
} from './base';

const VANGUARD_BASE = process.env.VANGUARD_API_BASE ?? 'https://api.vanguard.com';

interface VanguardAccount {
  accountId?: string;
  accountType?: string;
  registration?: string;
  totalMarketValue?: number;
}
interface VanguardHolding {
  accountId?: string;
  ticker?: string;
  cusip?: string;
  securityType?: string;
  units?: number;
  costBasis?: number;
  marketValue?: number;
}

function mapAccountKind(t?: string): NormalizedAccount['account_kind'] {
  const s = (t ?? '').toLowerCase();
  if (/401|ira|retire|403/.test(s)) return 'retirement';
  if (/brokerag|individual|joint|trust/.test(s)) return 'brokerage';
  return 'other';
}

export class VanguardConnector extends BaseConnector {
  readonly slug = 'vanguard.aggregator';
  readonly kind = 'retirement' as const;
  readonly vendor = 'Vanguard';

  async sync(creds: ConnectorCredentials): Promise<ConnectorSyncResult> {
    if (!creds.access_token) {
      return {
        ok: false,
        error_kind: 'not_configured',
        errors: [{ stage: 'auth', message: 'missing access_token' }],
      };
    }
    const t0 = Date.now();
    const auth = { authorization: `Bearer ${creds.access_token}`, accept: 'application/json' };
    try {
      const aRes = await this.fetchJson<{ accounts?: VanguardAccount[] }>(
        `${VANGUARD_BASE}/v1/accounts`,
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
        vendor: 'Vanguard',
        external_account_id: a.accountId ?? '',
        account_kind: mapAccountKind(a.accountType),
        display_name: a.registration ?? a.accountType ?? 'Vanguard account',
        currency: 'USD',
        balance: Number(a.totalMarketValue ?? 0),
        metadata: { account_type: a.accountType },
      }));
      const hRes = await this.fetchJson<{ holdings?: VanguardHolding[] }>(
        `${VANGUARD_BASE}/v1/holdings`,
        { headers: auth }
      );
      const positions: NormalizedPosition[] = (hRes.data?.holdings ?? []).map((h) => ({
        vendor: 'Vanguard',
        external_account_id: h.accountId ?? '',
        symbol: h.ticker ?? h.cusip ?? '',
        asset_class:
          h.securityType?.toLowerCase() === 'bond'
            ? 'bond'
            : h.securityType?.toLowerCase() === 'equity'
              ? 'equity'
              : 'fund',
        quantity: Number(h.units ?? 0),
        cost_basis_usd: h.costBasis !== undefined ? Number(h.costBasis) : undefined,
        market_value_usd: h.marketValue !== undefined ? Number(h.marketValue) : undefined,
        metadata: { cusip: h.cusip },
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
