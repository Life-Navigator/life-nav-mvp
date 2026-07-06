# Enterprise Foundation & API Platform

Sprint P deliverable.

## 1. What ships

| Surface                                                                                                                              | Where                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Migration 093                                                                                                                        | `supabase/migrations/093_enterprise_foundation.sql` — `platform.*` + `connectors.*` + `models.*` schemas |
| 12 seeded connectors (ADP / Paychex / Gusto / Fidelity / Schwab / Vanguard / Empower / Morgan Stanley / 3 Plaid surfaces / mock dev) | `connectors.connector_registry` seed                                                                     |
| 11 seeded BYOM models (Gemini × 4, OpenAI × 3, Anthropic × 2, Azure × 2)                                                             | `models.model_registry` seed                                                                             |
| Tenant types                                                                                                                         | `apps/web/src/types/platform.ts`                                                                         |
| API key generation + sha256 hashing                                                                                                  | `apps/web/src/lib/tenant/api-keys.ts`                                                                    |
| Tenant API gateway (resolve + meter + in-memory rate-limit)                                                                          | `apps/web/src/lib/tenant/api-gateway.ts`                                                                 |
| BYOM `ModelProvider` interface + 4 real provider classes                                                                             | `apps/web/src/lib/models/**`                                                                             |
| Connector framework (`BaseConnector`) + ADP HTTP adapter                                                                             | `apps/web/src/lib/connectors/**`                                                                         |
| Platform API routes                                                                                                                  | `apps/web/src/app/api/platform/**`                                                                       |
| Connector + model registry routes                                                                                                    | `apps/web/src/app/api/connectors/route.ts`, `/api/models/route.ts`                                       |
| Tests                                                                                                                                | 16 gateway tests + 11 BYOM tests = 27 new                                                                |

## 2. Tenant architecture

`platform.tenants` supports three isolation modes:

| Isolation   | Use case                                                              | Constitutional graph                        |
| ----------- | --------------------------------------------------------------------- | ------------------------------------------- |
| `shared`    | Default. Consumer + dev cohorts.                                      | Shared (governance.constitutional_entities) |
| `industry`  | Employer / Arcana / partner customers grouped by NAICS.               | Industry overlay graph                      |
| `dedicated` | Enterprise customers with custom regulatory + retention requirements. | Customer-dedicated graph                    |

`platform.tenant_users` links users to tenants with roles `owner | admin | operator | viewer`. The `platform.is_tenant_member(tenant_id, user_id, min_role)` SECURITY DEFINER function is the gate behind every RLS policy that scopes to tenant.

## 3. API platform

### 3.1 Key format

```
lnk_<env>_<32 base62 chars>
e.g. lnk_live_4nQy9JD3mLnpVTFx8R7kAcZsKEh2Wq6X
```

The first 12 chars are the indexed `prefix` (`lnk_live_xxx`). The full key is sha256-hashed and stored as `key_hash`. The plain key is shown to the operator **once** at creation; never thereafter.

### 3.2 Gateway

Every `/api/platform/**` route MAY call:

```ts
const ctx = await resolveApiKey(supabase, request);
if (!ctx.ok) return ctx.response; // 401
const rl = checkRateLimit(ctx.tenant_id, 600);
if (!rl.ok)
  return NextResponse.json({ error: 'rate_limited', reset_at: rl.reset_at }, { status: 429 });
// ... do work
await meterUsage(supabase, ctx, { route_path, method, status_code, latency_ms, cost_usd_micros });
```

The token-bucket limiter is per-tenant + per-minute, in-process. Durable daily limits live in `platform.tenant_quotas` and are enforced by aggregating `platform.tenant_api_usage`.

### 3.3 Routes

```
GET  /api/platform/tenants/me      — caller's tenant memberships
POST /api/platform/api-keys        — create a key (admin only). Returns plain_key once.
DELETE /api/platform/api-keys      — mark a key revoked.
GET  /api/platform/usage           — recent usage rows for a tenant (admin only).
```

## 4. Connector framework

`BaseConnector` is an abstract class with one method: `sync(creds, options)`. Each concrete connector:

- Authenticates against the real vendor endpoint with the supplied creds.
- Pulls accounts / positions / transactions / paystubs per its vendor's REST surface.
- Returns `ConnectorSyncResult` with `NormalizedAccount[] | NormalizedPosition[] | NormalizedTransaction[] | NormalizedPaystub[]`.

Implemented in this sprint:

| Connector                                 | File                         | Endpoints                                                |
| ----------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| `AdpConnector`                            | `lib/connectors/adp.ts`      | `GET /core/v1/workers` + `GET /payroll/v1/payStatements` |
| Plaid Income / Investments / Transactions | (existing Plaid integration) | covered by current `/api/integrations/plaid/*`           |

Other vendors in the seeded catalog (Paychex, Gusto, Fidelity, Schwab, Vanguard, Empower, Morgan Stanley) are registered with their documented auth flow and docs URL. The connector class for each is queued for the next sprint; the framework + catalog + RLS-bound `connectors.tenant_connections` are wired today, so adding a new connector is purely additive.

### 4.1 Routes

```
GET /api/connectors?tenant_id=    — catalog + tenant connections
```

## 5. BYOM model platform

`ModelProvider` interface (defined in `apps/web/src/types/models.ts`) is implemented by:

- `GeminiProvider` — real HTTP against `generativelanguage.googleapis.com/v1beta`
- `OpenAIProvider` — real HTTP against `api.openai.com/v1`
- `AnthropicProvider` — real HTTP against `api.anthropic.com/v1`
- `AzureOpenAIProvider` — real HTTP against `{endpoint}/openai/deployments/{model}`

Each provider:

- Reads its credential from the secrets adapter; missing creds → `error_kind: 'not_configured'`.
- Implements only the capabilities the vendor supports; unsupported capabilities return `error_kind: 'capability_unsupported'`.
- Returns a uniform `CallUsage { tokens_in, tokens_out, cost_usd_micros, latency_ms }` so the cost meter is uniform.

### 5.1 Resolution order

```
tenant_override → capability default → first supporting model → fail-loud sentinel
```

`models.tenant_model_overrides` is the single point of customization. An enterprise tenant pinning all vision calls to Azure OpenAI deployment `gpt-4o-az`:

```sql
INSERT INTO models.tenant_model_overrides (tenant_id, capability, model_registry_id, enforced)
SELECT 'tenant-uuid', 'vision', id, TRUE
FROM models.model_registry
WHERE provider='azure_openai' AND model_id='gpt-4o-az';
```

### 5.2 Routes

```
GET  /api/models                   — public catalog
POST /api/models                   — set tenant override (admin only)
                                     body: { tenant_id, capability, provider, model_id, enforced? }
```

## 6. Tests

```
$ npx jest src/lib/models src/lib/tenant --no-coverage
PASS src/lib/models/__tests__/byom.test.ts            (11 tests)
PASS src/lib/tenant/__tests__/gateway.test.ts          (16 tests)
Test Suites: 2 passed, 2 total
Tests:       27 passed, 27 total
```

Coverage:

- BYOM: model resolution (override / default / fallback), every provider fails loud without credentials, factory instantiates each class, unsupported capability is reported cleanly.
- Gateway: key generation shape + hash invariant, key shape validation, rate-limit per-tenant + per-tenant isolation, key reading from both `Authorization: Bearer` and `x-api-key`, all 5 denial reasons (missing / bad_shape / unknown / hash_mismatch / expired) and the success path.

Full project regression: **662/662 across 43 suites**.

## 7. Operator preflight

For Sprint P enterprise activation:

1. Apply migration `093_enterprise_foundation.sql`.
2. Insert at least one `platform.tenants` row + `platform.tenant_users` for the admin.
3. Issue the first API key via `POST /api/platform/api-keys` (admin only).
4. Configure BYOM credentials in the secrets adapter (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`).
5. (Optional) Set per-tenant model overrides for compliance / cost reasons.
6. Wire each connector's secrets (`ADP_API_BASE` + per-tenant OAuth tokens stored in vault) and create the connection rows.

## 8. What's not in scope this sprint

- Concrete classes for Paychex, Gusto, Fidelity, Schwab, Vanguard, Empower, Morgan Stanley — the catalog rows are seeded; implementing each follows the `BaseConnector` contract.
- Per-tenant quota auto-enforcement beyond `requests_per_minute` (the gateway honors that today).
- The "industry graph" overlay for `isolation='industry'` — schema is ready, projection layer queued.
- The "dedicated graph" for `isolation='dedicated'` — same.
- Webhook delivery to tenants when connector sync succeeds.

## 9. Success criteria

Enterprise customers can:

- Be modeled as tenants with isolation, residency, retention, industry settings.
- Manage their own API keys (create + revoke + scope) and see their usage.
- Consume the Decision Intelligence platform via API key, rate-limited per tenant.
- Connect to their payroll + brokerage + bank vendors via the connector catalog.
- Pin a specific LLM provider/model per capability for compliance / BAA reasons.
- Remain isolated from each other under RLS + the tenant-member SECURITY DEFINER gate.

The platform is now an API-first, multi-tenant, BYOM-pluggable platform.
