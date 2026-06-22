# MY_LIFE_DEPENDENCY_MAP.md — Phase 2

Classification of every top-level operation in `MyLifeService.my_life()` — what's independent vs dependent. This is what made the parallelization safe.

| Operation                                                             | Input            | Class                                         | Parallelized?                  |
| --------------------------------------------------------------------- | ---------------- | --------------------------------------------- | ------------------------------ |
| `life.snapshot(ctx)`                                                  | ctx only         | **independent** (root data, but no async dep) | ✅ in gather                   |
| `life.discovery_health(ctx)`                                          | ctx only         | **independent**                               | ✅ in gather                   |
| `os.prioritize(ctx, top=6)`                                           | ctx only         | **independent**                               | ✅ in gather                   |
| `readiness.assess(ctx)`                                               | ctx only         | **independent**                               | ✅ in gather                   |
| `_recent_intelligence(ctx)`                                           | ctx only         | **independent**                               | ✅ in gather                   |
| `CanonicalGoalsService.canonical_goals(ctx)`                          | ctx only         | **independent**                               | ✅ in gather                   |
| `_timeline_passthrough(ctx, snap)`                                    | ctx **+ snap**   | **depends on snapshot**                       | ❌ stays serial (after gather) |
| vision / what_matters / next_action / constraints / coverage assembly | sync, on results | depends on snap/health/pri/readiness          | sync — runs after gather       |

## Key insight

The six async reads each take **only `ctx`** — none consumes another's result as input. The _assembly logic_ depends on the results, but that's synchronous (runs after all six resolve). The single genuine async dependency is `_timeline_passthrough`, which needs `snap`, so it correctly remains serial.

## Error-behavior preservation (must-match)

| Call                | Original                              | Preserved                                   |
| ------------------- | ------------------------------------- | ------------------------------------------- |
| snapshot            | un-wrapped (failure → endpoint fails) | ✅ un-wrapped in gather                     |
| recent_intelligence | un-wrapped                            | ✅ un-wrapped in gather                     |
| discovery_health    | try → `{}`                            | ✅ `_opt(..., {})`                          |
| prioritize          | try → `ranked=[]`                     | ✅ `_opt(..., {})` → `(pri or {}).get(...)` |
| assess              | try → fallback readiness              | ✅ `_opt(..., None)` → `if r_assess`        |
| canonical_goals     | try → `[]`                            | ✅ `_opt(..., [])`                          |

No dependent branch was parallelized blindly; no error semantics changed.
</content>
