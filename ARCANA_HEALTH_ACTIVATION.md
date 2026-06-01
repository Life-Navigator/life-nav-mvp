# Arcana Health & Performance Activation

This deliverable activates the **Arcana Health & Performance** surface
on top of LifeNavigator. Arcana extends the personal GraphRAG with six
new first-class domains, a dedicated `arcana` Postgres schema, a
consent-bounded provider hand-off pipeline, and engines tailored to
honest health recovery framing.

> **Ethical contract (load-bearing).**
> Arcana **recommends**; Arcana **does not** diagnose or prescribe.
> Every flagged action carries citations. Every action that needs
> medical clearance is tagged. The lead-package consent flow opts
> labs/medications/insurance **off** by default.

## 1. What ships in this sprint

| Surface                     | What it is                                                                                 | Where it lives                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| New schema                  | `arcana.*` — 18 tables, single sync trigger, RLS + public views                            | `supabase/migrations/086_arcana_health_activation.sql`          |
| Six new first-class domains | `performance`, `recovery`, `longevity`, `body_composition`, `preventative_care` + `health` | `central.is_domain` / `decision_intelligence.is_domain` updated |
| Health Catch-Up             | Smallest realistic recovery, never "start over"                                            | `apps/web/src/lib/arcana/health-catch-up-service.ts`            |
| Lead Package                | Consent-bounded frozen provider snapshot                                                   | `apps/web/src/lib/arcana/lead-package-service.ts`               |
| Readiness Engine            | 4-axis score → membership tier recommendation                                              | `apps/web/src/lib/arcana/readiness-engine.ts`                   |
| Cross-domain graph          | Health → Energy → Productivity → Income                                                    | `apps/web/src/lib/arcana/cross-domain-health.ts`                |
| Health Catalog              | Curated, citation-backed action library                                                    | `apps/web/src/lib/arcana/health-catalog.ts`                     |
| API surface                 | 6 endpoints under `/api/arcana/*`                                                          | `apps/web/src/app/api/arcana/**`                                |
| Rust worker                 | 17 new entity types, embedding builders, Person→Arcana relationships                       | `apps/ingestion-worker/src/entities.rs`, `normalizer.rs`        |
| Tests                       | 35 new arcana tests, 303 total in scope passing                                            | `apps/web/src/lib/arcana/__tests__/*`                           |
| RLS verifier                | Cross-user leak + revoked/expired consent gate                                             | `scripts/validation/verify_086_arcana_rls.sql`                  |

## 2. Phase-by-phase coverage

### Phase 1 — Domain enum activation

Two SQL predicates extended:

- `central.is_domain(p TEXT)` now accepts `performance`, `recovery`,
  `longevity`, `body_composition`, `preventative_care`.
- `decision_intelligence.is_domain(p TEXT)` same extension.

This means every CHECK constraint that gated rows by domain — across
goals, recommendations, outcomes, calibration, audit trail, why
chains, provider engagements — now natively accepts the new domains
without further migrations.

`ProviderDomain` (TS) was extended to match so provider engagement
scopes can be set at the fine-grained level too.

### Phase 2 — Conversational intake

Seven tables anchor intake:

- `arcana_profiles` — one per user; caches dominant/secondary driver +
  readiness score for hot-path routing.
- `arcana_assessments` — links to a discovery session (Sprint H) for
  full Need-Behind-Need trace.
- `arcana_goals` — goals at the Arcana sub-domain level, with optional
  back-ref to the unified `public.goals` table so the Goal Hierarchy
  Engine and Probability Engine traverse identical edges.
- `arcana_constraints` — hard vs soft, time/budget/injury/medical/etc.
- `arcana_capabilities` — proficiency in training, cooking, recovery
  habits, gym access, etc.
- `arcana_motivations` — captured during the Why drill-down with
  `surfaced_at_depth` so deep insights are weighted more.
- `arcana_readiness` — snapshot table; new row per recomputation.

### Phase 3 — Health graph

- `supplement_protocols`, `training_protocols`, `health_milestones`.
- Protocols are journal entries, **not** prescriptive. They carry a
  `source` (`self_report` | `provider_recommended` | `arcana_suggested`
  | `imported`) so the UI can clearly indicate provenance.

### Phase 4 — Biometrics + labs

- `biometric_observations` covers 20 metric kinds (weight, body fat,
  HRV, VO2max, sleep stages, training load, recovery score, etc.).
- `lab_results` covers 30+ analytes (CBC/CMP/Lipid/A1C/Vit D/Vit B12/
  ferritin/full hormone panel/TSH/T3/T4/CRP/ApoB/Lp(a)/fasting
  glucose/insulin/HOMA-IR/PSA/IGF-1/cortisol AM-PM/etc.).
- Both carry optional `reference_low`/`reference_high` — population
  ranges, not personal targets. The UI must never read them as
  "your normal range."

### Phase 5 — Wearables

`wearable_connections` stores **only** provider + status + scopes +
`vault_reference`. **No OAuth tokens** live in the schema; tokens are
held in Supabase Vault or an external secrets manager. The Rust
worker's embedding builder explicitly drops `vault_reference`.

Real OAuth onboarding flows are **docs-only** in this sprint.

### Phase 6 — Insurance + benefits

- `arcana.insurance_documents` adds a per-document storage path +
  `ocr_status`. The OCR runner is **docs-only** here; the table is
  ready when we land the OCR job.

### Phase 7 — Lead packages (provider hand-off)

Two tables form the gate:

- `lead_package_consents` — per-section opt-in flags. **Labs**,
  **medications**, and **insurance** are **off by default**; the user
  must explicitly flip them on.
- `lead_packages` — immutable frozen snapshot. The bytes that flew
  do not retroactively change when consent is revoked; what changes is
  future provider read access.

The `arcana.has_active_lead_consent(p_consent_id UUID)` SECURITY
DEFINER helper is the canonical gate: revoked OR expired → FALSE.
The TS service mirrors the same check via `verifyConsentAt(consent,
now)` for pre-flight UX.

### Phase 8 — Provider intake

Reuses the Sprint I provider profile / engagement / consent scope
tables. No new tables here; only the lead-package consent is new.

### Phase 9 — Health probability engine

The Sprint F `computeProbabilityDistribution` already handles every
new domain. The Arcana goals back-link to `public.goals`, so the
probability engine treats them identically to any other unified goal
when computing 7-quantile distributions.

### Phase 10 — Health Catch-Up Engine

`computeHealthCatchUpPlan(inputs)` is the deliverable.

**Honest framing.** The notes never use the words "start over" or
"restart." When you are 30+ points behind on a 12-month horizon, we
say:

> "You are critically behind. We are not asking you to start over.
> Below is the smallest credible recovery given what you said is
> possible."

The engine:

1. **Filters** the `HEALTH_CATALOG` to entries matching the goal kind
   and at least one of the goal's domains.
2. **Excludes** entries that violate hard constraints (time budget,
   medical restrictions blocking clearance-required actions, etc.).
3. **Scores** remaining candidates as
   `realistic_recovery_pct × effort_penalty × clearance_penalty`,
   where un-cleared provider-required actions are heavily down-weighted.
4. **Greedily picks** actions until the cumulative recovery covers
   the gap or 4 items is reached.
5. **Emits notes** that:
   - frame the gap honestly,
   - tag provider-clearance requirements,
   - count hard constraints respected,
   - warn on low readiness,
   - close with: _"Nothing here is a diagnosis or a prescription."_

The `HEALTH_CATALOG` has 14 high-confidence entries across recovery,
cardio, strength/body comp, metabolic/labs, hormone (provider-gated),
preventative, and cross-domain pairings. Every entry has at least one
published citation (AASM, ACSM, AHA, ADA, USPSTF, NHLBI, Endocrine
Society, European Atherosclerosis Society, NIH ODP, ATA, IDF, etc.).

### Phase 11 — Cross-domain attribution

`cross-domain-health.ts` ships a 20-edge curated graph linking
biometrics/labs/goals to four downstream domains (career, financial,
family, longevity) via 8 mediator effects (energy, productivity, mood,
cognition, sleep_quality, metabolic_health, cardiovascular_health,
longevity_quality).

Effect magnitudes are **labeled** (weak / moderate / strong); we
deliberately do not publish numeric effect sizes because the
literature is too heterogeneous to do so honestly.

`narrateLink(link)` is deterministic — same link → byte-identical
narration.

### Phase 12 — Arcana XAI

No new XAI engine. The Sprint E `WhyChain`, `EvidenceGraph`,
`CounterfactualEngine`, and `AssumptionEngine` accept Arcana goals
unchanged because the goal interfaces are uniform. Health catalog
citations populate `EvidenceLink.evidence` directly.

### Phase 13 — Concierge foundation

`concierge_preferences` holds travel profile, gym access prefs,
recovery prefs, provider prefs. Schema only — no booking integrations,
no agent. UI will surface this as a "tell us what you have access to"
form.

### Phase 14 — Membership

`memberships` has the three tier choices (`arcana_core`,
`arcana_performance`, `arcana_concierge`) plus status lifecycle. The
readiness engine recommends a tier based on overall score +
dominant driver:

| Overall         | Dominant driver | Tier                                         |
| --------------- | --------------- | -------------------------------------------- |
| < 0.40          | any             | `arcana_core`                                |
| 0.40 ≤ x < 0.70 | any             | `arcana_performance`                         |
| ≥ 0.70          | `image`         | `arcana_concierge`                           |
| ≥ 0.70          | other           | `arcana_performance` (concierge upsell note) |

Billing is **not in scope** for this sprint.

### Phase 15 — Multi-agent integration

**Docs only** in this sprint. The architecture is:

- `HealthAgent` — owns biometric trend reads + sleep/recovery summaries
- `LongevityAgent` — owns lab interpretation framing (provider-flagged)
- `ComplianceAgent` — owns the "needs provider clearance" gate
- `ProviderCoordinationAgent` — owns the lead-package generation handshake
- `OrchestratorAgent` — composes the above for a single Arcana request

The runtime is the Sprint H conversation engine extended with these
agents as additional skill providers. **No new agent runtime ships
this sprint.**

### Phase 16 — API layer

Six endpoints land under `/api/arcana/*`:

| Method | Path                               | Purpose                                                       |
| ------ | ---------------------------------- | ------------------------------------------------------------- |
| POST   | `/api/arcana/intake/start`         | Idempotent create of the user's `arcana_profile`              |
| POST   | `/api/arcana/intake/upsert`        | Bulk upsert of goals/constraints/capabilities/motivations     |
| POST   | `/api/arcana/readiness`            | Recompute readiness + persist snapshot + refresh cached score |
| POST   | `/api/arcana/catch-up`             | Compute smallest realistic recovery for one goal              |
| POST   | `/api/arcana/lead-package/consent` | Create a per-section consent row                              |
| PATCH  | `/api/arcana/lead-package/consent` | Revoke an existing consent                                    |
| POST   | `/api/arcana/lead-package`         | Generate the immutable frozen package                         |
| GET    | `/api/arcana/profile`              | Denormalized profile + counts                                 |

Every route is authenticated via `createServerSupabaseClient`. The
write endpoints **force** `user_id = auth.user.id` and look up
`profile_id` server-side — caller-supplied identity is dropped.

## 3. Rust worker integration

`apps/ingestion-worker/src/entities.rs` gets 17 new `EntityType`
variants. All are routed to the `"arcana"` domain and tagged
`SensitivityLevel::High`. The `relationships_for()` map gives each a
labeled `Person → Entity` relationship for the Neo4j projection.

`normalizer.rs` ships an embedding-text builder per new entity type
so semantic search over Arcana data returns meaningful neighbors.
The builders intentionally **omit**:

- `vault_reference` (wearable OAuth pointer)
- `storage_path` (insurance document binary path)
- `extracted_fields` (OCR free-form JSON)

The migration's `arcana.trigger_arcana_sync()` trigger strips the
same fields again as defense-in-depth before enqueueing the sync job.

## 4. Tests

```
$ npx jest src/lib/arcana --no-coverage
PASS src/lib/arcana/__tests__/health-catch-up-service.test.ts
PASS src/lib/arcana/__tests__/lead-package-service.test.ts
PASS src/lib/arcana/__tests__/cross-domain-health.test.ts
PASS src/lib/arcana/__tests__/readiness-engine.test.ts
Test Suites: 4 passed, 4 total
Tests:       35 passed, 35 total
```

Broader regression — every related test suite still green:

```
$ npx jest --no-coverage --testPathPattern "lib/(arcana|decision|conversation|provider)"
Test Suites: 23 passed, 23 total
Tests:       303 passed, 303 total
```

Notable coverage:

- **classifyHealthStatus** — five threshold bands + NaN-safety.
- **Hard-constraint filter** — `<2h/week` time cap leaves only
  `small` effort actions; medical restriction suppresses all
  clearance-required actions.
- **Catch-up notes** — always end with the not-diagnosis disclaimer,
  never say "start over" or "restart."
- **Lead package consent** — revoked / expired → rejected.
- **Section gating** — `include_labs=false` omits `lab_snapshot`
  **key entirely** (not as `undefined`); same for medications,
  insurance, etc.
- **PHI minimization** — patient_summary never carries DOB, full name,
  or SSN.
- **Cross-domain graph** — every link carries a citation; downstream
  domains and magnitudes are constrained to documented enums.
- **Readiness scoring** — driver+intensity boosts motivation;
  hard constraints subtract from capacity; `image` driver at high
  overall score routes to concierge.
- **Determinism** — every engine emits byte-identical output on
  identical inputs.

## 5. RLS verifier

```
psql "$DATABASE_URL" -f scripts/validation/verify_086_arcana_rls.sql
```

Asserts:

1. User A can read their own `arcana_goals`.
2. User A **cannot** read User B's `arcana_goals` (leak test).
3. Freshly granted consent → `has_active_lead_consent = TRUE`.
4. Revoking → `FALSE`.
5. Expired → `FALSE`.
6. The six new domain values are accepted by both `is_domain` helpers.

The script wraps the entire test in `BEGIN; ... ROLLBACK;` so it
leaves no state.

## 6. What is explicitly **not** in this sprint

| Area                                                                        | Status                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------- |
| Real wearable OAuth (Apple Health, Google Fit, Fitbit, Garmin, Whoop, Oura) | Schema ready; integrations are next sprint     |
| Insurance OCR pipeline                                                      | Schema ready; OCR runner is next sprint        |
| Provider intake UX                                                          | API ready; UI is next sprint                   |
| Multi-agent runtime                                                         | Architecture documented; no new agent process  |
| Billing / payments for membership tiers                                     | Tier persistence only                          |
| Real-time alerting on biometric thresholds                                  | Sprint G/H frameworks reusable; not wired here |

These are deliberate; the sprint scope is **schema + engines + API +
worker entities + tests**.

## 7. Determinism + privacy summary

- **Determinism.** Every engine in `lib/arcana` is a pure function.
  Same input → byte-identical output. Verified by tests.
- **No-manipulation.** Arcana never tells the user to start over.
  The catch-up notes are templated; LLMs cannot mutate them.
- **PHI minimization.** Patient summaries use initials + age band +
  sex. No DOB, no full name, no SSN. Labs / medications / insurance
  default to OFF.
- **Consent immutability.** Lead packages are frozen JSON snapshots.
  Revocation blocks future access but does not change the bytes that
  already flew.
- **Sensitivity.** All 17 new entity types are `SensitivityLevel::High`
  in the Rust worker.

## 8. Migration order

```
086_arcana_health_activation.sql
```

Depends on:

- `central` schema and `central.is_domain` (Sprint G)
- `decision_intelligence` schema and `decision_intelligence.is_domain` (Sprint D)
- `providers.provider_profiles` (Sprint I)
- `public.profiles`, `public.goals`, `public.insurance_plans` (base)
- `graphrag.enqueue_sync()` and `core.set_updated_at()` (Sprint A)

A self-test `DO` block at the bottom of the migration verifies RLS is
enabled on the most-sensitive tables (`arcana_profiles`,
`arcana_goals`, `biometric_observations`, `lab_results`,
`lead_packages`, `lead_package_consents`).
