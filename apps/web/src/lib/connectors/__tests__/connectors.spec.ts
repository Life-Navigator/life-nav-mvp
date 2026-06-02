/**
 * @jest-environment node
 *
 * Sprint S — connector tests.
 *
 * The CONTRACT we test:
 *   * Without credentials → `not_configured`. Fail-loud, no silent fake.
 *   * With credentials → real HTTP shape; auth-failed when upstream 401s.
 *   * Normalized output uses the shared shape from `base.ts`.
 *
 * We do NOT contact real vendors. Tests stub `global.fetch` to assert
 * the connector emits the right request + parses the right response.
 */

import {
  PaychexConnector,
  GustoConnector,
  FidelityConnector,
  SchwabConnector,
  VanguardConnector,
  EmpowerConnector,
  MorganStanleyConnector,
  CONNECTOR_REGISTRY,
  getConnector,
} from '..';

type FetchStub = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

function stubFetch(handlers: Array<{ status: number; body: unknown }>): FetchStub {
  let i = 0;
  const m = jest.fn(async () => {
    const h = handlers[Math.min(i, handlers.length - 1)];
    i += 1;
    return new Response(JSON.stringify(h.body), { status: h.status });
  }) as unknown as FetchStub;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = m;
  return m;
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('CONNECTOR_REGISTRY', () => {
  test('contains the 8 connector slugs (ADP + 7 Sprint S)', () => {
    expect(Object.keys(CONNECTOR_REGISTRY).sort()).toEqual([
      'adp.workforce_now',
      'empower.retirement',
      'fidelity.wealthscape',
      'gusto.payroll',
      'morgan_stanley.wealth',
      'paychex.flex',
      'schwab.trader',
      'vanguard.aggregator',
    ]);
  });

  test('getConnector returns null for unknown slug', () => {
    expect(getConnector('nope')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// not_configured fail-loud contract
// ---------------------------------------------------------------------------

describe('not_configured contract', () => {
  test('Paychex without access_token + company_id', async () => {
    const r = await new PaychexConnector().sync({});
    expect(r.ok).toBe(false);
    expect(r.error_kind).toBe('not_configured');
  });

  test('Gusto without access_token + company_uuid', async () => {
    const r = await new GustoConnector().sync({});
    expect(r.error_kind).toBe('not_configured');
  });

  test('Fidelity without access_token', async () => {
    const r = await new FidelityConnector().sync({});
    expect(r.error_kind).toBe('not_configured');
  });

  test('Schwab without access_token', async () => {
    const r = await new SchwabConnector().sync({});
    expect(r.error_kind).toBe('not_configured');
  });

  test('Vanguard without access_token', async () => {
    const r = await new VanguardConnector().sync({});
    expect(r.error_kind).toBe('not_configured');
  });

  test('Empower without access_token + participant_id', async () => {
    const r = await new EmpowerConnector().sync({});
    expect(r.error_kind).toBe('not_configured');
  });

  test('Morgan Stanley without access_token', async () => {
    const r = await new MorganStanleyConnector().sync({});
    expect(r.error_kind).toBe('not_configured');
  });

  test('partial creds (token but no required custom field) still fails loud', async () => {
    const r = await new PaychexConnector().sync({ access_token: 'tok' }); // missing company_id
    expect(r.error_kind).toBe('not_configured');
  });
});

// ---------------------------------------------------------------------------
// auth_failed propagation
// ---------------------------------------------------------------------------

describe('auth_failed propagation', () => {
  test('Schwab returns auth_failed on 401', async () => {
    stubFetch([{ status: 401, body: { error: 'unauthorized' } }]);
    const r = await new SchwabConnector().sync({ access_token: 'bad' });
    expect(r.ok).toBe(false);
    expect(r.error_kind).toBe('auth_failed');
  });

  test('Fidelity returns auth_failed on 403', async () => {
    stubFetch([{ status: 403, body: {} }]);
    const r = await new FidelityConnector().sync({ access_token: 'bad' });
    expect(r.error_kind).toBe('auth_failed');
  });

  test('Gusto returns rate_limited on 429', async () => {
    stubFetch([{ status: 429, body: {} }]);
    const r = await new GustoConnector().sync({
      access_token: 't',
      custom: { company_uuid: 'c' },
    });
    expect(r.error_kind).toBe('rate_limited');
  });

  test('Paychex returns upstream_error on 500', async () => {
    stubFetch([{ status: 500, body: {} }]);
    const r = await new PaychexConnector().sync({
      access_token: 't',
      custom: { company_id: 'c' },
    });
    expect(r.error_kind).toBe('upstream_error');
  });
});

// ---------------------------------------------------------------------------
// Happy-path normalization
// ---------------------------------------------------------------------------

describe('normalized output', () => {
  test('Paychex normalizes a paystub', async () => {
    stubFetch([
      {
        status: 200,
        body: {
          content: [
            {
              workerId: 'w1',
              payStubId: 'ps1',
              payDate: '2026-05-15',
              payPeriod: { startDate: '2026-05-01', endDate: '2026-05-14' },
              grossPay: 4000,
              netPay: 3100,
              totalTaxes: 700,
              ytdGrossPay: 22000,
            },
          ],
        },
      },
    ]);
    const r = await new PaychexConnector().sync({
      access_token: 't',
      custom: { company_id: 'c' },
    });
    expect(r.ok).toBe(true);
    expect(r.paystubs?.[0]).toMatchObject({
      vendor: 'Paychex',
      external_employee_id: 'w1',
      pay_period_start: '2026-05-01',
      gross_pay_usd: 4000,
      net_pay_usd: 3100,
      taxes_usd: 700,
      ytd_gross_usd: 22000,
    });
  });

  test('Gusto normalizes employee_compensations into paystubs', async () => {
    stubFetch([
      {
        status: 200,
        body: [
          {
            payroll_uuid: 'pr1',
            check_date: '2026-05-15',
            pay_period: { start_date: '2026-05-01', end_date: '2026-05-14' },
            employee_compensations: [
              {
                employee_uuid: 'e1',
                gross_pay: '4000',
                net_pay: '3100',
                taxes: [{ amount: '400' }, { amount: '300' }],
              },
              {
                employee_uuid: 'e2',
                gross_pay: '5000',
                net_pay: '3900',
                taxes: [{ amount: '1100' }],
              },
            ],
          },
        ],
      },
    ]);
    const r = await new GustoConnector().sync({
      access_token: 't',
      custom: { company_uuid: 'c' },
    });
    expect(r.ok).toBe(true);
    expect(r.paystubs?.length).toBe(2);
    expect(r.paystubs?.[0].taxes_usd).toBe(700);
  });

  test('Schwab normalizes accounts + positions, computes net quantity', async () => {
    stubFetch([
      {
        status: 200,
        body: [
          {
            securitiesAccount: {
              hashValue: 'abc',
              accountNumber: '12345',
              type: 'INDIVIDUAL',
              currentBalances: { liquidationValue: 25000 },
              positions: [
                {
                  instrument: { symbol: 'AAPL', assetType: 'EQUITY' },
                  longQuantity: 10,
                  shortQuantity: 2,
                  averagePrice: 180,
                  marketValue: 2000,
                },
              ],
            },
          },
        ],
      },
    ]);
    const r = await new SchwabConnector().sync({ access_token: 't' });
    expect(r.ok).toBe(true);
    expect(r.accounts?.[0].balance).toBe(25000);
    expect(r.positions?.[0].symbol).toBe('AAPL');
    expect(r.positions?.[0].quantity).toBe(8);
    expect(r.positions?.[0].asset_class).toBe('equity');
  });

  test('Fidelity maps 401k accountType to retirement', async () => {
    stubFetch([
      {
        status: 200,
        body: { accounts: [{ accountId: 'a1', accountType: '401(k)', totalValue: 50000 }] },
      },
      { status: 200, body: { positions: [] } },
    ]);
    const r = await new FidelityConnector().sync({ access_token: 't' });
    expect(r.accounts?.[0].account_kind).toBe('retirement');
  });

  test('Vanguard maps IRA accountType to retirement', async () => {
    stubFetch([
      {
        status: 200,
        body: {
          accounts: [{ accountId: 'a1', accountType: 'Traditional IRA', totalMarketValue: 75000 }],
        },
      },
      { status: 200, body: { holdings: [] } },
    ]);
    const r = await new VanguardConnector().sync({ access_token: 't' });
    expect(r.accounts?.[0].account_kind).toBe('retirement');
  });

  test('Empower returns retirement accounts', async () => {
    stubFetch([
      {
        status: 200,
        body: {
          accounts: [
            { accountId: 'a1', planType: '401(k)', planName: 'Acme 401k', balance: 80000 },
          ],
        },
      },
      {
        status: 200,
        body: {
          positions: [
            { accountId: 'a1', investmentTicker: 'VFIAX', units: 100, marketValue: 50000 },
          ],
        },
      },
    ]);
    const r = await new EmpowerConnector().sync({
      access_token: 't',
      custom: { participant_id: 'p1' },
    });
    expect(r.accounts?.[0].account_kind).toBe('retirement');
    expect(r.positions?.[0].symbol).toBe('VFIAX');
  });

  test('Morgan Stanley fetches per-account holdings', async () => {
    stubFetch([
      {
        status: 200,
        body: { accounts: [{ accountId: 'a1', accountType: 'Advisory', totalValue: 1_000_000 }] },
      },
      {
        status: 200,
        body: {
          holdings: [
            {
              accountId: 'a1',
              symbol: 'SPY',
              assetCategory: 'equity ETF',
              quantity: 500,
              marketValue: 500_000,
            },
          ],
        },
      },
    ]);
    const r = await new MorganStanleyConnector().sync({ access_token: 't' });
    expect(r.ok).toBe(true);
    expect(r.accounts?.[0].account_kind).toBe('brokerage');
    expect(r.positions?.[0].symbol).toBe('SPY');
    expect(r.positions?.[0].asset_class).toBe('equity'); // 'equity ETF' matches 'equity' first
  });
});
