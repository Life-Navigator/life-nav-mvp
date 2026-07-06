# Enterprise Projection Architecture

Sprint S deliverable.

## Mission

Let an enterprise tenant — a wealth firm, a clinic network, an
employer, a school district, a government agency — operate on top of
LifeNavigator with their **own** regulatory baseline, terminology,
policies, and reporting, while inheriting the platform constitution
underneath.

The platform constitution still applies. The enterprise overlays
on top, never under.

## Why this layer exists

Before Sprint S, the platform was a single-tenant constitutional
system: one constitution, one character layer, one safety gate. Sprint
P added multi-tenant _infrastructure_ — `platform.tenants`,
`platform.tenant_users`, BYOM overrides — but no way for a tenant to
say "for OUR users, the platform should also enforce FINRA 2210, SEC
fiduciary rule, our internal compliance policy, and report against
_our_ engagement KPIs."

That gap is what an Enterprise Projection fills.

## The four-tier hierarchy

```
   global       ← platform constitution (Sprint L2 + N.3 baseline)
      ↓
   industry     ← vertical baseline (regulator-aligned)
      ↓
   organization ← tenant-specific policies
      ↓
   user         ← per-user overrides (very narrow — cannot override safety)
```

**Higher layers always include lower layers.** A user inherits org
rules; an org inherits industry rules; an industry inherits the
global constitution.

**Lower layers never silently override higher layers.** When a global
or industry rule is marked `is_overridable = false`, every override
attempt by a lower layer is recorded in `blocked_overrides` and
shadowed. This is the hard invariant that keeps an enterprise from
silently disabling safety / lawfulness / character rules.

## Schema — `projections.*`

Migration 104 creates the schema.

| Table                        | Purpose                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `enterprise_projections`     | One row per tenant: industry, status, rule_set_version, regulator, compliance_tags                                              |
| `constitutional_layer_rules` | Layer rules across all four tiers; carries `layer`, `industry`, `tenant_id`, `user_id`, `entity_kind`, `slug`, `is_overridable` |
| `organization_policies`      | Per-tenant overlays: approved / prohibited / escalate / requires_compliance_review                                              |
| `industry_templates`         | Per-vertical baseline templates (seeded for 6 industries)                                                                       |
| `policy_decisions`           | Audit chain: every policy evaluation, who/what/when/why                                                                         |

All tables expose RLS through `platform.is_tenant_member` so a
non-member sees an empty result rather than a 403.

### Why a dedicated schema

The projection layer is _additive_ to the existing constitutional
entities (Sprint L2 `governance.constitutional_principles`,
Sprint N.3 `character.principles`). The platform constitution
remains the source of truth for the global tier; `projections.*`
encodes the industry / organization / user tiers AND the join layer
that tells the runtime "these are the rules that apply to _this_
tenant."

This separation is deliberate:

1. The global constitution must never be modified by a tenant.
   Keeping it in `governance` / `character` schemas (no tenant column,
   no RLS gates for tenant writes) makes that structurally enforced.
2. The projection schema can carry tenant-specific rows safely under
   tenant-member RLS, because nothing in that schema is part of the
   global constitution.

## The 6 seeded industries

Each industry ships a baseline template with regulator-aligned rules.

| Industry             | Primary regulator       | Sample rules (seeded `is_overridable = false`)                                                         |
| -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `financial_services` | SEC / FINRA             | `sec_fiduciary` (SEC Reg BI), `finra_2210_balance` (balanced communications), `no_unregistered_advice` |
| `healthcare`         | HHS / OCR               | `hipaa_minimum_necessary`, `no_clinical_diagnosis`                                                     |
| `payroll`            | DOL                     | `wage_hour_minimum`, `final_pay_compliance`                                                            |
| `education`          | Department of Education | `ferpa_directory_minimum`, `coppa_under_13`                                                            |
| `government`         | OMB / NIST              | `foia_consideration`, `paperwork_reduction_act`                                                        |
| `energy`             | NERC / FERC             | `nerc_cip_disclosure_limit`, `confidential_grid_data`                                                  |

These are the **starting point**, not the ceiling. An organization
in financial services can layer their own additional rules
(e.g. "Our broker-dealers may not recommend products outside our
selection list") on top.

## Resolution algorithm

`apps/web/src/lib/enterprise-projections/layer-resolver.ts`

```ts
function resolveLayers({ rules, industry, tenant_id, user_id }) {
  const candidates = filterApplicable(rules, industry, tenant_id, user_id);
  const byKey = group(candidates, (r) => `${r.entity_kind}|${r.slug}`);

  const resolved = [];
  const blocked_overrides = [];

  for (const [key, list] of byKey) {
    list.sort(byLayerRank); // global, industry, organization, user
    let chosen = list[0];
    let shadowed = 0;
    let blocking = null;

    for (const r of list) {
      if (blocking && rank(r.layer) > rank(blocking.layer)) {
        // Lower layer trying to override a non-overridable higher rule.
        blocked_overrides.push({ key, attempted_layer: r.layer, higher_layer: blocking.layer });
        shadowed += 1;
        continue;
      }
      if (rank(r.layer) >= rank(chosen.layer)) {
        if (chosen !== r) shadowed += 1;
        chosen = r;
      }
      if (!r.is_overridable) blocking = { layer: r.layer };
    }

    resolved.push({ rule: chosen, origin_layer: chosen.layer, shadowed_count: shadowed });
  }
  return { rules: resolved, blocked_overrides };
}
```

Properties:

- **Pure function.** No I/O. The caller pre-fetches every candidate
  rule via SQL; resolution is deterministic.
- **Order-independent output.** Input ordering does not change the
  resolved set or the rule_set_version.
- **Auditable.** Every blocked override is recorded with both the
  attempting layer and the layer that blocked it.

## Rule set versioning

`ruleSetVersion(resolved)` is a stable djb2 hash of
`entity_kind.slug@layer/version`, sorted. The version changes when:

- a rule's content version bumps,
- a higher-layer rule is added,
- an org rule that wasn't shadowed before becomes shadowed,
- an org rule that was shadowed becomes the winning rule.

The frontend caches by `rule_set_version`; a version change forces
re-fetch.

## Endpoints

| Endpoint                                                  | Purpose                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/platform/tenants/[id]/projection`               | Returns the projection metadata + resolved layer set + blocked overrides |
| `POST /api/platform/tenants/[id]/policy-eval`             | Evaluates the tenant's organization policies against a subject           |
| `GET /api/platform/tenants/[id]/analytics?window_days=30` | Engagement + outcome + ROI roll-up                                       |

All three are gated by `platform.is_tenant_member`. Non-members get
404, not 403 (RLS removes the rows before the route runs).

## Test coverage

```
$ npx jest src/lib/enterprise-projections
PASS — 25 tests
```

The four hard properties tested:

1. **Hard invariant.** A global rule with `is_overridable=false`
   blocks lower-layer override attempts (org + user). The blocked
   attempts are recorded.
2. **Industry override.** An industry rule with `is_overridable=false`
   blocks the org from disabling it.
3. **Stable version.** `ruleSetVersion` is identical regardless of
   input ordering.
4. **Strictest wins (policies).** Outcome priority is
   `prohibited < requires_compliance_review < escalate < approved <
allow`, regardless of policy priority field.

## What it gives the enterprise

- **Vertical alignment.** Out of the box, financial services tenants
  enforce SEC + FINRA. Healthcare tenants enforce HIPAA. The
  enterprise does not start at zero.
- **Tenant-shaped policies.** Compliance teams describe what is
  approved / prohibited / escalated in their own terms, and the
  platform enforces them.
- **Visible safety floor.** The blocked*overrides field is the
  \_evidence* that the platform cannot be silently weakened by the
  organization. Auditors can verify the floor.
- **Per-tenant rule set version.** Caching by `rule_set_version`
  guarantees consistent behavior across a fleet of users in a
  tenant.

## What it does NOT give the enterprise

- **The ability to disable the platform constitution.** The global
  layer's `is_overridable = false` rules cannot be removed.
- **Per-user safety overrides.** The user layer is for tone,
  language, examples — never for safety. The same hard invariant
  applies.
- **Cross-tenant visibility.** A tenant only sees its own
  projection + its own users.

## Files

| File                                                              | Purpose              |
| ----------------------------------------------------------------- | -------------------- |
| `supabase/migrations/104_enterprise_projections.sql`              | schema + seeds + RLS |
| `apps/web/src/lib/enterprise-projections/types.ts`                | shared types         |
| `apps/web/src/lib/enterprise-projections/layer-resolver.ts`       | 4-tier resolution    |
| `apps/web/src/lib/enterprise-projections/policy-engine.ts`        | policy verdicts      |
| `apps/web/src/lib/enterprise-projections/analytics.ts`            | engagement + ROI     |
| `apps/web/src/lib/enterprise-projections/index.ts`                | public entry         |
| `apps/web/src/app/api/platform/tenants/[id]/projection/route.ts`  | projection read      |
| `apps/web/src/app/api/platform/tenants/[id]/policy-eval/route.ts` | policy evaluate      |
| `apps/web/src/app/api/platform/tenants/[id]/analytics/route.ts`   | enterprise analytics |

## Acceptance criteria — Sprint S Phase 1, 2, 4, 5, 6

| Phase                             | Acceptance                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| 1: Projection architecture        | EnterpriseProjection supports regulations / policies / procedures / workflows / terminology |
| 2: Organization graph templates   | 6 industries seeded with regulator-aligned baselines                                        |
| 4: Tenant constitutional layering | Global → Industry → Org → User with hard `is_overridable` invariant                         |
| 5: Enterprise policy engine       | approved / prohibited / escalate / requires_compliance_review                               |
| 6: Enterprise analytics           | outcome + engagement + ROI per tenant                                                       |

All six met. Phase 3 connector completion is documented in
[CONNECTOR_FRAMEWORK_EXPANSION.md](./CONNECTOR_FRAMEWORK_EXPANSION.md).
