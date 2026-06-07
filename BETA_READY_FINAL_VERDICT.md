# BETA READY — FINAL VERDICT

**Date:** 2026-06-07
**Branch:** `main` @ `74b76f5`

---

## Verdict

```
READY_WITH_P0_FIXES
```

The finance/persona/chat beta path works end-to-end and is close, but **the 12-step live smoke is not a clean sweep** — Step 6 (risk → graph) fails, and Steps 1/10 (sidebar hiding) are verified only at the deployed-code level, not in a browser. Per the sprint rule ("do not declare `WORKING_APP_READY_FOR_20_USER_BETA` unless all 12 smoke steps pass live"), the verdict remains `READY_WITH_P0_FIXES`.

This is **one small worker change + one browser check** away from `WORKING_APP_READY_FOR_20_USER_BETA`.

---

## Smoke scorecard

| #   | Step                              | Result                                 |
| --- | --------------------------------- | -------------------------------------- |
| 1   | Sign in + sidebar hides 5 domains | 🟡 deploy-level (not browser-verified) |
| 2   | Dashboard recommendations         | ✅                                     |
| 3   | Finance Plaid data                | ✅                                     |
| 4   | Sync queue healthy (1028/0/0)     | ✅                                     |
| 5   | Goal → `:Goal` node               | ✅                                     |
| 6   | Risk → `:RiskAssessment` node     | ❌                                     |
| 7   | Chat net worth from real data     | ✅                                     |
| 8   | Chat spending categories          | ✅                                     |
| 9   | Chat persists across refresh      | ✅                                     |
| 10  | Hidden domains absent             | 🟡 deploy-level                        |
| 11  | No 5xx                            | ✅                                     |
| 12  | Qdrant ≥1000 & Neo4j TS ≥700      | ✅                                     |

**9 pass · 1 fail · 2 deploy-level.**

---

## Remaining P0 (blocks WORKING_APP_READY)

### P0-1 · Worker missing `RiskAssessment` entity type

- **Symptom:** Smoke Step 6 fails. `entity_type='risk_assessment'` (enqueued by migration 112's trigger) has no variant in `apps/ingestion-worker/src/entities.rs` `EntityType`, so the worker would deserialize it to `Unknown` and write a `:Unknown` node instead of `:RiskAssessment`.
- **Fix:** add `RiskAssessment` to the `EntityType` enum (with `as_str() => "risk_assessment"` and the `:RiskAssessment` Neo4j label), rebuild + `fly deploy` the worker. Mirrors the existing `Goal` variant.
- **Effort:** ~30 min (one enum variant + label mapping + redeploy).
- **Currently safe:** zero risk rows exist, so no `:Unknown` pollution today; but any risk write before this fix re-introduces `:Unknown`.

## P1 / verification items

- **Sidebar browser pass (Steps 1/10):** `Sidebar.tsx` hides Career/Education/Healthcare/Calendar/Roadmap and is deployed; confirm visually in the browser to mark green.
- **`chat.conversations.message_count`** reads 2 after a 2-turn chat (should be 4); messages persist correctly — counter-only. Fix the increment on the UPDATE path in `lib/chat/persistence.ts`.

## P2 / follow-ups (not beta-blocking)

- **20 "review" views** (RLS, no `user_id` — tenant/global config) were intentionally not security-hardened; classify and apply the correct model.
- **Migration drift:** local `105–110` are unapplied to prod (`public.persona_event` absent); 111–116 depend on none of them — decide to apply or formally retire.
- **`ln_central` seeding:** CENTRAL_CONTEXT is empty (stripped); seed a starter corpus to re-enable.

---

## What IS ready (and verified live)

- Data pipeline healthy: **1028 completed / 0 failed**, Qdrant **1233**, Neo4j `:TransactionSummary` **867**, `:Unknown` **0**.
- Finance domain renders real Plaid-style data; persona recommendations appear.
- **Advisor chat works for the first time** — answers net worth + spending from the user's actual GraphRAG data (the chat auth-header P0 is fixed).
- Chat history persists and is **owner-isolated** (RLS verified).
- **Cross-user data leak closed** across 43 user-scoped views, with writes preserved (migration 116).
- Goals reach the graph (`:Goal`) via the trigger → worker path.
- Gemini keys are server-side only (Fly/Edge), never on Vercel (`ARCHITECTURE_BOUNDARIES.md`).

**To flip to `WORKING_APP_READY_FOR_20_USER_BETA`:** ship P0-1 (RiskAssessment enum) + do the sidebar browser pass, then re-run the smoke (`resume_sprint.sh` + the path-a chat checks).

---

## Recommended next domain sequence (DO NOT START YET)

Only after the finance path is stamped `WORKING_APP_READY_FOR_20_USER_BETA`:

1. **Health & Wellness**
2. **Career**
3. **Education**
4. **Family**

Each new domain should reuse the now-proven pipeline (trigger → `sync_queue` → worker → Qdrant + Neo4j) and the `security_invoker` + owner-policy view pattern from migration 116. Add the corresponding `EntityType` variants to the worker before enabling each domain's graph writes (the RiskAssessment gap is the cautionary precedent).
