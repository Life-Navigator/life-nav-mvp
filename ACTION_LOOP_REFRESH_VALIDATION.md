# ACTION_LOOP_REFRESH_VALIDATION.md — Phase 2

## Validation method (honest scope)

This session validated the action loop at the **code + unit-test level**. A fresh live Playwright run was **not executed here** (requires the running web app + an authenticated session + the Fly `/v1/life/advisor/action/apply` endpoint reachable). A prior session captured a live home-purchase screenshot (see IMPACT_SUMMARY_CARD.md). Below is what is verified, and exactly how, so claims stay grounded.

## Backend write path (verified, unit-tested)

- `apps/lifenavigator-core-api/app/services/advisor_actions.py:188-222` — `apply()` builds facts from non-empty fields and writes each via `ingestion.submit_life_fact` (line 214). **Only** write path.
- `apps/lifenavigator-core-api/app/routers/life.py:181-191` — `POST /v1/life/advisor/action/apply` is the single entry; calls `advisor_actions.apply(IngestionService(...), ...)`.
- `apps/lifenavigator-core-api/tests/test_advisor_actions.py:16-59` — `FakeIngestion` asserts `submit_life_fact` is the **only** call; promotion captures exactly `promotion.title`, `promotion.base_salary`, `promotion.annual_bonus`. **No domain table is written.**

## Per-action expectations (code-grounded)

### Promotion

- Facts: `promotion.title`, `promotion.base_salary`, `promotion.annual_bonus`, `promotion.equity_grant`.
- Card: facts as chips, salary/bonus currency-formatted; affected areas chips; **no readiness delta rendered** (honest — career readiness reads `career_profiles`/`compensation_records`, not `life.facts`).

### Home Purchase

- Facts: `home.purchase_price`, `home.down_payment`, `home.mortgage_balance` — all currency-formatted in the card.
- Card: impact chips (Net worth · Liabilities · Cash reserves · Retirement assumptions). **No recommendation delta rendered** (honest — recommendation engine reads `financial_accounts`/`transactions`/documents, not `life.facts`).

### Health Goal

- Facts: `health.goal`, `health.goal_target_date` (target shown only if provided).
- Card: health impact area chip. **No readiness delta rendered** (honest — health readiness reads `sleep_logs`/`activity_logs`/`vitals`, not goals; see DOMAIN_WRITE_GAP_AUDIT.md).

## Honesty assertions (all hold)

- ✅ Impact card shows only real, written facts.
- ✅ Currency formatting on monetary fields.
- ✅ Impact **areas** shown (qualitative, true) — not a fabricated numeric jump.
- ✅ No fake readiness delta on any action.
- ✅ No fake recommendation delta on any action.

## To run the live Playwright pass (next step, not done here)

Needs: web app running, an authenticated test user, and the Fly action endpoint live. Then drive: open advisor chat → send the trigger phrase per action → approve the card → assert the chips/facts above and assert **absence** of any "Readiness X → Y" / "New recommendation" text. I can execute this if you start the app + provide a test session.
