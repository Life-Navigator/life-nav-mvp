/**
 * Fidelity NetBenefits / Wealthscape connector — Sprint S Phase 3.
 *
 * Fidelity does not publish a general retail OAuth API. Our integration
 * options are:
 *
 *   * Aggregator path (Plaid / Yodlee / Akoya) — preferred for retail.
 *   * Wealthscape Investor / Plan Sponsor APIs — institutional.
 *   * FIX/SOR + intraday feeds — wholesale brokerage.
 *
 * This connector targets the Wealthscape REST shape:
 *
 *   - access_token (OAuth2)
 *   - FIDELITY_API_BASE (default https://api.wealthscape.fidelity.com)
 *
 * When credentials are absent, returns `not_configured`. The path is
 * fail-loud, not silent.
 */

import { BaseConnector } from './base';
import type {
  ConnectorCredentials,
  ConnectorSyncResult,
  NormalizedAccount,
  NormalizedPosition,
} from './base';

const FIDELITY_BASE = process.env.FIDELITY_API_BASE ?? 'https://api.wealthscape.fidelity.com';

interface FidelityAccount {
  accountId?: string;
  accountType?: string;
  accountTitle?: string;
  totalValue?: number;
  currency?: string;
}
interface FidelityPosition {
  accountId?: string;
  symbol?: string;
  cusip?: string;
  assetClass?: string;
  quantity?: number;
  costBasis?: number;
  marketValue?: number;
}

function mapAccountKind(t?: string): NormalizedAccount['account_kind'] {
  const s = (t ?? '').toLowerCase();
  if (/401|ira|retire/.test(s)) return 'retirement';
  if (/hsa/.test(s)) return 'hsa';
  if (/brokerag|investment/.test(s)) return 'brokerage';
  return 'other';
}

export class FidelityConnector extends BaseConnector {
  readonly slug = 'fidelity.wealthscape';
  readonly kind = 'retirement' as const;
  readonly vendor = 'Fidelity';

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
      const acctRes = await this.fetchJson<{ accounts?: FidelityAccount[] }>(
        `${FIDELITY_BASE}/v1/accounts`,
        { headers: auth }
      );
      if (acctRes.status === 401 || acctRes.status === 403) {
        return {
          ok: false,
          error_kind: 'auth_failed',
          errors: [{ stage: 'accounts', message: `http ${acctRes.status}` }],
        };
      }
      if (acctRes.status === 429) {
        return {
          ok: false,
          error_kind: 'rate_limited',
          errors: [{ stage: 'accounts', message: 'http 429' }],
        };
      }
      if (acctRes.status >= 500 || acctRes.status === 0) {
        return {
          ok: false,
          error_kind: 'upstream_error',
          errors: [{ stage: 'accounts', message: `http ${acctRes.status}` }],
        };
      }
      const accounts: NormalizedAccount[] = (acctRes.data?.accounts ?? []).map((a) => ({
        vendor: 'Fidelity',
        external_account_id: a.accountId ?? '',
        account_kind: mapAccountKind(a.accountType),
        display_name: a.accountTitle ?? a.accountType ?? 'Fidelity account',
        currency: a.currency ?? 'USD',
        balance: Number(a.totalValue ?? 0),
        metadata: { account_type: a.accountType },
      }));

      const posRes = await this.fetchJson<{ positions?: FidelityPosition[] }>(
        `${FIDELITY_BASE}/v1/positions`,
        { headers: auth }
      );
      const positions: NormalizedPosition[] = (posRes.data?.positions ?? []).map((p) => ({
        vendor: 'Fidelity',
        external_account_id: p.accountId ?? '',
        symbol: p.symbol ?? p.cusip ?? '',
        asset_class: (p.assetClass as NormalizedPosition['asset_class']) ?? 'other',
        quantity: Number(p.quantity ?? 0),
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
