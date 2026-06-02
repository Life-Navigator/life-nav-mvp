/**
 * Charles Schwab connector — Sprint S Phase 3.
 *
 * Targets Schwab's Trader / Individual API (post-TD Ameritrade
 * migration).
 *
 *   - access_token (OAuth2, Schwab Developer Portal)
 *   - SCHWAB_API_BASE (default https://api.schwabapi.com)
 *
 * Endpoints:
 *   GET /trader/v1/accounts
 *   GET /trader/v1/accounts/{accountHash}/positions
 */

import { BaseConnector } from './base';
import type {
  ConnectorCredentials,
  ConnectorSyncResult,
  NormalizedAccount,
  NormalizedPosition,
} from './base';

const SCHWAB_BASE = process.env.SCHWAB_API_BASE ?? 'https://api.schwabapi.com';

interface SchwabAccountEnvelope {
  securitiesAccount?: {
    hashValue?: string;
    accountNumber?: string;
    type?: string;
    currentBalances?: { liquidationValue?: number; cashBalance?: number };
    positions?: Array<{
      instrument?: { symbol?: string; cusip?: string; assetType?: string };
      longQuantity?: number;
      shortQuantity?: number;
      averagePrice?: number;
      marketValue?: number;
    }>;
  };
}

export class SchwabConnector extends BaseConnector {
  readonly slug = 'schwab.trader';
  readonly kind = 'brokerage' as const;
  readonly vendor = 'Schwab';

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
      const res = await this.fetchJson<SchwabAccountEnvelope[]>(
        `${SCHWAB_BASE}/trader/v1/accounts?fields=positions`,
        { headers: auth }
      );
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          error_kind: 'auth_failed',
          errors: [{ stage: 'accounts', message: `http ${res.status}` }],
        };
      }
      if (res.status === 429) {
        return {
          ok: false,
          error_kind: 'rate_limited',
          errors: [{ stage: 'accounts', message: 'http 429' }],
        };
      }
      if (res.status >= 500 || res.status === 0) {
        return {
          ok: false,
          error_kind: 'upstream_error',
          errors: [{ stage: 'accounts', message: `http ${res.status}` }],
        };
      }
      const accounts: NormalizedAccount[] = [];
      const positions: NormalizedPosition[] = [];
      for (const envelope of res.data ?? []) {
        const sa = envelope.securitiesAccount;
        if (!sa) continue;
        const acct_id = sa.hashValue ?? sa.accountNumber ?? '';
        accounts.push({
          vendor: 'Schwab',
          external_account_id: acct_id,
          account_kind: 'brokerage',
          display_name: sa.type ?? `Schwab account ${sa.accountNumber ?? ''}`,
          currency: 'USD',
          balance: Number(sa.currentBalances?.liquidationValue ?? 0),
          metadata: { account_type: sa.type, account_number: sa.accountNumber },
        });
        for (const p of sa.positions ?? []) {
          const qty = Number(p.longQuantity ?? 0) - Number(p.shortQuantity ?? 0);
          positions.push({
            vendor: 'Schwab',
            external_account_id: acct_id,
            symbol: p.instrument?.symbol ?? p.instrument?.cusip ?? '',
            asset_class: mapAssetClass(p.instrument?.assetType),
            quantity: qty,
            cost_basis_usd:
              p.averagePrice !== undefined ? Number(p.averagePrice) * Math.abs(qty) : undefined,
            market_value_usd: p.marketValue !== undefined ? Number(p.marketValue) : undefined,
            metadata: { cusip: p.instrument?.cusip },
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

function mapAssetClass(t?: string): NormalizedPosition['asset_class'] {
  const s = (t ?? '').toUpperCase();
  if (s === 'EQUITY') return 'equity';
  if (s === 'MUTUAL_FUND' || s === 'ETF' || s === 'COLLECTIVE_INVESTMENT') return 'fund';
  if (s === 'FIXED_INCOME') return 'bond';
  if (s === 'OPTION') return 'option';
  if (s === 'CRYPTOCURRENCY') return 'crypto';
  return 'other';
}
