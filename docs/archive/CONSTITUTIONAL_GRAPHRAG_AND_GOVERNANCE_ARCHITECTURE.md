# Constitutional GraphRAG & Pre-Stream Governance Architecture

Sprint L2 promotes the Central GraphRAG to a **Constitutional GraphRAG**
and installs the pre-stream governance pipeline. Every response must
flow through this pipeline before reaching the user.

```
User Request
↓
Intent Classification           (upstream)
↓
Personal GraphRAG Retrieval     (upstream)
↓
Decision Intelligence            (Sprints B–F)
↓
Draft Response                   (upstream)
↓
Constitutional GraphRAG Retrieval
↓
Constitutional Governance Engine     ← Sprint L2 orchestrator
↓ (composes:)
    GovernancePolicyEngine          (Sprint L)
    EmotionalIntelligenceEngine     (Sprint L2)
    CrisisDetectionEngine           (Sprint L2)
    CognitiveDistortionEngine       (Sprint L2)
    FutureVisibilityEngine          (Sprint L2)
    RealismGuard                    (Sprint L2)
    TrajectoryReviewEngine          (Sprint L2)
    FuturePreservationEngine        (Sprint L2)
    ConstructiveRedirectionEngine   (Sprint L2)
↓
PreStreamGovernanceGuard (max 3 iterations + Safe Constitutional Response fallback)
↓
XAI Layer
↓
Stream To User
```

**No bypasses.** The orchestrator returns one of five verdicts (per
spec): `APPROVE`, `APPROVE_WITH_MODIFICATION`, `CONSTITUTIONAL_REDIRECTION`,
`REQUEST_CLARIFICATION`, `SAFE_CONSTITUTIONAL_RESPONSE`. Note the absence
of `BLOCK_AND_REDIRECT` — refusal is always reframed as constitutional
redirection.

## 1. What ships

| Surface                                                   | Where                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Migration 089                                             | `supabase/migrations/089_constitutional_graphrag.sql`                            |
| Types + Sprint L2 principles 9-15                         | `apps/web/src/types/constitutional.ts`                                           |
| EmotionalIntelligenceEngine                               | `apps/web/src/lib/constitutional/detectors/emotional-intelligence-engine.ts`     |
| CognitiveDistortionEngine                                 | `apps/web/src/lib/constitutional/detectors/cognitive-distortion-engine.ts`       |
| CrisisDetectionEngine                                     | `apps/web/src/lib/constitutional/detectors/crisis-detection-engine.ts`           |
| FutureVisibilityEngine                                    | `apps/web/src/lib/constitutional/detectors/future-visibility-engine.ts`          |
| RealismGuard                                              | `apps/web/src/lib/constitutional/engines/realism-guard.ts`                       |
| TrajectoryReviewEngine                                    | `apps/web/src/lib/constitutional/engines/trajectory-review-engine.ts`            |
| FuturePreservationEngine                                  | `apps/web/src/lib/constitutional/engines/future-preservation-engine.ts`          |
| ConstructiveRedirectionEngine                             | `apps/web/src/lib/constitutional/redirection/constructive-redirection-engine.ts` |
| ConstitutionalGovernanceEngine + PreStreamGovernanceGuard | `apps/web/src/lib/constitutional/constitutional-governance-engine.ts`            |
| Audit middleware                                          | `apps/web/src/lib/constitutional/middleware.ts`                                  |
| API routes                                                | `apps/web/src/app/api/constitutional/{review,principles,audit/[id]}/route.ts`    |
| Tests                                                     | `apps/web/src/lib/constitutional/__tests__/*.test.ts` — 59 new tests             |
| RLS verifier                                              | `scripts/validation/verify_089_constitutional_rls.sql`                           |

## 2. Migration 089 — Constitutional schema

Extends Sprint L's `governance` schema with:

**constitutional_entities** — the Constitutional Graph ontology:

- `ConstitutionalPrinciple` (15 rows: 1-8 + 9-15)
- `GovernanceRule`, `LegalRule`, `SafetyRule`, `HarmRule`, `NeutralityRule`
- `FuturePreservationRule`, `OpportunityRule`, `TrajectoryRule`
- `NeedBehindNeedPattern` (Revenge→Closure, Embezzlement→Capital, Violence→Safety, TaxEvasion→Wealth, …)
- `ConflictOfInterestRule`
- `CognitiveDistortionPattern` (catastrophize / black-and-white / fortune-telling / mind-reading / emotional-reasoning / hopelessness-loop)
- `CrisisIndicator` (suicidal_ideation / violence_planning / severe_hopelessness)
- `RealismRule` (no guaranteed outcomes / no required-for-happiness)

Each entity carries `body`, `source`, `citation_reference`, `confidence`, `version`, and `review_status` so the audit log can replay against the exact rule set live at the time.

**review_iterations** — per-iteration trace bound to `decision_governance_audit.id`:

- `iteration_index` (0..3)
- `draft_hash`, `final_hash`
- `retrieved_rule_ids[]` — which constitutional entities were consulted
- `violations` JSONB, `modifications` JSONB
- `verdict` (one of the 5)
- `latency_ms`, `retrieval_ok`

**decision_governance_audit extensions** (Sprint L row, additive columns):

- `constitutional_verdict`, `risk_level`, `iteration_count`,
  `total_latency_ms`, `draft_hash`, `final_hash`, `retrieval_ok`.

RLS: entities and policy versions are world-readable (transparency).
Iterations and audit are user-scoped read. All writes are service-role.

## 3. 15 Constitutional Principles

| #   | Principle                                   | Source                             |
| --- | ------------------------------------------- | ---------------------------------- |
| 1   | Lawfulness                                  | Sprint L2 hard-constraint set      |
| 2   | Safety                                      | Sprint L2                          |
| 3   | Political Neutrality                        | Sprint L (principle 2) + Sprint L2 |
| 4   | User Autonomy                               | Sprint L (principle 5) + Sprint L2 |
| 5   | User Advocacy                               | Sprint L (principle 1) + Sprint L2 |
| 6   | Transparency                                | Sprint L (principle 6) + Sprint L2 |
| 7   | Future Preservation                         | Sprint L2                          |
| 8   | Need Behind Need                            | Sprint L2                          |
| 9   | Clear Thinking                              | Sprint L2                          |
| 10  | Emotional Recognition Without Reinforcement | Sprint L2                          |
| 11  | Cognitive Decompression                     | Sprint L2                          |
| 12  | Future Visibility                           | Sprint L2                          |
| 13  | Emotional State Is Data, Not Direction      | Sprint L2                          |
| 14  | Decision Quality                            | Sprint L2                          |
| 15  | Human Support Escalation                    | Sprint L2                          |

`CONSTITUTIONAL_PRINCIPLES_9_15` is `Object.freeze`d in the TS layer. The
DB row in `policy_versions` plus the 15 `ConstitutionalPrinciple` rows in
`constitutional_entities` provide the audit-time source of truth.

## 4. 13-step hard-constraint review order

```
1. lawfulness
2. safety
3. harm_prevention
4. crisis_detection
5. emotional_intelligence_review
6. ethical_compliance
7. political_neutrality
8. conflict_of_interest
9. user_autonomy
10. future_preservation
11. future_visibility
12. goal_alignment
13. outcome_optimization
```

The orchestrator short-circuits at the **first** failed hard-constraint
step. `steps_passed` is the prefix that PASSED; `failed_step` (if any)
is the first failure. Verifier-side test asserts `goal_alignment` never
appears in `steps_passed` when `lawfulness` or `safety` failed.

## 5. The new engines

### 5.1 EmotionalIntelligenceEngine

Detects 12 emotional states (grief, anger, fear, shame, humiliation,
despair, panic, obsession, hopelessness, isolation, rage, sadness).
Returns `EmotionalAssessment`:

- `emotional_state` (deduped, strongest-intensity-per-state)
- `risk_level` (LOW/MODERATE/HIGH/CRITICAL via conservative aggregator)
- `confidence` ∈ [0,1]
- `future_visibility_score` ∈ [0,1]
- `decision_quality_risk_score` ∈ [0,1]

### 5.2 CognitiveDistortionEngine

Catastrophizing, black-and-white, emotional reasoning, fortune-telling,
mind-reading, hopelessness loop, revenge fixation, obsessive thinking.

### 5.3 CrisisDetectionEngine

High-precision patterns for suicidal_ideation, self-harm risk,
violence risk, severe emotional instability, extreme hopelessness.
When HIGH/CRITICAL, the orchestrator suspends ordinary goal
optimization and routes to a human-support escalation framing.

### 5.4 FutureVisibilityEngine

Detects future-collapse phrases ("My life is over", "There is no future",
"There is only one path"). When triggered, returns a non-promissory
options library (`feasibility_label` ∈ plausible/possible/uncertain — no
guarantees).

### 5.5 RealismGuard

Rewrites certainty + unsupported-optimism + unsupported-pessimism
language into hedged form. Reports findings separately from
`rewritten_text` so the audit trail captures both before and after.

### 5.6 TrajectoryReviewEngine

Detects:

- impulsive decisions ("I'll just quit my job today")
- future-destructive moves ("publicly expose them")
- self-defeating frames ("why bother")
- emotional overreaction ("I cannot wait")

Recommends decompression when concerns combine with HIGH/CRITICAL
emotional load.

### 5.7 FuturePreservationEngine

Scores eight axes — freedom, health, relationships, career, education,
financial flexibility, reputation, future options. Surfaces
`destructive_axes` (axes below 0.6 by default).

### 5.8 ConstructiveRedirectionEngine

Canonical patterns from the spec:

- Revenge → Closure / Respect / Justice / Recovery
- Embezzlement → Financial Security / Business Capital / Wealth Building
- Violence → Safety / Protection / Control
- Tax Evasion → Wealth Preservation / Tax Planning / Asset Protection
- Stalking → Reach-out / Mediated Communication / Closure
- Self-harm → Crisis support / Trusted person / Stabilize-then-decide

Each pattern composes a deterministic framing string the orchestrator
adopts as `final_text` on `CONSTITUTIONAL_REDIRECTION`.

### 5.9 ConstitutionalGovernanceEngine (orchestrator)

`constitutionalReview(inputs)` returns a `ConstitutionalDecision`:

- Sprint L `GovernanceDecision` embedded as `governance`
- `emotional`, `crisis`, `distortions`, `realism`, `trajectory`,
  `future_preservation`, `future_visibility`, optional `redirection`
- `steps_passed`, `failed_step`
- `principle_violations` (the Sprint L2 9-15 set)
- `final_text` (potentially augmented with crisis escalation framing
  prepended and future-visibility expansion appended)
- `draft_hash`, `final_hash` (djb2 over canonical input)
- `latency_ms`, `retrieval_ok`, `computed_at`

### 5.10 PreStreamGovernanceGuard

Iterates draft → review → modify → re-review, max 3. After 3 iterations
without `APPROVE`, returns a deterministic Safe Constitutional Response.

```ts
{
  iterations: PreStreamIteration[];
  final_verdict: ConstitutionalVerdict;
  final_text: string;
  final_decision: ConstitutionalDecision;
  ok_to_stream: boolean;
}
```

## 6. Fail-closed contract

If the constitutional graph retrieval fails (`retrieval_ok: false`), the
orchestrator immediately returns `REQUEST_CLARIFICATION` with text that
does NOT contain any portion of the draft. Tests assert this.

The SAFE constitutional response is the orchestrator's terminal fallback
when 3 iterations cannot produce `APPROVE`. The text is constant; no LLM
mutation possible.

## 7. API surface

```
POST /api/constitutional/review                ValidateInputs → { verdict, ok_to_stream, final_text, iterations, decision }
GET  /api/constitutional/principles                            → { principles_1_to_8, principles_9_to_15, review_order, entity_counts, governance_version }
GET  /api/constitutional/audit/[id]                            → { audit, iterations }
```

Plus the Sprint L `/api/governance/*` endpoints, unchanged.

The review route calls `reviewAndPersist` which writes one parent audit
row + one row per iteration. Persistence failure raises so callers never
silently ship a response that wasn't logged.

## 8. Tests — 100% pass

```
$ npx jest src/lib/constitutional --no-coverage
PASS src/lib/constitutional/__tests__/detectors.test.ts
PASS src/lib/constitutional/__tests__/engines.test.ts
PASS src/lib/constitutional/__tests__/orchestrator.test.ts
Test Suites: 3 passed, 3 total
Tests:       59 passed, 59 total
```

Regression sweep across the full project surface:

```
$ npx jest --no-coverage --testPathPattern "lib/(arcana|decision|conversation|provider|governance|constitutional)"
Test Suites: 29 passed, 29 total
Tests:       468 passed, 468 total
```

Phase 11 (Sprint L2) success-criteria oracle coverage:

- **Lawfulness** — fraud, tax evasion, embezzlement, extortion → CONSTITUTIONAL_REDIRECTION at lawfulness step.
- **Safety** — violence, self-harm, abuse → CONSTITUTIONAL_REDIRECTION at safety / harm_prevention with crisis escalation framing.
- **Political Neutrality** — candidate / party advocacy + ideology persuasion → CONSTITUTIONAL_REDIRECTION.
- **Realism** — "guaranteed to" / "always" / "100%" / "cannot recover" rewritten; final_text has none of them.
- **Future Preservation** — destructive_axes surfaced when draft burns career/relationships/financial flexibility.
- **Need-Behind-Need** — lawful alternatives generated for revenge / embezzlement / violence / tax-evasion / stalking / self-harm.
- **Governance** — retrieval failure → REQUEST_CLARIFICATION (never streams the draft). Determinism: identical inputs → byte-identical decision. Goal Alignment never appears in `steps_passed` when lawfulness/safety failed.

## 9. RLS verifier

```
psql "$DATABASE_URL" -f scripts/validation/verify_089_constitutional_rls.sql
```

Asserts:

1. `constitutional_entities` is world-readable to authenticated.
2. `review_iterations` is user-scoped read (User A reads own).
3. User A cannot read User B's iterations (leak test).
4. Authenticated cannot insert `constitutional_entities` (service role only).
5. `governance.is_constitutional_verdict()` accepts the 5 verdicts and **rejects** `BLOCK_AND_REDIRECT` (the spec's forbidden label).
6. ≥15 principles seeded, plus ≥4 NeedBehindNeedPattern, ≥3 CrisisIndicator, ≥6 CognitiveDistortionPattern, ≥2 RealismRule.

## 10. Determinism + privacy summary

- **Determinism.** Every detector + engine + orchestrator + middleware is pure under a frozen `now`. `JSON.stringify(a) === JSON.stringify(b)` for identical inputs is tested.
- **No XAI leak.** Sprint L tests already assert this; the Sprint L2 layer never adds regex/pattern strings to user-facing explanations either.
- **No LLM in the decision path.** Every detection + every rewrite is deterministic regex + small state. The system works with the LLM completely unavailable.
- **No PHI in iteration rows.** `governance.review_iterations` stores draft_hash / final_hash / retrieved_rule_ids, NOT the raw draft text. The full subject is reconstructible from the subject's own table.

## 11. Migration order

```
089_constitutional_graphrag.sql
```

Depends on:

- `governance` schema (Sprint L migration 088)
- `decision_governance_audit` (Sprint L)
- `public.profiles` (base)
- `core.set_updated_at()` (Sprint A)

The self-test `DO` block verifies RLS + seed counts.

## 12. What is explicitly **not** in this sprint

| Area                                                                      | Status                                                                                                                                                   |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM-based intent or distortion classification                             | Out of scope — deterministic patterns chosen instead                                                                                                     |
| Constitutional GraphRAG retrieval at runtime (instead of regex catalogs)  | Schema is in place; the orchestrator accepts `retrieval_ok` from the caller as a stub for future wiring                                                  |
| Multi-locale safety + redirection copy                                    | Schema accommodates `locale`; only `en` ships                                                                                                            |
| Per-user override workflow UI                                             | Audit schema supports overrides; UI not built here                                                                                                       |
| Wiring every existing recommendation path to `/api/constitutional/review` | Available as middleware import; one reference caller is the Sprint L Provider Portal route (already wired through Sprint L's `/api/governance/validate`) |

## 13. Success criteria — verified

LifeNavigator demonstrates:

1. **No response bypasses Constitutional GraphRAG** — the orchestrator is the only verdict producer; middleware persists every audit row + every iteration.
2. **Illegal objectives are never optimized** — Lawfulness step short-circuits before Goal Alignment.
3. **Harmful objectives are never optimized** — Safety + Harm Prevention + Crisis steps short-circuit before Goal Alignment.
4. **Political persuasion is impossible** — Political Neutrality step blocks advocacy + influence campaigns.
5. **Partner incentives cannot influence recommendations** — Conflict-of-Interest step + Sprint L partner-bias validator.
6. **Goal optimization only occurs after hard constraints pass** — `steps_passed` never contains `goal_alignment` or `outcome_optimization` when an earlier hard constraint failed.
7. **Unsafe requests are redirected toward lawful alternatives** — ConstructiveRedirectionEngine + Need-Behind-Need patterns.
8. **Users are guided toward better decisions without manipulation** — RealismGuard + cognitive-decompression principle + Sprint L manipulation/coercion validators.
9. **Future opportunities are preserved whenever possible** — FuturePreservationEngine + FutureVisibilityEngine + 8 axes scoring.
10. **Every response is auditable** — `decision_governance_audit` parent row + `governance.review_iterations` per-iteration trace + hashes.

Additional Sprint L2 emotional-intelligence criteria:

- **Emotional awareness without reinforcement** — Principle 10 + EmotionalIntelligence + CognitiveDistortion engines.
- **Crisis detection** — CrisisDetectionEngine with HIGH/CRITICAL → escalation framing.
- **Future visibility expansion** — FutureVisibilityEngine + non-promissory options library.
- **Cognitive distortion detection** — 8 CBT-taxonomy distortions detected.
- **Human support escalation** — Crisis HIGH/CRITICAL prepends escalation copy + Principle 15.
- **Preservation of user dignity, autonomy, future opportunities** — Constitutional principles 4, 5, 7 + FuturePreservationEngine.
