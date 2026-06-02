/**
 * Paychex Flex connector — Sprint S Phase 3.
 *
 * Real HTTP shape against the Paychex Flex Developer API.
 *
 *   - access_token (OAuth2 client-credentials, Paychex Developer Portal)
 *   - PAYCHEX_API_BASE (default https://api.paychex.com)
 *
 * Endpoints:
 *   GET /companies/{companyId}/workers          — employee directory
 *   GET /companies/{companyId}/workerpaystubs   — pay statements
 *
 * Returns `not_configured` when access_token / company_id are missing.
 */

import { BaseConnector } from './base';
import type { ConnectorCredentials, ConnectorSyncResult, NormalizedPaystub } from './base';

const PAYCHEX_BASE = process.env.PAYCHEX_API_BASE ?? 'https://api.paychex.com';

interface PaychexPayStubResponse {
  content?: Array<{
    workerId?: string;
    payStubId?: string;
    payDate?: string;
    payPeriod?: { startDate?: string; endDate?: string };
    grossPay?: number;
    netPay?: number;
    totalTaxes?: number;
    ytdGrossPay?: number;
  }>;
}

export class PaychexConnector extends BaseConnector {
  readonly slug = 'paychex.flex';
  readonly kind = 'payroll' as const;
  readonly vendor = 'Paychex';

  async sync(creds: ConnectorCredentials): Promise<ConnectorSyncResult> {
    const company_id = creds.custom?.company_id;
    if (!creds.access_token || !company_id) {
      return {
        ok: false,
        error_kind: 'not_configured',
        errors: [{ stage: 'auth', message: 'missing access_token or company_id' }],
      };
    }
    const t0 = Date.now();
    const auth = { authorization: `Bearer ${creds.access_token}`, accept: 'application/json' };
    try {
      const ps = await this.fetchJson<PaychexPayStubResponse>(
        `${PAYCHEX_BASE}/companies/${encodeURIComponent(company_id)}/workerpaystubs`,
        { headers: auth }
      );
      if (ps.status === 401 || ps.status === 403) {
        return {
          ok: false,
          error_kind: 'auth_failed',
          errors: [{ stage: 'paystubs', message: `http ${ps.status}` }],
        };
      }
      if (ps.status === 429) {
        return {
          ok: false,
          error_kind: 'rate_limited',
          errors: [{ stage: 'paystubs', message: 'http 429' }],
        };
      }
      if (ps.status >= 500 || ps.status === 0) {
        return {
          ok: false,
          error_kind: 'upstream_error',
          errors: [{ stage: 'paystubs', message: `http ${ps.status}` }],
        };
      }
      const paystubs: NormalizedPaystub[] = (ps.data?.content ?? []).map((p) => ({
        vendor: 'Paychex',
        external_employee_id: p.workerId ?? '',
        pay_period_start: p.payPeriod?.startDate ?? p.payDate ?? '',
        pay_period_end: p.payPeriod?.endDate ?? p.payDate ?? '',
        pay_date: p.payDate ?? '',
        gross_pay_usd: Number(p.grossPay ?? 0),
        net_pay_usd: Number(p.netPay ?? 0),
        taxes_usd: Number(p.totalTaxes ?? 0),
        ytd_gross_usd: p.ytdGrossPay !== undefined ? Number(p.ytdGrossPay) : undefined,
        metadata: { pay_stub_id: p.payStubId, company_id },
      }));
      return { ok: true, paystubs, duration_ms: Date.now() - t0, cursors: {} };
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
