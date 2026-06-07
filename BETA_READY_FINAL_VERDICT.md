# BETA READY — FINAL VERDICT

**Date:** 2026-06-07 (updated after RiskAssessment P0 fix)
**Branch:** `main` @ `64e7de7`+

---

## Verdict

```
READY_WITH_P0_FIXES   (one sidebar decision away from WORKING_APP_READY_FOR_20_USER_BETA)
```

The original blocking P0 — **Step 6 (risk → graph)** — is **fixed and verified live**. The verdict does not yet flip to `WORKING_APP_READY_FOR_20_USER_BETA` because **browser-verification of the sidebar (Steps 1/10) surfaced a discrepancy**: the "hidden" domains render as **disabled "Coming Soon" entries — visible in the nav, not absent** — which does not satisfy the smoke's literal pass condition ("does NOT show"). This is a product/interpretation decision (see below), not a functional defect: those domains are non-navigable.

---

## P0 fix shipped this round — RiskAssessment (Step 6)

**Was:** `entity_type='risk_assessment'` (enqueued by migration 112's trigger) had no variant in the worker `EntityType` enum → deserialized to `Unknown` → would write `:Unknown` nodes.

**Fix (commit `64e7de7`, worker redeployed):**

- `EntityType::RiskAssessment` added (serde snake_case → deserializes `risk_assessment`); `as_str()` → `"risk_assessment"`.
- Neo4j label via `pascalize("risk_assessment")` = `:RiskAssessment`.
- Normalizer `build_title` + `build_summary` cases (assessment_type, status, overall_risk_score, risk_tolerance) → non-empty summary → Qdrant point written with `entity_type` preserved.
- Unit tests: `entity_type_tests::risk_assessment_round_trips` (mirrors `goal_round_trips`) + `pascalize("risk_assessment")==RiskAssessment`. `cargo test --lib`: 22 passed.

**Live verification:**

```
insert risk_assessment → trigger enqueues entity_type='risk_assessment' → worker completes (~20s)
Neo4j:  :RiskAssessment = 1  (node.entity_type = 'risk_assessment')  ·  :Unknown = 0
Qdrant: 1233 → 1234 (point written, entity_type preserved)
```

**Step 6: PASS.**

---

## Smoke scorecard (re-run live)

| #   | Step                              | Result                                                                      |
| --- | --------------------------------- | --------------------------------------------------------------------------- |
| 1   | Sign in + sidebar hides 5 domains | ⚠️ browser-verified: domains shown **disabled** ("Coming Soon"), not absent |
| 2   | Dashboard recommendations         | ✅                                                                          |
| 3   | Finance Plaid data                | ✅                                                                          |
| 4   | Sync queue healthy (1028/0/0)     | ✅                                                                          |
| 5   | Goal → `:Goal` node               | ✅                                                                          |
| 6   | Risk → `:RiskAssessment` node     | ✅ (fixed)                                                                  |
| 7   | Chat net worth from real data     | ✅                                                                          |
| 8   | Chat spending categories          | ✅                                                                          |
| 9   | Chat persists across refresh      | ✅                                                                          |
| 10  | Hidden domains absent             | ⚠️ same as Step 1                                                           |
| 11  | No 5xx                            | ✅ (chat/finance/recs all 200; RLS non-owner=0)                             |
| 12  | Qdrant ≥1000 & Neo4j TS ≥700      | ✅ (1234; 867; `:Unknown`=0)                                                |

**10 clean PASS · 0 FAIL · 2 (Steps 1/10) pending the sidebar decision.**

No new 5xx and no RLS regression were introduced by the worker change.

---

## The one open decision — sidebar (Steps 1/10)

`Sidebar.tsx` marks Career/Education/Healthcare/Calendar/Roadmap `comingSoon: true`, but the render shows them **disabled/dimmed** (`opacity-50 cursor-not-allowed`, no `href`, "Coming Soon" affordance) rather than removing them. They are **not navigable** (cannot be entered), but they **are visible**.

- If "disabled / non-navigable" satisfies _"do not expose hidden sidebar items"_ → Steps 1/10 **pass** → verdict flips to `WORKING_APP_READY_FOR_20_USER_BETA`.
- If the smoke's literal _"does NOT show"_ is required → a one-line filter (`navigation.filter(i => !i.comingSoon)`) removes them entirely. (Out of scope for the "fix the final P0 only" instruction; awaiting approval.)

---

## P1 / follow-ups (not beta-blocking)

- `chat.conversations.message_count` reads 2 after a 2-turn chat (should be 4); messages persist correctly — counter only.
- 20 "review" views (RLS, no `user_id`) not security-hardened — classify + apply correct model.
- Migration drift: local `105–110` unapplied to prod (111–116 depend on none).
- `ln_central` empty (CENTRAL_CONTEXT stripped) — seed a starter corpus to re-enable.

---

## What IS ready (verified live)

Pipeline **1028/0/0**, Qdrant **1234**, Neo4j `:TransactionSummary` **867** / `:Unknown` **0**; finance renders real Plaid data; persona recommendations; **advisor chat answers net worth + spending from real GraphRAG data and persists** (owner-isolated RLS); **goal AND risk both reach the graph** (`:Goal`, `:RiskAssessment`); cross-user read leak closed (migration 116) with writes preserved; Gemini server-side only.

---

## Recommended next domain sequence (DO NOT START YET)

Only after the verdict is `WORKING_APP_READY_FOR_20_USER_BETA`:

1. **Health & Wellness** → 2. **Career** → 3. **Education** → 4. **Family**

Each new domain must add its `EntityType` variant(s) to the worker before enabling graph writes (the RiskAssessment gap is the cautionary precedent), and reuse the migration-116 `security_invoker` + owner-policy view pattern.
