# ECONOMIC_GUARDRAIL_VERIFICATION_REPORT.md — Part 5

**Date:** 2026-06-04
**Method:** Live boundary test against production with the `economic_user_budgets` row driven to specific
consumption levels (service-role `PATCH`), one fixture user (`credit_rebuilding`), cap set to the new $4.

---

## Boundary behavior at the $4/day cap

| Scenario             | consumed / cap    | Expected                          | Observed                                                                             | ✓   |
| -------------------- | ----------------- | --------------------------------- | ------------------------------------------------------------------------------------ | --- |
| **Normal**           | $0.00 / $4 (0%)   | ALLOW                             | `200` + real `sources` returned                                                      | ✅  |
| **Heavy / near cap** | $3.60 / $4 (90%)  | ALLOW (degrade signal, not block) | `200`                                                                                | ✅  |
| **Over cap**         | $4.00 / $4 (100%) | BLOCK                             | `429 {"error":"budget_exceeded","verdict":"BLOCK","reason":"user_budget_exhausted"}` | ✅  |

The cap is **real** — raising it to $4 did not remove enforcement; a user at 100% is hard-blocked at the
pre-model gate (so a blocked turn costs nothing).

## Platform cap & accounting

- **Platform $500/month cap intact:** `{monthly_cap_micros: 500000000, current_monthly_micros: 31253303,
status: NORMAL}` → $31.25 / $500.
- **Cost recording fires:** the platform counter incremented across the run (recording path
  `recordUsage → incrementPlatformBudget` is live). The ~$19 rise during this session traces precisely to
  the ~50 successful **old-code** chat calls (at the buggy $0.39/turn) issued while waiting for the fix to
  deploy — independent confirmation of the before ($0.39) vs after (~$0.00035) per-turn cost.
- **`cost_usd_micros` plausibility:** post-fix turns record ~353 micros (the modeled flash estimate, used
  as `actual` because the chat producer returns no measured `actual_micros` — see Part 3 under-count note).

## Notes / caveats

- The over-cap response is a **structured** `budget_exceeded` JSON (correct for the client to render). The
  end-user "friendly" wording is the **frontend's** responsibility — verify the chat UI maps
  `budget_exceeded` to a friendly "you've reached today's limit" message (not a raw error).
- `economic.usage_events` rows are written but the `economic` schema is not PostgREST-exposed, so they
  weren't read directly here; the platform-budget increment + prior production verification confirm the
  write path.

## Verdict — Part 5: ✅ PASS

Normal usage succeeds, near-cap succeeds, over-cap blocks, platform cap intact, breakers untouched,
recording plausible. The economic guardrail is sound at the raised $4/day cap.
