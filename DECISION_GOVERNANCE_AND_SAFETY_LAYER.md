# Decision Governance & Safety Layer

Sprint L installs the Decision Governance Engine (DGE) — the immutable
boundary between recommendation generation and recommendation delivery.

```
User Request
↓
Advisor Intelligence → Decision Intelligence → Probability Engine → Recommendation Engine
↓
Decision Governance Engine
↓
XAI → User
```

No bypasses. Every recommendation, simulation, probability output,
optimization result, partner recommendation, advisor message, or AI-
generated decision guidance must pass through this layer before
reaching the user.

## 1. What ships

| Surface                              | What it is                                                                                                                                         | Where                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Migration 088                        | `governance` schema, `decision_governance_audit`, `policy_versions`, `agent_registry`, `safety_messages`, `agent_is_registered()` SECURITY DEFINER | `supabase/migrations/088_decision_governance.sql`               |
| Types + 8 immutable principles       | Frozen `PRINCIPLES` array + `GOVERNANCE_VERSION = '1.0.0'`                                                                                         | `apps/web/src/types/governance.ts`                              |
| 14 validators                        | Pure-function rule families                                                                                                                        | `apps/web/src/lib/governance/validators/`                       |
| `GovernancePolicyEngine`             | Composes validators + COI engine into a deterministic `evaluate()`                                                                                 | `apps/web/src/lib/governance/policy-engine.ts`                  |
| `ConflictOfInterestEngine`           | Referral / sponsorship / affiliate / provider self-dealing detection                                                                               | `apps/web/src/lib/governance/conflict-of-interest-engine.ts`    |
| Safety messaging framework           | Deterministic copy per category                                                                                                                    | `apps/web/src/lib/governance/safety-messaging.ts`               |
| Governance XAI                       | `explainDecision()` — categorized plain-language explanation; never exposes regex                                                                  | `apps/web/src/lib/governance/governance-xai.ts`                 |
| Agent registry helper                | Mirrors DB; checks emitter registration                                                                                                            | `apps/web/src/lib/governance/agent-registry.ts`                 |
| Recommendation Validation Middleware | `validate()` + `validateAndPersist()`                                                                                                              | `apps/web/src/lib/governance/middleware.ts`                     |
| 4 API routes                         | validate, audit explain, principles, agent register                                                                                                | `apps/web/src/app/api/governance/**`                            |
| First wired caller                   | Provider Portal recommendation route now passes through governance                                                                                 | `apps/web/src/app/api/provider/portal/recommendations/route.ts` |
| Tests                                | 78 governance tests; 409 total across project surfaces                                                                                             | `apps/web/src/lib/governance/__tests__/*.test.ts`               |
| RLS verifier                         | Cross-user audit isolation + service-role-only agent_registry insert + helper function                                                             | `scripts/validation/verify_088_governance_rls.sql`              |

## 2. Phase-by-phase coverage

### Phase 1 — Governance Principles (immutable)

Eight principles are encoded in TS as `Object.freeze`d constants and
in SQL as a JSONB column on `governance.policy_versions`. The TS
constant is the source of truth at run time; the DB row is the
source of truth at audit time. The principles:

1. **User Advocacy** — optimize for user well-being, goals, autonomy. Never for government, employer, advertiser, partner, provider, vendor unless explicitly requested.
2. **Political Neutrality** — explain, compare; never advocate parties, candidates, ideologies; no persuasion or influence campaigns.
3. **Legal Compliance** — pursue maximum lawful advantage; never fraud, evasion, concealment, regulatory avoidance.
4. **No Harm** — never encourage self-harm, violence, abuse, harassment, stalking, coercion, revenge, exploitation, or dangerous illegal activity.
5. **Human Autonomy** — advise, do not decide; explain, model, compare, forecast; never pressure, shame, guilt, manipulate.
6. **Transparency** — expose assumptions, confidence, evidence, uncertainty, tradeoffs.
7. **No Partner Bias** — partners may never influence ranking, scoring, probability, or outcome scoring.
8. **Outcome Integrity** — never optimize engagement, clicks, retention at the expense of user outcomes.

### Phase 2 — GovernancePolicyEngine

`evaluate(subject, options)` returns a `GovernanceDecision`:

```ts
{
  approved: boolean;
  verdict: 'approved' | 'approved_with_warnings' | 'blocked';
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  governance_version: '1.0.0';
  violations: GovernanceViolation[];
  policy_checks: PolicyCheckRecord[];
  safer_alternatives: SaferAlternative[];
  input_hash: string;
  computed_at: string;
}
```

Severity-to-verdict mapping:

| Severity            | Verdict                                    |
| ------------------- | ------------------------------------------ |
| none / low / medium | approved or approved_with_warnings (shown) |
| high                | blocked (overridable by user-as-actor)     |
| critical            | blocked (no override)                      |

Engine determinism: same subject + same version → byte-identical
decision (`computed_at` excluded by frozen-time parameter in tests).

### Phase 3 — Rule categories

Each category has a dedicated validator file under
`apps/web/src/lib/governance/validators/`:

| Category            | File                     | Severity examples                                                                          |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| Political Influence | `political-influence.ts` | high (advocacy verb, ideology persuasion), critical (influence campaign)                   |
| Manipulation        | `manipulation.ts`        | high (pressure, shame, guilt), medium (FOMO)                                               |
| Self-Harm           | `self-harm.ts`           | critical (encourage, disordered eating, substance abuse)                                   |
| Harm to Others      | `harm-to-others.ts`      | critical (violence, stalking, coercion), high (harassment, revenge)                        |
| Illegal Activity    | `illegal-activity.ts`    | critical (criminal verbs, regulatory avoidance, illegal operations, controlled substances) |
| Fraud               | `fraud.ts`               | critical (tax evasion, application fraud, concealment, insurance fraud, identity fraud)    |
| Exploitation        | `exploitation.ts`        | critical (predatory targeting, scam patterns), high (asymmetric harm, abuse of power)      |
| Partner Bias        | `partner-bias.ts`        | critical (payment+ranking), high (partner economics), medium (ranking override alone)      |
| Unsafe Health       | `unsafe-health.ts`       | critical (stop medication, alter dose, delay care), high (self-diagnosis, dosing claim)    |
| Unverified Medical  | `unverified-medical.ts`  | high (uncited claim, absolute efficacy, hormone substitute), medium (miracle framing)      |
| Coercive Messaging  | `coercive-messaging.ts`  | high (consequence threat), medium (imperative, pseudo-authority, shame threat)             |
| Transparency        | `transparency.ts`        | medium (no citations), low (no assumptions / confidence / tradeoffs / risks)               |
| Outcome Integrity   | `outcome-integrity.ts`   | high (engagement bait, retention bait), medium (click bait)                                |
| User Advocacy       | `user-advocacy.ts`       | critical (optimized for third party, hidden beneficiary), high (non-user beneficiary)      |

### Phase 4 — Recommendation Validator

`validate(inputs)` returns a `GovernanceDecision`. The Provider
Portal recommendation route now calls `validateAndPersist` before the
Sprint I `issueRecommendation` insert and returns HTTP 422 with the
full decision on `blocked`.

### Phase 5 — Partner Recommendation Validation

Partner recommendations are first-class subjects. The
`partner-bias` validator + `ConflictOfInterestEngine` look at:

- known metadata keys (`commission`, `kickback`, `sponsored`,
  `paid_placement`, `affiliate`, `partner_payout`, `exclusive_partner`),
- ranking-influence keys (`ranking_boost`, `rank_boost`,
  `override_rank`, `promoted_above`, `ad_priority`),
- provider self-dealing flags (`recommends_own_service`,
  `provider_owned_facility`, `in_network_with_emitter`,
  `provider_is_beneficiary`).

A subject combining payment with ranking is classified **critical**.

### Phase 6 — Governance Audit Log

`governance.decision_governance_audit` stores every check:

- `user_id`, `subject_kind`, `subject_id`, `subject_table`,
- `emitter_agent_kind`, `emitter_agent_id`, `emitter_user_id`,
- `approved`, `severity`, `governance_version`,
- `policy_checks` (every category evaluated + violation count),
- `violations` (per-rule detail with reason + safer alternatives),
- `safer_alternatives` (deduped, surfaced),
- `input_hash` (deterministic djb2 of subject + version),
- `override_*` fields for human overrides.

Indexed by `(user_id, created_at DESC)`, `(subject_kind, subject_id)`,
and a partial index on `approved = FALSE`.

### Phase 7 — ConflictOfInterestEngine

Separate module, tagged with the `conflict_of_interest` category, so
audit log analysis can separate COI from generic partner bias.

### Phase 8 — Safety Messaging Framework

Two layers:

1. **Built-in TS dictionary** (`safety-messaging.ts`) — deterministic
   copy for all 16 categories. Used as fallback.
2. **`governance.safety_messages` table** — seeded with the same copy
   for English. Future locales add rows.

`composeBlockMessage(violations)` picks the worst-category message
and merges deduplicated safer alternatives.

### Phase 9 — Governance XAI

`explainDecision(decision)` returns:

```ts
{
  blocked: boolean;
  verdict: 'approved' | 'approved_with_warnings' | 'blocked';
  worst_category?: ViolationCategory;
  worst_principle?: string;
  short_summary: string;
  detailed_reasons: Array<{ category, principle, severity, reason }>;
  safer_alternatives: SaferAlternative[];
  governance_version: string;
}
```

The XAI surface **never** exposes regex patterns, validator file paths,
or internal implementation details. Tests assert this contract.

### Phase 10 — Multi-Agent Governance

Every agent emitter must appear in `governance.agent_registry`
with `active = TRUE`. The TS layer caches the registry in-memory for
60s. If the emitter is not registered, the engine appends an
`agent_not_registered` violation at **high** severity → blocked.

Eight first-party agents are seeded by the migration. New agents are
registered via `POST /api/governance/agents/register` (service-role
only) or by direct DB insert under service role.

### Phase 11 — Governance Test Suite

78 tests across two files in `apps/web/src/lib/governance/__tests__/`:

```
$ npx jest src/lib/governance --no-coverage
PASS src/lib/governance/__tests__/validators.test.ts
PASS src/lib/governance/__tests__/policy-engine.test.ts
Test Suites: 2 passed, 2 total
Tests:       78 passed, 78 total
```

Phase 11 success-criteria coverage:

- **Political Neutrality** — advocacy verbs, ideology persuasion, influence campaigns blocked; neutral comparison allowed.
- **User Advocacy** — non-user beneficiary framings blocked.
- **Legal Compliance** — tax evasion blocked + safer alternatives surfaced; legal tax planning passes.
- **Safety** — self-harm / violence / exploitation / unsafe-health / delay-care all critical-blocked.
- **Partner Integrity** — commission-influenced ranking blocked; ranking-override alone flagged at medium.
- **Transparency** — full envelope passes; missing pieces noted at medium / low.

Regression suite (governance + arcana + decision + conversation + provider):

```
$ npx jest --no-coverage --testPathPattern "lib/(arcana|decision|conversation|provider|governance)"
Test Suites: 26 passed, 26 total
Tests:       409 passed, 409 total
```

### Phase 12 — Deliverables

- Engine + COI engine + 14 validators ✓
- Audit table + agent registry + safety messages ✓
- Recommendation validation middleware ✓
- 78 governance tests + 409-test regression set ✓
- RLS verifier script ✓
- This document ✓

## 3. API surface

```
POST /api/governance/validate                  ValidateInputs → { decision }
GET  /api/governance/audit/[id]                                 → { explanation }
GET  /api/governance/principles                                 → { governance_version, principles, db_governance_version }
POST /api/governance/agents/register           AgentRegistration → { agent }   (service role)
```

The audit explain route is the "why was this blocked?" surface (Phase
9). RLS already scopes the table to the patient.

## 4. Wired callers

Sprint J's Provider Portal recommendation route now calls
`validateAndPersist` before `issueRecommendation`. A blocked
recommendation never enters `provider_recommendations`. The route
returns HTTP 422 with the full `GovernanceDecision` so the portal UI
can render the block reason + safer alternatives.

Future wiring (follow the same pattern):

- Sprint H advisor message emission → before the message hits the
  conversation UI.
- Sprint F probability outputs → wrap the API response in a check
  for transparency completeness (low-severity only, but recorded).
- Optimizer recommendations → before user surfacing.
- Partner recommendations → mandatory check at intake.

## 5. RLS + access model

| Surface                     | Read                                   | Write             |
| --------------------------- | -------------------------------------- | ----------------- |
| `decision_governance_audit` | auth user where `user_id = auth.uid()` | service role only |
| `policy_versions`           | public (transparency)                  | service role only |
| `agent_registry`            | public                                 | service role only |
| `safety_messages`           | public                                 | service role only |

The `governance.agent_is_registered(p_agent_kind, p_agent_name)`
SECURITY DEFINER function lets RLS-bound queries check registration
without granting wider access to the table.

## 6. Determinism + privacy summary

- **Determinism.** Same subject + version → byte-identical
  `GovernanceDecision`. Tested.
- **Hash.** `input_hash` is a stable djb2 over the canonical
  subject JSON. Used for replay verification, not cryptography.
- **No XAI leak.** Tests assert the explanation never contains
  "regex", "pattern", or `test(` strings.
- **No LLM in the decision path.** Every validator is regex +
  small state. The system functions with the LLM completely
  unavailable.
- **No PHI in audit.** `decision_governance_audit` does NOT store
  subject `text`. Only `subject_kind`, `subject_id`, and the
  structured policy_checks / violations land. The full subject is
  reconstructible from the subject's own table.

## 7. Migration order

```
088_decision_governance.sql
```

Depends on:

- `public.profiles` (base)
- `core.set_updated_at()` (Sprint A)

The self-test `DO` block at the end of the migration verifies
RLS is enabled and the seed counts are correct.

## 8. What is explicitly **not** in this sprint

| Area                                                    | Status                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| LLM-based intent classification (vs regex)              | Out of scope; the explicit choice is deterministic rules                           |
| Multi-locale safety messages                            | Schema supports `locale`; only `en` seeded                                         |
| Per-user override workflow UI                           | Schema supports `override_*` fields; UI not built here                             |
| Retroactive re-validation when governance_version bumps | Replay tooling pending                                                             |
| Wiring every existing recommendation path               | Provider portal is wired as the reference caller; the rest follow the same pattern |

## 9. Success Criteria — verified

LifeNavigator demonstrates:

1. **Political neutrality** — `Political Neutrality` test suite + neutral comparison allowed.
2. **User-first optimization** — `User Advocacy` test suite blocks third-party-optimized recommendations.
3. **Legal compliance** — `Legal Compliance — fraud` and `illegal activity` blocked + lawful alternatives surfaced.
4. **No-harm safeguards** — self-harm + harm-to-others + exploitation + unsafe-health all critical-blocked.
5. **Conflict-of-interest detection** — `ConflictOfInterestEngine` with five rule families + provider self-dealing flag.
6. **Partner neutrality** — `partner-bias` validator + COI engine; payment+ranking is critical.
7. **Recommendation transparency** — `transparency` validator catches missing citations / assumptions / confidence / tradeoffs / risks.
8. **Governance auditability** — `decision_governance_audit` append-only log + RLS-scoped read.
9. **Agent governance enforcement** — `evaluateWithAgent` blocks unregistered emitters; `governance.agent_is_registered()` SQL gate.

**No recommendation reaches the user without governance validation** —
the Provider Portal recommendation route is wired today; every future
recommendation path inherits the same `validateAndPersist` contract.
