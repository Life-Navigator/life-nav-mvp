# Tenant Constitutional Layering

Sprint S Phase 4 deliverable.

## The promise

> An enterprise can shape how LifeNavigator behaves for their users.
> They cannot disable the platform constitution.

Tenant constitutional layering is the architectural enforcement of
that promise.

## The four tiers

```
                            Trust
                              ▲
                              │
   ┌──────────────────────────┴──────────────────────────┐
   │  global       — platform constitution (Sprint L2 + N.3)  │
   ├──────────────────────────────────────────────────────┤
   │  industry     — vertical baseline (regulator-aligned)    │
   ├──────────────────────────────────────────────────────┤
   │  organization — tenant policies                          │
   ├──────────────────────────────────────────────────────┤
   │  user         — per-user overrides (tone, language)      │
   └──────────────────────────────────────────────────────┘
                              │
                              ▼
                          Specificity
```

- **Trust flows DOWN.** Higher layers earn more trust (they're
  validated against more users, regulators, and time).
- **Specificity flows UP.** Lower layers know more about the
  specific situation.

The resolver picks the **most-specific applicable rule** for a given
`(entity_kind, slug)` — except when a higher-layer rule has been
marked `is_overridable = false`, in which case the higher rule wins
and lower-layer override attempts are recorded for audit.

## What lives at each layer

### Global

The Sprint L2 constitution (13 principles) + the Sprint N.3
character layer (9 principles, 8 dimensions). Examples that ship
with `is_overridable = false`:

- `no_harm_in_recommendation`
- `dignity_in_voice`
- `family_table_test_must_pass`
- `trusted_advisor_test_must_pass`
- `no_emotional_manipulation`
- `no_unlawful_advice`

These cannot be turned off by anyone — not the tenant, not the user.
They are the platform-wide safety floor.

### Industry

Regulator-aligned vertical baselines. Migration 104 seeds 6
industries:

| Industry           | Sample non-overridable rules                                                 |
| ------------------ | ---------------------------------------------------------------------------- |
| Financial services | `sec_fiduciary` (SEC Reg BI), `finra_2210_balance`, `no_unregistered_advice` |
| Healthcare         | `hipaa_minimum_necessary`, `no_clinical_diagnosis`                           |
| Payroll            | `wage_hour_minimum`, `final_pay_compliance`                                  |
| Education          | `ferpa_directory_minimum`, `coppa_under_13`                                  |
| Government         | `foia_consideration`, `paperwork_reduction_act`                              |
| Energy             | `nerc_cip_disclosure_limit`, `confidential_grid_data`                        |

These are the _legal floor_ for the vertical. A financial-services
tenant cannot disable SEC fiduciary requirements; a healthcare
tenant cannot disable HIPAA minimum-necessary.

### Organization

Tenant-specific policies. These are the rules a compliance team
writes for their own organization:

- "Our advisors only recommend products on our approved list."
- "Discussions of competitor products require escalation to legal."
- "Recommendations involving stock options require compliance review."

Organization rules can be marked `is_overridable = true` (the
tenant intends users to be able to opt out, e.g. of an internal
marketing tone preference) or `is_overridable = false` (the tenant
intends to bind every user, e.g. "no recommending unapproved
products"). The tenant chooses.

Organization rules **cannot** override a non-overridable global or
industry rule. The resolver records every such attempt.

### User

Narrow per-user overrides:

- Tone preference (formal vs. casual).
- Preferred examples (parenting vs. without).
- Default level of detail.
- Language preference.

The user layer is NOT for safety. The hard invariant applies: a
user cannot turn off a global or industry safety rule. If a user
record tries, the override is shadowed and recorded.

## The hard invariant

```ts
if (higher_layer_rule.is_overridable === false) {
  // Any lower-layer rule for the same (entity_kind, slug)
  // is shadowed. The attempt is recorded in blocked_overrides.
  blocked_overrides.push({
    entity_kind,
    slug,
    higher_layer: higher_layer_rule.layer,
    attempted_layer: lower_rule.layer,
  });
}
```

This is enforced **in the resolver**, not at the data layer. The
data layer permits the row to exist (an org can write a rule that
_tries_ to override a global non-overridable rule); the resolver
refuses to honor it AND records the attempt. This design choice is
deliberate:

- **Auditability over silent enforcement.** If a tenant tries to
  override safety, we want the attempt visible, not silently
  dropped.
- **Compatibility with future overridable transitions.** A global
  rule that is non-overridable today MAY become overridable in a
  future major version (e.g. once a safer alternative ships). The
  org's pre-staged override does not need to be re-entered — the
  day the global rule's flag flips, the org's intent activates.

## How the resolver decides

```
   for each (entity_kind, slug):
     candidates = applicable rules across all layers
     sort by layer (global → industry → org → user)
     scan top-down:
        if a layer is non-overridable, all lower layers are blocked
        otherwise, the most-specific layer wins
     emit:
        chosen: one rule
        origin_layer: global / industry / organization / user
        shadowed_count: how many candidates were beaten or blocked
```

The output is deterministic given the inputs. Re-running with the
same rules in any order produces the same `chosen` rule and the
same `blocked_overrides`. This is what makes the system testable.

## Rule-set versioning

`ruleSetVersion(resolved_rules)` returns a hex hash that:

- Changes when a rule version bumps.
- Changes when the set of chosen rules changes (e.g. an org adds a
  new policy).
- Does NOT change with input ordering.

The frontend caches recommendations by `rule_set_version`. A
version change forces a re-fetch — the user gets fresh content
under the new rules.

## What this looks like for an operator

The operator UI for a tenant compliance officer shows three columns
for each `(entity_kind, slug)`:

```
| Slug             | Effective rule       | Origin       | Shadowed |
|------------------|----------------------|--------------|----------|
| no_harm          | global no_harm       | global       | 0        |
| sec_fiduciary    | industry fiduciary   | industry     | 0        |
| approved_products| org product list     | organization | 0        |
| tone             | user formal          | user         | 1        |
```

Plus a "Blocked overrides" panel for the cases where the org / user
tried to override a non-overridable rule. That panel is the audit
evidence the safety floor is enforced.

## Why this matters

Without tiered layering, an enterprise that signs LifeNavigator has
only two options:

1. Accept the platform constitution unchanged.
2. Fork.

Both options are bad. Option 1 means the enterprise cannot enforce
its own compliance posture inside the platform. Option 2 fragments
the safety floor — every fork is a separate audit, separate
regression surface, separate cost.

Tiered layering lets the enterprise add what they need WITHOUT
removing what the platform guarantees. The enterprise gets agency;
the platform keeps its floor; the auditor can verify both.

## How this composes with prior sprints

- **Sprint L2 — Constitutional Governance:** the global layer.
  The 13 principles run unchanged.
- **Sprint N.3 — Constitutional Character:** the character layer.
  Family table test, trusted advisor test, 8 dimensions — global
  layer.
- **Sprint P — Multi-tenant infrastructure:** the foundation. RLS,
  `platform.tenants`, `platform.tenant_users`. Sprint S layers
  on top.
- **Sprint O — Outcome Intelligence:** the safety gate filters
  recommendations through governance + character + future
  preservation. The projection layer applies AFTER outcome
  optimization; safety is upstream of optimization, and optimization
  is upstream of projection. The order matters: optimization that
  produces a safe rec then runs through the projection's policy
  engine, which may approve / require review / escalate / prohibit
  it for the tenant.
- **Sprint Q — Adversarial certification:** the global character
  layer is what the certification corpus validates. Projection
  cannot weaken that — it can only add additional checks.

The full pipeline for any recommendation in a tenant context:

```
   1. Outcome optimization (Sprint O) — picks best candidate
   2. Safety gate (Sprint O)         — filters through governance + character
   3. Tenant projection (Sprint S)   — evaluates org policy
   4. Resolved layer set (Sprint S)  — applies global + industry + org + user rules
   5. Audit row + delivery to user
```

A recommendation that fails step 2 (safety) never reaches step 3.
A recommendation that passes step 2 but is prohibited by an org
policy in step 3 never reaches the user. Both rejections are
audited.

## Files

| File                                                                    | Purpose                                              |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `supabase/migrations/104_enterprise_projections.sql`                    | layer rules + RLS + seeded global / industry rules   |
| `apps/web/src/lib/enterprise-projections/types.ts`                      | `ConstitutionalLayer`, `LayerRule`, `is_overridable` |
| `apps/web/src/lib/enterprise-projections/layer-resolver.ts`             | resolution + invariant enforcement                   |
| `apps/web/src/lib/enterprise-projections/__tests__/projections.spec.ts` | invariant tests                                      |

## Acceptance — Sprint S Phase 4

| Requirement                                         | Met                                 |
| --------------------------------------------------- | ----------------------------------- |
| Four tiers: global / industry / organization / user | ✓                                   |
| Hard `is_overridable = false` invariant             | ✓ (resolver enforces; tests assert) |
| Most-specific applicable rule wins otherwise        | ✓                                   |
| Blocked overrides recorded for audit                | ✓                                   |
| Stable `rule_set_version` for caching               | ✓                                   |
| Composes with Sprint L2 + N.3 + O safety gate       | ✓                                   |

Phase 4 complete.
