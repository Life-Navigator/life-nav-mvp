# BETA20_ONBOARDING_SIMULATION.md — Part 8

**Date:** 2026-06-04
**Method:** 20 fresh users (each persona ×2) run **concurrently** (pool of 5) through the entire journey
against production via `apps/web/beta20-sim.mjs`. Real auth, activation, recommendations, grounded chat.

---

## VERDICT: ✅ READY_FOR_20_USERS (onboarding/activation dimension)

**20/20 users completed all 8 journey steps under concurrent load**, in **70.7s** wall. Zero chat
fallbacks, zero budget blocks. The full stack — magic-link auth, persona activation, dashboard,
recommendations, grounded chat — holds at 20-user concurrency.

| Step                         | Success   |
| ---------------------------- | --------- |
| invite (link → session)      | **20/20** |
| onboarding redirect          | **20/20** |
| activate persona             | **20/20** |
| dashboard                    | **20/20** |
| recommendations              | **20/20** |
| chat (grounded, real answer) | **20/20** |
| logout gate                  | **20/20** |
| return login                 | **20/20** |
| **Full journey (8/8)**       | **20/20** |

### Stress signals

- **Chat:** 20/20 real answers, **0 fallback**, **0 `429 budget_exceeded`** — the cost-estimator fix +
  $4/day cap hold under 5-way concurrency, and the grounded pipeline answered every user.
- **Latency (p50 / max):** activate **7.3s / 14.8s** · recommendations **0.44s / 0.58s** · chat
  **5.5s / 6.4s**.
- **Activation is the slowest step** (provisions sandbox accounts + persona metadata). Functionally 20/20,
  but it's the main perceived-wait — a progress indicator (Part 7) is the right polish.

### Retention-event coverage

Each journey emits the funnel anchors verified earlier (`user_signed_up`, `persona_activation`,
`first_chat_message`, recommendation reads), so the 20-user run also exercises the analytics events the
retention/observability work depends on.

---

## What this does and doesn't prove

- **Proves:** 20 concurrent users can register (invite), activate, and use dashboard + recs + grounded chat
  with 100% success and no budget/grounding failures — on the real production stack.
- **Doesn't cover:** real **email delivery** at 20-user scale (pending Resend SMTP — see
  `EMAIL_DELIVERY_TEST_REPORT.md`); the beta uses admin-minted invite links, which have no such limit.

## Bottom line

The onboarding + activation + chat path is **ready for 20 users**. The only gating item for _emailed_
invites is SMTP; admin-link distribution makes the cohort launchable today.
