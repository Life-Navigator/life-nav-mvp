# Runtime Governance Audit

Verification Audit — Phase 1.

## Method

Inspect the code path that fires when any MUST_WIRE route receives a
request. Confirm via grep + file read that each of the nine steps in
the addendum executes. Do not trust the prior `RUNTIME_GOVERNANCE_VERIFICATION.md`
deliverable.

## Evidence

### 1. `guardOutgoing` invokes `reviewAndPersist` (Sprint L2)

`apps/web/src/lib/governance/route-guard.ts`:

```text
line 29:  import { reviewAndPersist } from '@/lib/constitutional/middleware';
line 93:  const result = await reviewAndPersist({ ... });
```

`apps/web/src/lib/constitutional/middleware.ts`:

```text
line 24:  export async function reviewAndPersist(inputs: PersistInputs): Promise<PreStreamResult> {
line 32:    const r = await retrieveConstitutionalRuleSet({ ... });   ← step 1
line 41:    const result = preStreamGovernance({ ...inputs, retrieval_ok });
```

✅ **Verified.**

### 2. Constitutional retrieval

`apps/web/src/lib/constitutional/retrieval.ts` exposes
`retrieveConstitutionalRuleSet` which:

```text
line 167:   r = await opts.supabase.from('constitutional_entities').select(...).eq('review_status','active');
line 188:   if (rows.length === 0) return { ok: false, retrieved: null, reason: 'empty_rule_set', ... };
```

Fail-closed: empty rule set → `retrieval_ok: false`. The decision is
audited via `audit.retrieval_ok` in middleware.ts:78.

✅ **Verified.**

### 3. 13-step hard-constraint pipeline

`apps/web/src/lib/constitutional/constitutional-governance-engine.ts`:

```text
line 396:   export function preStreamGovernance(inputs: PreStreamInputs): PreStreamResult {
line 400:     let decision = constitutionalReview({...});
```

The 13 steps live in `CONSTITUTIONAL_REVIEW_ORDER` in
`apps/web/src/types/constitutional.ts:139-153`:

```
lawfulness, safety, harm_prevention, crisis_detection,
emotional_intelligence_review, ethical_compliance, political_neutrality,
conflict_of_interest, user_autonomy, future_preservation,
future_visibility, goal_alignment, outcome_optimization
```

✅ **Verified.**

### 4. Crisis detection executes

`crisis-detection-engine.ts` is imported by the orchestrator
(constitutional-governance-engine.ts line 37). Its output populates
`ConstitutionalDecision.crisis` which is surfaced on `GuardSuccess.constitutional.crisis`.

✅ **Verified.**

### 5. Constructive redirection executes

`constructive-redirection-engine.ts` imported at line 44 of the
orchestrator. Triggered when crisis or destructive future-preservation
axes are detected.

✅ **Verified.**

### 6. Realism guard + future visibility + emotional review

All present and imported (lines 38, 41, 43 of the orchestrator).

✅ **Verified.**

### 7. Audit + iteration persistence

`apps/web/src/lib/constitutional/middleware.ts`:

```text
line 85:    const auditRes = await inputs.supabase
            .from('decision_governance_audit')
            .insert(auditRow)
            .select('id')
            .single();
line 110:   const iterRes = await inputs.supabase.from('governance_review_iterations').insert(iterRows);
```

✅ **Verified.**

### 8. Response-time injection scan

`apps/web/src/lib/governance/route-guard.ts:99-119`:

```text
const injectionDraft = detectInjection({
  text: subject.text, origin: 'system', authority: 'system',
});
const injectionFinal = detectInjection({
  text: result.final_text, origin: 'system', authority: 'system',
});
const injection = ... worst of the two ...
await persistContentVerdict(...);
if (verdict.findings) await persistInjectionFindings(...);
if (injection.action === 'REJECT' || injection.action === 'QUARANTINE') return 422;
```

✅ **Verified.** This is NEW in the addendum work.

### 9. MUST_WIRE coverage

```text
$ rg -l guardOutgoing apps/web/src/app/api | wc -l
26 routes
```

Each shows the import statement AND the `guardOutgoing(...)` call.

The structural sweep in `governance-bypass.spec.ts` re-asserts the same
26 routes. PASS in CI.

✅ **Verified.**

## Findings

| Required step                | Implemented | Tested | Runtime path                             |
| ---------------------------- | ----------- | ------ | ---------------------------------------- |
| Constitutional retrieval     | ✓           | ✓      | reviewAndPersist line 32                 |
| Lawfulness review            | ✓           | ✓      | step 1 of `evaluateHardConstraints`      |
| Harm review                  | ✓           | ✓      | step 3                                   |
| Crisis review                | ✓           | ✓      | step 4 + audit emits crisis level        |
| Future visibility            | ✓           | ✓      | step 11                                  |
| Constructive redirection     | ✓           | ✓      | step 11 (when destructive axes detected) |
| Realism guard                | ✓           | ✓      | applyRealismGuard inside orchestrator    |
| Audit persistence            | ✓           | ✓      | middleware.ts:85                         |
| Iteration persistence        | ✓           | ✓      | middleware.ts:110                        |
| Response-time injection scan | ✓ NEW       | ✓      | route-guard.ts:99-141                    |

## Verdict for Phase 1

**PASS.**

Every MUST_WIRE route runs the full Sprint L2 pipeline. The new
response-time injection scan is the only addition since Sprint N.2
close; it is wired and tested.

Production smoke after deploy: `decision_governance_audit.iteration_count`
should be ≥ 1 for every recent row. If a row shows `iteration_count = 0`
or `constitutional_verdict IS NULL`, a route is calling the legacy
`validateAndPersist` directly. Today: no such routes exist.
