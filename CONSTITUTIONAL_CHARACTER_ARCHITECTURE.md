# Constitutional Character Architecture

Sprint N.3 deliverable.

## Position in the pipeline

Sprint L produced safety. Sprint L2 produced constitutional safety.
Sprint N.3 adds **character** — the layer that asks not just "is this
safe?" but "is this wise, honorable, responsible, and worthy of
trust?"

```
Sprint L           Sprint L2                Sprint N.3
─────────          ─────────                ─────────
Is it safe?   →   Is it constitutional?  →  Is it wise?
                                            Is it honorable?
                                            Is it responsible?
                                            Is it dignified?
```

Character is the LAST review before the final text is shipped. It
does not replace governance — it composes with it.

## Module layout

```
apps/web/src/lib/constitutional/character/
├── types.ts                    types + thresholds + score shapes
├── principles.ts               9 universal virtues + advisor archetypes
├── style-guard.ts              tone violations (anger / insult / etc.)
├── family-table.ts             Family Table Test
├── trusted-advisor.ts          Trusted Advisor Test
├── flourishing-review.ts       9 flourishing axes
├── character-scorer.ts         8-dimensional CharacterScore
├── constructive-guidance.ts    refusal-with-next-step composer
├── character-engine.ts         orchestrator (reviewCharacter)
└── index.ts                    entry / re-exports
```

## Composition with the existing engine

`reviewCharacter()` is called inside
`apps/web/src/lib/constitutional/constitutional-governance-engine.ts`
AFTER the existing 13-step constitutional review computes `final_text`.
Its output is attached to `ConstitutionalDecision.character` (new
optional field) for the audit chain.

Behaviour when character review fails:

- Only LOW/MODERATE-severity style findings → swap in
  `style.sanitized_text` (vulgarity stripped, false-certainty
  language softened, etc.).
- Anything else → downgrade verdict to `APPROVE_WITH_MODIFICATION`
  so the orchestrator's redraft loop gets another pass.

Critical issues (CRITICAL style severity, health/safety/financial
harm, dignity violation, multiple trusted-advisor concerns) flag
`needs_regeneration: true` and force the orchestrator to retry.

## The 14-step review order

The `CHARACTER_REVIEW_ORDER` constant in `types/constitutional.ts`
documents the new 14-step character review order:

```
1.  Lawfulness
2.  Safety
3.  Life Preservation
4.  Privacy
5.  Future Preservation
6.  Truthfulness
7.  Realism
8.  Character Review              ← NEW (this layer)
9.  Dignity Preservation
10. Need Behind Need
11. Long-Term Outcome Analysis
12. Goal Alignment
13. Communication Quality
14. Final Character Verification  ← NEW (this layer)
```

Steps 1-7 are the existing Sprint L2 hard-constraint order. Steps 8-14
add the character-specific work. The runtime engine maps the steps
to its existing implementations (Sprint L2 covers most of 1-7 and
10-12 already; the character module covers 8, 9, 13, 14).

## Data flow

```
inputs.draft_text
   ↓
StyleGuard.scanStyle    → findings + sanitized_text
FamilyTableTest          → passes + failures + dignity_violation
TrustedAdvisorTest       → passes + concerns
FlourishingReview        → 9 axis deltas + overall + harming_axes
   ↓
CharacterScorer          → 8-dimensional CharacterScore + hard-fail rules
   ↓
CharacterEngine          → CharacterReview {
                              score,
                              style (findings + sanitized_text),
                              family_table,
                              trusted_advisor,
                              flourishing,
                              needs_regeneration,
                              suggested_rewrite,
                              findings (audit-friendly)
                            }
```

## What gets persisted

The `character` field on the `ConstitutionalDecision` flows through
the existing audit chain. Operators can:

- Inspect the 8-dimensional score per audit row.
- Identify the dimension that failed (`weakest`).
- Read the per-rule findings (`character.findings`).
- See the suggested constructive rewrite that the engine would have
  used.

The seeded `governance.constitutional_entities` rows from migration
100 carry the canonical text of each principle + advisor pattern +
flourishing rule so `rule_id` references in the audit resolve to
human-readable bodies.

## Thresholds

```
CHARACTER_OVERALL_THRESHOLD = 0.7   (arithmetic mean of 8 dimensions)
CHARACTER_WEAKEST_THRESHOLD = 0.4   (any single dimension)
```

Hard-fail rules override the thresholds:

1. Any CRITICAL style finding → fail.
2. `flourishing.harming_axes` contains `health` / `safety` /
   `financial` → fail.
3. `trusted_advisor.concerns.length >= 2` → fail.
4. `family_table.contains_dignity_violation === true` → fail.

## Why the thresholds are set where they are

The 0.7 overall floor came out of calibration tests
(`character.spec.ts`). Lower than 0.7 admitted insulting responses;
higher than 0.7 rejected acceptable advisor messages that legitimately
landed difficult truths. Sprint N.3 ships with the calibration the
49 character tests assert.

## What this layer does NOT do

- **It does not rewrite the response when the failure is structural.**
  When the issue is content (clinical advice, partisan endorsement),
  the orchestrator must regenerate. The character engine can suggest a
  constructive-guidance envelope, but it cannot author the substance.
- **It does not encode any tradition, ideology, or political view.**
  The seeded `AdvisorBehaviorPattern` rows describe descriptively
  ("a great mentor offers truth gently") without endorsing a
  particular faith, party, or culture.
- **It does not replace the BudgetManager, RateLimiter, or
  CircuitBreaker.** Character review fires for every draft; economic
  governance decides whether the call runs at all.

## Tests

```
$ npx jest src/lib/constitutional/character --no-coverage
PASS — 49 tests
```

The full test suite remains green:

```
$ npx jest --no-coverage
Test Suites: 88 passed, 88 total
Tests:       1231 passed, 1231 total
```
