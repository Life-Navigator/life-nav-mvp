/**
 * Gusto connector — Sprint S Phase 3.
 *
 *   - access_token (OAuth2, Gusto Developer Portal)
 *   - GUSTO_API_BASE (default https://api.gusto.com)
 *
 * Endpoints:
 *   GET /v1/companies/{company_uuid}/employees
 *   GET /v1/companies/{company_uuid}/payrolls?processing_statuses=processed
 */

import { BaseConnector } from './base';
import type { ConnectorCredentials, ConnectorSyncResult, NormalizedPaystub } from './base';

const GUSTO_BASE = process.env.GUSTO_API_BASE ?? 'https://api.gusto.com';

interface GustoPayroll {
  payroll_uuid?: string;
  check_date?: string;
  pay_period?: { start_date?: string; end_date?: string };
  employee_compensations?: Array<{
    employee_uuid?: string;
    gross_pay?: string;
    net_pay?: string;
    payment_method?: string;
    taxes?: Array<{ amount?: string }>;
  }>;
}

export class GustoConnector extends BaseConnector {
  readonly slug = 'gusto.payroll';
  readonly kind = 'payroll' as const;
  readonly vendor = 'Gusto';

  async sync(creds: ConnectorCredentials): Promise<ConnectorSyncResult> {
    const company_uuid = creds.custom?.company_uuid;
    if (!creds.access_token || !company_uuid) {
      return {
        ok: false,
        error_kind: 'not_configured',
        errors: [{ stage: 'auth', message: 'missing access_token or company_uuid' }],
      };
    }
    const t0 = Date.now();
    const auth = {
      authorization: `Bearer ${creds.access_token}`,
      accept: 'application/json',
      'X-Gusto-API-Version': '2024-04-01',
    };
    try {
      const url = `${GUSTO_BASE}/v1/companies/${encodeURIComponent(company_uuid)}/payrolls?processing_statuses=processed&include=taxes`;
      const res = await this.fetchJson<GustoPayroll[]>(url, { headers: auth });
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          error_kind: 'auth_failed',
          errors: [{ stage: 'payrolls', message: `http ${res.status}` }],
        };
      }
      if (res.status === 429) {
        return {
          ok: false,
          error_kind: 'rate_limited',
          errors: [{ stage: 'payrolls', message: 'http 429' }],
        };
      }
      if (res.status >= 500 || res.status === 0) {
        return {
          ok: false,
          error_kind: 'upstream_error',
          errors: [{ stage: 'payrolls', message: `http ${res.status}` }],
        };
      }
      const paystubs: NormalizedPaystub[] = [];
      for (const p of res.data ?? []) {
        for (const c of p.employee_compensations ?? []) {
          paystubs.push({
            vendor: 'Gusto',
            external_employee_id: c.employee_uuid ?? '',
            pay_period_start: p.pay_period?.start_date ?? p.check_date ?? '',
            pay_period_end: p.pay_period?.end_date ?? p.check_date ?? '',
            pay_date: p.check_date ?? '',
            gross_pay_usd: Number(c.gross_pay ?? 0),
            net_pay_usd: Number(c.net_pay ?? 0),
            taxes_usd: (c.taxes ?? []).reduce((s, t) => s + Number(t.amount ?? 0), 0),
            metadata: {
              payroll_uuid: p.payroll_uuid,
              company_uuid,
              payment_method: c.payment_method,
            },
          });
        }
      }
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
