# Connector Framework Expansion

Sprint S Phase 3 deliverable.

## Mission

Take the Sprint P connector framework — `BaseConnector` + `ADP` —
and complete the production set of payroll, brokerage, and retirement
vendors so an enterprise tenant can connect its real systems with
real data, not mocks.

## What ships

Seven production connector classes, each implementing the same
`BaseConnector` contract:

| Slug                    | Vendor         | Kind       | Required credentials                     |
| ----------------------- | -------------- | ---------- | ---------------------------------------- |
| `paychex.flex`          | Paychex        | payroll    | `access_token` + `custom.company_id`     |
| `gusto.payroll`         | Gusto          | payroll    | `access_token` + `custom.company_uuid`   |
| `fidelity.wealthscape`  | Fidelity       | retirement | `access_token`                           |
| `schwab.trader`         | Schwab         | brokerage  | `access_token`                           |
| `vanguard.aggregator`   | Vanguard       | retirement | `access_token`                           |
| `empower.retirement`    | Empower        | retirement | `access_token` + `custom.participant_id` |
| `morgan_stanley.wealth` | Morgan Stanley | brokerage  | `access_token`                           |

Plus the Sprint P ADP connector (`adp.workforce_now`) = **8 total**
in the registry.

## The fail-loud contract

Every connector implements the same contract:

```ts
async sync(creds: ConnectorCredentials): Promise<ConnectorSyncResult>
```

**Without credentials → `{ ok: false, error_kind: 'not_configured' }`.**

This is the single most important property of the framework. A
connector that lacks credentials NEVER returns a successful empty
result. It returns the explicit `not_configured` failure so that
nothing downstream can mistake "we don't have an integration"
for "the user has no accounts."

```ts
test('Schwab without access_token', async () => {
  const r = await new SchwabConnector().sync({});
  expect(r.error_kind).toBe('not_configured');
});
```

## Why each vendor matters

### Payroll: ADP, Paychex, Gusto

These three cover the bulk of US small-and-mid-market payroll. Once
a tenant connects its payroll provider, LifeNavigator can:

- Verify income for goal-setting that depends on take-home pay.
- Pull paystubs that feed the financial-projection engine.
- Power "your 401(k) contribution rate" recommendations without
  asking the user to type numbers.

### Brokerage: Schwab, Morgan Stanley

The two flagship retail + advisory brokerages. After the TD
Ameritrade migration, Schwab is the single largest retail brokerage;
Morgan Stanley is the canonical advisory tier.

- Positions feed the financial graph.
- Cost basis informs tax-aware recommendations.
- Holdings let Scenario Lab simulate "what if you rebalance?"

### Retirement: Fidelity, Vanguard, Empower

Three of the largest recordkeepers / asset managers in the US 401(k)
market. Most US employees with a workplace retirement plan have an
account at one of these three.

- Plan balance + holdings feed the retirement-readiness model.
- Vesting schedules and employer-match data inform compensation
  optimization.

## Data flow

```
                  ┌─────────────────────────────────────────────┐
                  │  Sprint P connector orchestrator            │
                  │  (per-user sync schedule, RLS-gated)        │
                  └───────────────────┬─────────────────────────┘
                                      │
                                      ▼
                  ┌─────────────────────────────────────────────┐
                  │  getConnector(slug) → BaseConnector instance│
                  │  (CONNECTOR_REGISTRY)                       │
                  └───────────────────┬─────────────────────────┘
                                      │
                                      ▼
                  ┌─────────────────────────────────────────────┐
                  │  Connector.sync(creds, { cursors })         │
                  │   • call vendor HTTP                        │
                  │   • normalize to NormalizedAccount /        │
                  │     NormalizedPosition / NormalizedPaystub  │
                  │   • return ConnectorSyncResult              │
                  └───────────────────┬─────────────────────────┘
                                      │
                                      ▼
                  ┌─────────────────────────────────────────────┐
                  │  Persist into Personal GraphRAG             │
                  │  + Sprint S projection-aware enrichment     │
                  └─────────────────────────────────────────────┘
```

## Error taxonomy

Every connector emits one of:

| `error_kind`     | Meaning                                                   |
| ---------------- | --------------------------------------------------------- |
| `not_configured` | Required credentials missing — fail loud, do not retry    |
| `auth_failed`    | Vendor rejected the token (401 / 403) — user must re-auth |
| `rate_limited`   | Vendor 429 — orchestrator backs off                       |
| `bad_request`    | Vendor 4xx other than auth — log + alert                  |
| `upstream_error` | 5xx or network failure — retryable                        |
| `timeout`        | Local 30s timeout                                         |

The orchestrator decides whether to retry, prompt the user, or page
the operator based on this taxonomy.

## Normalized output

Every connector converts vendor-specific shapes into the shared
normalized records defined in `base.ts`:

- `NormalizedAccount` — checking / savings / brokerage / retirement / hsa / payroll / credit_card / loan / other
- `NormalizedPosition` — equity / fund / bond / option / crypto / other
- `NormalizedTransaction` — amount, posted date, description
- `NormalizedPaystub` — gross, net, taxes, YTD, pay period

This means the rest of the platform only ever reads from the
normalized shape. Connector implementation details never leak into
the graph schema or the recommendation engine.

## Account-kind classification

Several connectors infer the `account_kind` from vendor-specific
account-type strings:

| Connector             | Classifier logic                            |
| --------------------- | ------------------------------------------- | --- | ----------------------------------------------------------------------- | ---------------------------- | ---------- | ----- | ------------------- |
| Fidelity              | `/401                                       | ira | retire/`→ retirement;`/hsa/`→ hsa;`/brokerag                            | investment/` → brokerage     |
| Vanguard              | `/401                                       | ira | retire                                                                  | 403/`→ retirement;`/brokerag | individual | joint | trust/` → brokerage |
| Empower               | hard-coded to `retirement` (recordkeeper)   |
| Morgan Stanley        | `/401                                       | ira | retire/`→ retirement;`/check/`→ checking;`/saving/`→ savings;`/brokerag | advisory/` → brokerage       |
| Schwab                | hard-coded to `brokerage` (Trader API only) |
| Paychex / Gusto / ADP | N/A — emit paystubs only                    |

## Asset-class mapping

Brokerage / retirement connectors map vendor asset-type strings to
the normalized asset_class:

```ts
function mapAssetClass(t?: string): NormalizedPosition['asset_class'] {
  const s = (t ?? '').toUpperCase();
  if (s === 'EQUITY') return 'equity';
  if (s === 'MUTUAL_FUND' || s === 'ETF' || s === 'COLLECTIVE_INVESTMENT') return 'fund';
  if (s === 'FIXED_INCOME') return 'bond';
  if (s === 'OPTION') return 'option';
  if (s === 'CRYPTOCURRENCY') return 'crypto';
  return 'other';
}
```

The downstream financial model treats these uniformly; no callsite
has to know that Schwab uses `EQUITY` and Vanguard uses `Equity`.

## Vendor-specific notes

### Paychex

Path: `/companies/{companyId}/workerpaystubs`. Requires a
client-credentials OAuth2 token obtained against the Paychex
Developer Portal. The company_id is the Paychex-issued company
identifier, not the tenant's chosen name.

### Gusto

Path: `/v1/companies/{company_uuid}/payrolls?processing_statuses=processed`.
Includes the `X-Gusto-API-Version: 2024-04-01` header — Gusto pins
behavior per API version. The connector aggregates per-employee
compensation rows from each processed payroll into normalized
paystubs.

### Fidelity (Wealthscape)

Fidelity does not publish a general retail OAuth API. The connector
targets the Wealthscape institutional API. For retail users, the
orchestrator falls back to an aggregator path (Plaid / Akoya /
Finicity), wired separately.

### Schwab (Trader API)

Post-TD Ameritrade migration. The Trader v1 API exposes
`securitiesAccount` envelopes; we accept the `accountHash` (preferred)
or `accountNumber` as the external_account_id. Quantities are computed
as `longQuantity - shortQuantity` so short positions carry negative
quantity into the graph.

### Vanguard

Vanguard does not publish a general retail OAuth API. The connector
targets the aggregator-compatible institutional shape (Akoya /
Finicity tokens via Vanguard's data agreements). Retail tenants use
the aggregator path.

### Empower

Path: `/v1/participants/{participantId}/...`. Requires the
participant_id alongside the access_token because the API is
participant-scoped. All accounts are classified as `retirement`.

### Morgan Stanley

The Wealth Advisor API requires per-account follow-up calls for
holdings. The connector fetches accounts first, then iterates
accounts to pull holdings. Use this in batch mode — not per-request.

## Registry + lookup

```ts
import { getConnector, CONNECTOR_REGISTRY } from '@/lib/connectors';

const conn = getConnector('schwab.trader');
if (!conn) throw new Error('unknown slug');
const result = await conn.sync({ access_token: token });
```

`CONNECTOR_REGISTRY` is the single source of truth for "which
connectors does this build know about?" Adding a new connector is:

1. Implement `BaseConnector` in `apps/web/src/lib/connectors/<vendor>.ts`.
2. Add it to `CONNECTOR_REGISTRY` in `index.ts`.
3. Add fail-loud `not_configured` test.
4. Add happy-path test that exercises one normalized record.

## Test coverage

```
$ npx jest src/lib/connectors
PASS — 21 tests
```

Tested properties:

1. Registry contains all 8 slugs.
2. Each connector returns `not_configured` when its required
   credentials are absent.
3. Auth-failed (401 / 403) and rate-limited (429) propagate.
4. Happy path normalizes vendor responses into the shared shapes.
5. Account-kind classification on Fidelity / Vanguard maps 401(k) /
   IRA → `retirement`.
6. Schwab computes signed net quantity from long minus short.

## What ships, what's deferred

Shipped:

- All 7 connector classes with the standard HTTP shape per vendor.
- Registry + factory + error taxonomy.
- Test coverage of the fail-loud + happy-path properties.

Deferred (operator-driven, not in this sprint):

- Aggregator-fallback path for the retail variants of Fidelity /
  Vanguard (Plaid / Akoya). The connectors are structured to accept
  aggregator-issued access tokens; the routing decision sits in the
  orchestrator.
- OAuth code-exchange routes for each vendor. The connectors accept
  tokens; obtaining them via the vendor's authorization-code flow
  is per-tenant operator wiring.
- Per-vendor cursor logic. Each connector returns `cursors: {}`
  today. Incremental sync is a Sprint S+ refinement.

## Files

| File                                            | Purpose                           |
| ----------------------------------------------- | --------------------------------- |
| `apps/web/src/lib/connectors/base.ts`           | BaseConnector + normalized shapes |
| `apps/web/src/lib/connectors/adp.ts`            | Sprint P                          |
| `apps/web/src/lib/connectors/paychex.ts`        | Paychex Flex                      |
| `apps/web/src/lib/connectors/gusto.ts`          | Gusto Payroll                     |
| `apps/web/src/lib/connectors/fidelity.ts`       | Fidelity Wealthscape              |
| `apps/web/src/lib/connectors/schwab.ts`         | Schwab Trader                     |
| `apps/web/src/lib/connectors/vanguard.ts`       | Vanguard aggregator               |
| `apps/web/src/lib/connectors/empower.ts`        | Empower Retirement                |
| `apps/web/src/lib/connectors/morgan_stanley.ts` | Morgan Stanley Wealth             |
| `apps/web/src/lib/connectors/index.ts`          | Registry + getConnector           |

## Acceptance — Sprint S Phase 3

| Requirement                                      | Met          |
| ------------------------------------------------ | ------------ |
| Paychex connector                                | ✓            |
| Gusto connector                                  | ✓            |
| Fidelity connector                               | ✓            |
| Schwab connector                                 | ✓            |
| Vanguard connector                               | ✓            |
| Empower connector                                | ✓            |
| Morgan Stanley connector                         | ✓            |
| All return `not_configured` without creds        | ✓            |
| Registry exposes all 7 + ADP                     | ✓            |
| Tests assert the fail-loud + happy-path contract | ✓ (21 tests) |

Phase 3 complete.
