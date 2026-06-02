/**
 * ADP Workforce Now connector — Sprint P Phase 3.
 *
 * Real HTTP shape against ADP's Workforce Now / Marketplace OAuth2
 * APIs. The connector requires:
 *
 *   - access_token (from the OAuth2 authorization_code flow)
 *   - ADP_API_BASE   (default https://api.adp.com)
 *
 * Endpoints:
 *   GET /core/v1/workers          — employee directory
 *   GET /payroll/v1/payStatements — pay statements
 *
 * The connector is structurally complete; full schema mapping
 * depends on the ADP product (Workforce Now vs RUN), per the
 * registry's per-vendor `metadata`.
 */

import { BaseConnector } from './base';
import type { ConnectorCredentials, ConnectorSyncResult, NormalizedPaystub } from './base';

const ADP_BASE = process.env.ADP_API_BASE ?? 'https://api.adp.com';

interface AdpWorkerResponse {
  workers?: Array<{
    associateOID?: string;
    person?: { legalName?: { formattedName?: string } };
    workAssignments?: Array<{ assignmentStatus?: { statusCode?: { codeValue?: string } } }>;
  }>;
}
interface AdpPayStatementResponse {
  payStatements?: Array<{
    associateOID?: string;
    payStatementId?: string;
    payDate?: string;
    payPeriod?: { startDate?: string; endDate?: string };
    grossPay?: { amountValue?: number };
    netPay?: { amountValue?: number };
    totalTaxes?: { amountValue?: number };
  }>;
}

export class AdpConnector extends BaseConnector {
  readonly slug = 'adp.workforce_now';
  readonly kind = 'payroll' as const;
  readonly vendor = 'ADP';

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
      const wRes = await this.fetchJson<AdpWorkerResponse>(`${ADP_BASE}/core/v1/workers`, {
        headers: auth,
      });
      if (wRes.status === 401 || wRes.status === 403) {
        return {
          ok: false,
          error_kind: 'auth_failed',
          errors: [{ stage: 'workers', message: `http ${wRes.status}` }],
        };
      }
      const psRes = await this.fetchJson<AdpPayStatementResponse>(
        `${ADP_BASE}/payroll/v1/payStatements`,
        { headers: auth }
      );
      if (psRes.status >= 500 || psRes.status === 0) {
        return {
          ok: false,
          error_kind: 'upstream_error',
          errors: [{ stage: 'pay_statements', message: `http ${psRes.status}` }],
        };
      }
      const paystubs: NormalizedPaystub[] = (psRes.data?.payStatements ?? []).map((p) => ({
        vendor: 'ADP',
        external_employee_id: p.associateOID ?? '',
        pay_period_start: p.payPeriod?.startDate ?? p.payDate ?? '',
        pay_period_end: p.payPeriod?.endDate ?? p.payDate ?? '',
        pay_date: p.payDate ?? '',
        gross_pay_usd: Number(p.grossPay?.amountValue ?? 0),
        net_pay_usd: Number(p.netPay?.amountValue ?? 0),
        taxes_usd: Number(p.totalTaxes?.amountValue ?? 0),
        metadata: { pay_statement_id: p.payStatementId },
      }));
      return {
        ok: true,
        paystubs,
        duration_ms: Date.now() - t0,
        cursors: {},
      };
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
