# Provider GraphRAG — Implementation (Sprint I)

The provider-facing layer. Arcana's moat.

A provider (physician, NP, coach, nutritionist, trainer) can see a
patient/client's **Current State, Trajectory, Probability, Risk,
Progress, Recommendations** — _without_ seeing unrelated user data.
Three barriers between any provider and any datum:

1. **Active engagement** (`status='active'`, accepted, not revoked or expired)
2. **Domain in scope** (`engagement.allowed_domains` contains the requested domain)
3. **Sensitivity within max** (request sensitivity ≤ `engagement.max_sensitivity`)

All three are enforced by the SECURITY DEFINER function
`providers.has_access_to(provider_user_id, patient_user_id, domain,
min_sensitivity)`. Every provider read against patient data goes
through this function. No exceptions.

## What shipped

| Deliverable                                                                               | File                                                                                |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Migration 085 — `providers` schema + `has_access_to` function + `get_patient_summary` RPC | `supabase/migrations/085_provider_graphrag.sql`                                     |
| Types                                                                                     | `apps/web/src/types/provider.ts`                                                    |
| `ProviderAccessService` — pure verifier + RPC wrapper                                     | `apps/web/src/lib/provider/access-service.ts`                                       |
| `ProviderViewService` — scoped view assembly                                              | `apps/web/src/lib/provider/view-service.ts`                                         |
| `ProviderRecommendationService` — issue/list/accept/reject/complete + outcome attribution | `apps/web/src/lib/provider/recommendation-service.ts`                               |
| `ProviderAnalyticsService` — pure aggregator                                              | `apps/web/src/lib/provider/analytics-service.ts`                                    |
| API routes (provider + engagement surface)                                                | `apps/web/src/app/api/{provider,engagements}/...`                                   |
| Rust worker entity types (7 new)                                                          | `apps/ingestion-worker/src/{entities,normalizer}.rs` + `tests/provider_entities.rs` |
| Critical RLS verifier (cross-patient leak proof)                                          | `scripts/validation/verify_085_provider_rls.sql`                                    |
| This doc                                                                                  | `PROVIDER_GRAPHRAG_IMPLEMENTATION.md`                                               |

## Verification

| Check                                            | Result                                                |
| ------------------------------------------------ | ----------------------------------------------------- |
| Rust `cargo test`                                | **48 / 48** (was 45; +3 `provider_entities`)          |
| Rust `cargo fmt --check`                         | clean                                                 |
| Rust `cargo clippy --all-targets -- -D warnings` | clean                                                 |
| Web strict `tsc --noEmit -p tsconfig.json`       | clean                                                 |
| Web jest                                         | **548 / 548** (was 523; +25)                          |
| Migration 085 self-test                          | raises if any of 7 tables lacks RLS                   |
| `verify_085_provider_rls.sql`                    | proves cross-patient leakage blocked (the leak check) |

---

## 1. The provider types

| Type                 | Domain focus                    | License              | Can issue recs? |
| -------------------- | ------------------------------- | -------------------- | --------------- |
| `physician`          | health (clinical)               | MD/DO + state        | yes             |
| `nurse_practitioner` | health (primary care)           | NP + state           | yes             |
| `coach`              | behavioral / lifestyle          | none (self-attested) | yes             |
| `nutritionist`       | nutrition / dietetics           | RD or self-attested  | yes             |
| `trainer`            | fitness / strength              | CPT or self-attested | yes             |
| `other_licensed`     | catch-all licensed professional | varies               | yes             |

A provider is a Supabase auth user with a row in
`providers.provider_profiles`. A single auth user can be both a
patient and a provider — the schema cleanly separates the roles
(patient = `user_id` in user-graph tables; provider = `user_id` in
`provider_profiles`).

---

## 2. Schema (migration 085)

Seven tables in the new `providers` schema.

| Table                        | Purpose                                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provider_profiles`          | Identity + license + specialty + verification flag. Verified profiles publicly readable.                                                                                                                    |
| `provider_engagements`       | Patient ↔ provider link. Scope (`allowed_domains[]`, `max_sensitivity`), status (`pending/active/paused/revoked/expired/declined`), `accepted_at`, `expires_at`, `revoked_at`, `can_issue_recommendations`. |
| `provider_consent_scopes`    | Granular grant/deny overrides per entity_type — for patients who want to share Sleep Duration but not Resting Heart Rate.                                                                                   |
| `provider_recommendations`   | Recs issued by providers, lifecycle (`issued → accepted/rejected/modified → completed/abandoned/superseded`), with rationale + citations + expected_horizon_months + expected_strength.                     |
| `provider_outcomes`          | Outcomes attributed to provider recs: observed_value, expected_value, delta, accuracy_score, outcome_quality, user_satisfaction, source.                                                                    |
| `provider_knowledge_entries` | Provider's own knowledge graph: protocols, templates, assessments, reading. Visibility = `provider_only` (default) / `shared_with_patients` / `shared_with_providers`.                                      |
| `provider_analytics`         | Periodic per-provider rollups: active_patient_count, lifecycle stats, mean_outcome_quality, mean_user_satisfaction.                                                                                         |

### The SECURITY DEFINER access function

```sql
providers.has_access_to(
  p_provider_user_id UUID,
  p_patient_user_id  UUID,
  p_domain           TEXT,
  p_min_sensitivity  TEXT DEFAULT 'low'
) RETURNS BOOLEAN
```

Returns `TRUE` only when ALL FOUR pass:

1. Provider has a verified `provider_profiles` row
2. Engagement exists, `status='active'`, accepted, not revoked, not expired
3. `p_domain` is in `engagement.allowed_domains`
4. `p_min_sensitivity` rank ≤ `engagement.max_sensitivity` rank

No exceptions, no logs that could leak data, no side effects. Called
by every provider-facing RLS policy + the `get_patient_summary` RPC.

### The scoped RPC

```sql
providers.get_patient_summary(p_patient_user_id, p_domain)
  RETURNS TABLE (
    goal_id, goal_title, goal_domain,
    current_progress, most_likely_prob, probability_range,
    confidence, recommendation_count, last_observation_at
  )
```

First call invokes `has_access_to` — if FALSE, returns empty result
set. Otherwise joins:

- `public.goals` (filtered by patient + domain)
- LATERAL latest `goal_progress_snapshots`
- LATERAL latest `goal_probability_distributions`
- LATERAL `provider_recommendations` count

**Nine fields. That's everything the provider sees.** Free-text goal
descriptions, constraints, capabilities, motivations, decision
preferences, WhyChains, EvidenceGraphs, Counterfactuals, the user's
full DecisionJournal — all withheld.

### RLS policies summary

| Table                        | Patient                                  | Provider                                           | Service-role |
| ---------------------------- | ---------------------------------------- | -------------------------------------------------- | ------------ |
| `provider_profiles`          | own row                                  | reads verified profiles publicly                   | full         |
| `provider_engagements`       | full on own rows                         | read + update status on rows for their provider_id | full         |
| `provider_consent_scopes`    | full on own rows                         | read on engaged rows                               | full         |
| `provider_recommendations`   | read + update lifecycle on rows for them | read own + INSERT gated by `has_access_to`         | full         |
| `provider_outcomes`          | read on rows for them                    | read + INSERT on rows for their provider_id        | full         |
| `provider_knowledge_entries` | (no policy)                              | full on own rows                                   | full         |
| `provider_analytics`         | (no policy)                              | full on own rows                                   | full         |

The `provider_recommendations` INSERT policy is the strict one:

```sql
WITH CHECK (
  providers.has_access_to(auth.uid(), patient_user_id, domain, 'low')
  AND EXISTS (SELECT 1 FROM providers.provider_profiles pp
              WHERE pp.id = provider_id AND pp.user_id = auth.uid())
)
```

A provider with a revoked engagement, expired engagement, or out-of-scope
domain CANNOT insert a recommendation. The database refuses.

---

## 3. What providers CAN see

Per the spec — the six fields:

| Field               | Source                                                                            | Filter       |
| ------------------- | --------------------------------------------------------------------------------- | ------------ |
| **Current State**   | `goal_progress_snapshots.score`                                                   | domain match |
| **Trajectory**      | `goal_progress_snapshots.snapshot_at` (last observation timestamp)                | domain match |
| **Probability**     | `goal_probability_distributions.{worst_case, most_likely, best_case, confidence}` | domain match |
| **Risk**            | implicit in `probability_range` width + `confidence`                              | domain match |
| **Progress**        | `goal_progress_snapshots.score` over time (queryable via RPC extension)           | domain match |
| **Recommendations** | `provider_recommendations` they issued + count                                    | scope match  |

### What providers CAN NOT see

Hard wall around:

- ❌ The patient's `user_constraints` / `user_capabilities` / `user_motivations` / `user_decision_preferences` / `user_commitment_levels` / `user_domain_risk_tolerance` rows
- ❌ Free-text `description` field on goals outside the requested domain
- ❌ The patient's `recommendation_audit_trail` / `why_chains` / `evidence_links` / `counterfactual_scenarios` / `recommendation_assumptions` (Sprint E)
- ❌ The patient's `goal_pathway_effectiveness` cohort placement
- ❌ The patient's `decision_journals` / `decision_outcomes` / `decision_reviews` (Sprint Decision Intelligence)
- ❌ The patient's `prediction_calibration` history
- ❌ The patient's other providers' recommendations
- ❌ Any data from a different `domain`

Those omissions are by design. Minimum viable provider context.

---

## 4. Services + determinism

### `ProviderAccessService.verifyAccess(inputs) → AccessDecision`

Pure mirror of the SQL function. Returns `{ allowed, reasons[] }` where
`reasons` enumerates every barrier that fired:

```
'engagement_missing' | 'engagement_not_active' |
'engagement_not_accepted' | 'engagement_revoked' |
'engagement_expired' | 'domain_out_of_scope' |
'sensitivity_exceeds_max' | 'provider_not_verified'
```

**Tests (15 in `access-service.test.ts`)** — full denial matrix +
multi-reason accumulation + cross-patient leakage protection.

### `ProviderViewService.assemblePatientView(args) → PatientView`

Pure assembly — takes the rows the RPC returned + a domain + provider_id
and produces a typed `PatientView` with explicit `visible_fields[]` so
the UI knows exactly what the provider is allowed to render.

```ts
visible_fields = [
  'goal_id',
  'goal_title',
  'goal_domain',
  'current_progress',
  'most_likely_prob',
  'probability_range',
  'confidence',
  'recommendation_count',
  'last_observation_at',
];
```

A UI that tries to render anything not in this list is violating the
contract.

### `ProviderRecommendationService` + `computeRecommendationLifecycleStats`

`issueRecommendation`, `listRecommendations`, `recordPatientResponse`,
`recordOutcome`. Pure `computeRecommendationLifecycleStats(rows)`
returns `{ issued, accepted, rejected, modified, completed, abandoned,
acceptance_rate, completion_rate }`. The `completion_rate`
denominator is the accepted-family (accepted + completed + abandoned +
modified) — the same convention the patient-side
`RecommendationAcceptanceService` uses.

### `ProviderAnalyticsService.computeProviderAnalytics`

Pure aggregator over a provider's own recommendations + outcomes.
Cannot expand the patient set beyond what was passed in — RLS at the
loader is the perimeter. Tests verify determinism.

---

## 5. API surface

### Provider routes

| Method + path                                        | Purpose                                                   |
| ---------------------------------------------------- | --------------------------------------------------------- |
| `GET /api/provider/patients`                         | List engaged patients for the calling provider            |
| `GET /api/provider/patients/[id]/view?domain=health` | Scoped patient view (3-barrier check)                     |
| `GET /api/provider/patients/[id]/recommendation`     | List recs the provider issued for this patient            |
| `POST /api/provider/patients/[id]/recommendation`    | Issue a recommendation (gated by has_access_to at INSERT) |

### Patient routes

| Method + path                       | Purpose                                                   |
| ----------------------------------- | --------------------------------------------------------- |
| `GET /api/engagements`              | List the patient's engagements                            |
| `POST /api/engagements/grant`       | Grant + immediately accept a scoped engagement            |
| `POST /api/engagements/[id]/revoke` | Immediate revoke — subsequent provider reads return empty |

All routes derive `user_id` strictly from the server session.

---

## 6. The critical RLS verifier

`scripts/validation/verify_085_provider_rls.sql` proves:

| Test                                         | Assertion                                |
| -------------------------------------------- | ---------------------------------------- |
| **A → Pat1** (engaged)                       | `has_access_to = TRUE`                   |
| **A → Pat2** (not engaged)                   | `has_access_to = FALSE` ← THE LEAK CHECK |
| **B → Pat2** (engaged)                       | `has_access_to = TRUE`                   |
| **B → Pat1** (not engaged)                   | `has_access_to = FALSE` ← THE LEAK CHECK |
| **A → Pat1, financial** (out of scope)       | `has_access_to = FALSE`                  |
| **A → Pat1, high sensitivity** (exceeds max) | `has_access_to = FALSE`                  |
| **A reads Pat1 via RPC**                     | rows > 0                                 |
| **A reads Pat2 via RPC**                     | rows = 0 ← LEAK BLOCKED                  |
| **After revoke**                             | `has_access_to = FALSE` immediately      |

Expected: `ALL PASS`. Failure means a leak.

---

## 7. Rust worker — 7 new entity types

Added to `EntityType`:

| Variant                  | as_str()                   | Person → entity edge label    |
| ------------------------ | -------------------------- | ----------------------------- |
| `ProviderProfile`        | `provider_profile`         | `HAS_PROVIDER_PROFILE`        |
| `ProviderEngagement`     | `provider_engagement`      | `HAS_PROVIDER_ENGAGEMENT`     |
| `ProviderConsentScope`   | `provider_consent_scope`   | `HAS_CONSENT_SCOPE`           |
| `ProviderRecommendation` | `provider_recommendation`  | **`RECOMMENDED_BY_PROVIDER`** |
| `ProviderOutcome`        | `provider_outcome`         | `PROVIDER_OUTCOME`            |
| `ProviderKnowledgeEntry` | `provider_knowledge_entry` | `AUTHORED_KNOWLEDGE`          |
| `ProviderAnalytics`      | `provider_analytics`       | `ANALYZED_BY_PROVIDER`        |

`domain()` maps all seven to `"provider"`. Summary builders surface
the structured fields so phrase-match retrieval can find them.

### Sync routing

The trigger `providers.trigger_provider_sync()` routes each row:

- **Patient-scoped rows** (`provider_engagements`, `provider_consent_scopes`, `provider_recommendations`, `provider_outcomes`) project into the **patient's personal graph** so the patient's WhyChain can show _"because Dr. So-and-so recommended X"_.
- **Provider-scoped rows** (`provider_profiles`, `provider_knowledge_entries`, `provider_analytics`) project into the **provider's own personal graph** so the provider can search across their own panel.

No central-scope rows from this sprint.

---

## 8. Integration with existing decision intelligence

### Provider recs feed `recommendation_acceptance`

When a patient accepts a provider's recommendation, the patient-side
acceptance route (Sprint Decision Intelligence) can write a row in
`decision_intelligence.recommendation_acceptance` linking
`provider_recommendation_id` in metadata. This lets the existing
analytics + calibration engines incorporate provider-influenced
outcomes without any schema change.

### Outcome attribution chain

Provider outcomes flow into the existing
`decision_intelligence.outcome_attributions` table via a thin
adapter: when `provider_outcomes` rows accumulate, an attribution row
is written attributing the outcome to the originating provider
recommendation. The existing `traverseImpactChain` then walks
provider → goal → cross-domain edges normally.

### Calibration

A provider's recommendation accuracy can be tracked via
`prediction_calibration` rows (`source_run_id = provider_id`,
`source_action_id = provider_recommendation_id`). Brier score + ECE
per-provider become available without code change.

---

## 9. What this sprint did NOT do

- ❌ No provider-facing UI. Routes return JSON; a separate UI sprint
  consumes them.
- ❌ No federated identity (Epic/Cerner). Providers register via
  Supabase auth + verification is admin-driven.
- ❌ No subscription billing / Stripe Connect for providers. Out of
  scope for the access layer.
- ❌ No HIPAA Business Associate Agreement (BAA) artifacts —
  documentation + signing is a legal sprint, not engineering.
- ❌ No automated provider license verification (NPI / state board
  lookup). `verified=TRUE` is set by admin out-of-band.
- ❌ No diagnostic features. Per spec, providers can recommend; they
  cannot generate diagnoses through this system.

---

## Apply + verify runbook

```bash
psql "$DATABASE_URL" -f supabase/migrations/085_provider_graphrag.sql
psql "$DATABASE_URL" -f scripts/validation/verify_085_provider_rls.sql

pnpm --filter @life-navigator/web test \
  --testPathPattern='lib/provider'

cd apps/ingestion-worker
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Expected:

- Migration applies cleanly + self-test passes.
- RLS verifier prints `ALL PASS` — every leak check returns the
  expected `FALSE`.
- Web jest 548/548; cargo 48/48; fmt + clippy silent.

If the leak verifier returns ANY `FAIL`, the entire provider layer is
compromised. Do not deploy until it returns `ALL PASS`.
