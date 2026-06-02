/**
 * Morgan Stanley connector — Sprint S Phase 3.
 *
 * Targets the Morgan Stanley Wealth Management Advisor API (institutional
 * Wealth-Sciences platform; not retail).
 *
 *   - access_token (OAuth2)
 *   - MORGAN_STANLEY_API_BASE (default https://api.morganstanley.com)
 *
 * Endpoints:
 *   GET /wealth/v1/accounts
 *   GET /wealth/v1/accounts/{accountId}/holdings
 */

import { BaseConnector } from './base';
import type {
  ConnectorCredentials,
  ConnectorSyncResult,
  NormalizedAccount,
  NormalizedPosition,
} from './base';

const MS_BASE = process.env.MORGAN_STANLEY_API_BASE ?? 'https://api.morganstanley.com';

interface MsAccount {
  accountId?: string;
  accountNickname?: string;
  accountType?: string;
  totalValue?: number;
}
interface MsHolding {
  accountId?: string;
  symbol?: string;
  cusip?: string;
  assetCategory?: string;
  quantity?: number;
  costBasis?: number;
  marketValue?: number;
}

function mapAccountKind(t?: string): NormalizedAccount['account_kind'] {
  const s = (t ?? '').toLowerCase();
  if (/401|ira|retire/.test(s)) return 'retirement';
  if (/check/.test(s)) return 'checking';
  if (/saving/.test(s)) return 'savings';
  if (/brokerag|advisory|investment/.test(s)) return 'brokerage';
  return 'other';
}

function mapAsset(t?: string): NormalizedPosition['asset_class'] {
  const s = (t ?? '').toLowerCase();
  if (s.includes('equity')) return 'equity';
  if (s.includes('fund') || s.includes('etf')) return 'fund';
  if (s.includes('fixed') || s.includes('bond')) return 'bond';
  if (s.includes('option')) return 'option';
  if (s.includes('crypto')) return 'crypto';
  return 'other';
}

export class MorganStanleyConnector extends BaseConnector {
  readonly slug = 'morgan_stanley.wealth';
  readonly kind = 'brokerage' as const;
  readonly vendor = 'Morgan Stanley';

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
      const aRes = await this.fetchJson<{ accounts?: MsAccount[] }>(
        `${MS_BASE}/wealth/v1/accounts`,
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
        vendor: 'Morgan Stanley',
        external_account_id: a.accountId ?? '',
        account_kind: mapAccountKind(a.accountType),
        display_name: a.accountNickname ?? a.accountType ?? 'Morgan Stanley account',
        currency: 'USD',
        balance: Number(a.totalValue ?? 0),
        metadata: { account_type: a.accountType },
      }));
      const positions: NormalizedPosition[] = [];
      for (const a of aRes.data?.accounts ?? []) {
        if (!a.accountId) continue;
        const hRes = await this.fetchJson<{ holdings?: MsHolding[] }>(
          `${MS_BASE}/wealth/v1/accounts/${encodeURIComponent(a.accountId)}/holdings`,
          { headers: auth }
        );
        for (const h of hRes.data?.holdings ?? []) {
          positions.push({
            vendor: 'Morgan Stanley',
            external_account_id: a.accountId,
            symbol: h.symbol ?? h.cusip ?? '',
            asset_class: mapAsset(h.assetCategory),
            quantity: Number(h.quantity ?? 0),
            cost_basis_usd: h.costBasis !== undefined ? Number(h.costBasis) : undefined,
            market_value_usd: h.marketValue !== undefined ? Number(h.marketValue) : undefined,
            metadata: { cusip: h.cusip, asset_category: h.assetCategory },
          });
        }
      }
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
