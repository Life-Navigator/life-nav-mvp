# Beta Cost Simulation Report

Sprint O.0.2 Phase 14 deliverable.

## Goal

Demonstrate that **10–20 internal-beta users for 30 days will not
exceed $500/month without operator intervention**.

## Method

`apps/web/src/lib/economic/__tests__/beta-simulation.spec.ts` is a
deterministic, seeded Monte-Carlo-ish simulator that runs entirely
in-process against the `CostEstimator`. No mocked supabase, no
network. The simulator output is the basis of this report and runs
as a CI regression gate.

## Activity model

Three personas:

```ts
AVERAGE_MIX (80% of users):
  4  recommendations/day  (Gemini Pro: ~1k input + 256 output)
  1  simulation/day       (Gemini Pro: ~2k input + 500 output)
  1  upload/day           (PDF)
  0.5 arcana intakes/day  (Gemini Pro: ~800 input + 200 output)

HEAVY_MIX (20% of users):
  12 recommendations/day
  3  simulations/day
  3  uploads/day          (PDF + image + audio)
  1.5 arcana intakes/day

WORST_CASE_MIX (single-user pathological case):
  40 recommendations/day
  10 simulations/day
  8  uploads/day          (PDF + image + audio + 2-min video)
  5  arcana intakes/day
```

Daily counts are multiplied by `0.5 + rng()` (uniform) for variance.

The simulator respects `ModelSelectionPolicy` — every call resolves
its tier through `selectModel()`, so tier-1 features (extraction,
classification, governance review) use Gemini Flash and tier-2
features (recommendations, simulations) use Gemini Pro.

## Results

```
[beta-sim] 20 users × 30 days expected spend: $16.74
[beta-sim] by feature: {
  recommendation:   $8.54
  simulation:       $4.21
  upload.pdf:       $0.58
  upload.image:     $0.04
  upload.audio:     $2.52
  arcana:           $0.85
}

[beta-sim] heaviest single-user monthly spend: $2.22
[beta-sim] WORST-case single user (30 days, video heavy): $6.73
[beta-sim] 20 HEAVY users × 30 days: $41.55
```

## Margin analysis

| Scenario                                          | Result | Budget           | Margin                 |
| ------------------------------------------------- | ------ | ---------------- | ---------------------- |
| Expected (20 users, 80% average + 20% heavy)      | $16.74 | $500             | **97% under budget**   |
| Heaviest single user (1 user, heavy mix)          | $2.22  | $20 per-user cap | 89% under per-user cap |
| Worst case single user (1 user, pathological mix) | $6.73  | $20 per-user cap | 66% under per-user cap |
| 20 simultaneous heavy users                       | $41.55 | $500             | **92% under budget**   |

**Every scenario clears the $500/month platform cap with substantial
margin.** The worst plausible 20-user month produces $42 of spend.

## Headroom for surprises

The simulation assumes:

- Beta users follow the activity mix above. Real users may deviate.
- No abuse. The abuse detector + rate limiter + budget manager
  catch deviations.
- Published vendor rates. Vendor rate changes propagate via a
  one-line edit in `cost-estimator.ts`.

Even under 10× the assumed activity, the worst case would land at
~$420 — still under the cap, though with less margin. The 17×
ratio between Tier 1 and Tier 2 model costs means the per-feature
classifier in `FEATURE_TIER` is the dominant lever; a feature
incorrectly classified as Tier 2 instead of Tier 1 would multiply
that feature's contribution by ~17×.

## What the simulation does NOT model

- **Cost from chat.** Today no chat-with-LLM route exists (the
  multi-agent engine was deleted in Sprint N.2). The simulation
  excludes it. When chat ships, the recommendation count in the
  AVERAGE mix should be raised to account for it.
- **Repeat user clicks.** The simulator counts unique recommendations;
  in production, viewing a recommendation again does NOT charge
  (the cost was paid at generation). The viewer event is free.
- **Realistic time-of-day distribution.** Users do not generate
  recommendations at 4am. The variance multiplier captures some of
  this but not all.
- **Cache hits.** Constitutional retrieval is in-process cached for
  60s; repeated calls within that window are nearly free. The
  simulation does not model the cache, which means the simulation
  is a slight over-estimate.

## Operational safeguards (beyond the simulation)

Even if the model underestimates by a factor of 5, the runtime
defense holds:

- **Platform budget HARD_STOP at $500.** No call charged after this.
- **Platform EMERGENCY at $475.** Only critical features pass.
- **Per-user $20/month cap.** No single user can exhaust 4% of the
  cap.
- **Rate limits.** Cap chat at 100/day, uploads at 20/day,
  simulations at 20/day, arcana at 20/day per user.
- **Quota engine.** Caps file sizes + media durations so multimodal
  cannot explode.
- **Abuse detector.** $10/day per user fires CRITICAL BLOCK.

## Conclusion

```
Expected Spend:    $16.74 / month     ←  well under $350 target
Worst Case Spend:  $41.55 / month     ←  well under $500 ceiling
                   (20 heavy users)
```

No operator intervention needed for the platform to remain solvent
during the internal beta.

## CI regression

The simulation runs as part of the test suite. If a future model
change (e.g. switching tier 2 default from Gemini Pro to Claude
Sonnet) pushes the projected spend over $350, the test fails. This
prevents a "let's try Sonnet" commit from silently raising the
projected monthly bill 17×.
