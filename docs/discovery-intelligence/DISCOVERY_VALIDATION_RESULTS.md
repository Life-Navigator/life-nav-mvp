# Discovery Validation Results (Phase 8) + Final Status

**Date:** 2026-06-16 · Branch `platform/discovery-intelligence`. Code + tests complete; **deploy gated** on approval.

## The validation scenario

A user juggling: pay off debt, save for a wedding, buy a home, start a family, get promoted at NVIDIA, pursue a master's, get in shape — with a **persona-seeded `financial_independence`**.

**Expected:** dominant theme = building a family/life over ~1–2 years; next question = a tradeoff/postpone question. **Not:** "financial independence" / "what timeline for financial independence."

**Result (test `test_validation_example_family_not_financial_independence`, PASS):**

- `snapshot().primary_objective` = **"Build family stability"** (a confirmed, user goal) — **not** "Reach financial independence."
- The persona `financial_independence` appears in `candidate_objectives` with `confirmed: false` (a _possible_ goal), never as the focus.
- `state().next_question` = the `priority` step re-framed to: _"You've got several big goals in motion — … If one needed to move more slowly so the others could succeed, which would be easiest for you to postpone?"_ — contains "postpone", and does **not** contain "financial independence".

## Test ledger (`tests/test_discovery_intelligence.py` — 17 passed)

Ranking: user-priority-outranks-persona · explicit-priority-wins-at-lower-confidence · terminal-life-goal-outranks-finance (family/home/health) · instrumental-leads-when-prioritized (career/education) · wedding-urgency-lifts-family · unconfirmed-penalized. Candidate protection: persona-FI-not-primary-without-confirmation · confirmed-family-over-persona-FI · bridge-seeds-as-candidates · user-goal-confirmed-can-lead. Write path: priority-confirms-and-promotes · narrative-survives. Selection: tradeoff-question-when-goals-compete. Validation: the scenario above.

**Full core-api suite: 465 passed** (449 prior + 16 new; no regression). Migration + 2 services + RM changed; all green.

## Final questions

1. **Do user priorities now outrank persona goals?** **Yes** — `user_priority` is the heaviest weight (3.0) and the priority step confirms+promotes the chosen objective; persona seeds are unconfirmed and penalized (`test_user_priority_outranks_persona_goal`).
2. **Can candidate goals become primary objectives?** **Only after user confirmation** — by design. Unconfirmed persona candidates cannot be primary (`test_persona_fi_cannot_be_primary_without_confirmation`); stating/prioritizing a goal confirms and promotes it.
3. **Does Arcana understand narratives before objectives?** **Partially, materially improved** — the user's verbatim narrative + a multi-domain summary are captured and stored separately from objectives (`test_narrative_survives_ontology_conversion`). The narrative is deterministic, not LLM-fluent (honest scope).
4. **Does discovery follow the user's life story?** **Yes** — ranking is driven by user priority, urgency, and life-significance (not seeded confidence); question selection surfaces the user's own competing goals.
5. **Does ontology completion still dominate question selection?** **No** — when goals compete, the tradeoff/priority question leads; ontology expansion is last in the policy order.
6. **What changed in ranking behavior?** Confidence went from **the** signal to the **least-weighted** of six; persona-seeded objectives are candidate-gated out of primary; user priority + urgency + life-significance now decide the focus.
7. **Is onboarding materially more human?** **Yes** — it leads with the user's stated, time-salient goals and a real tradeoff question instead of a persona-seeded "financial independence." (Live conversational feel still benefits from the Arcana streaming UX already shipped.)

## Status

### DISCOVERY_INTELLIGENCE_FIXED (code + tests) — deploy gated

All seven phases implemented and validated by 17 passing tests (465 total, no regression). **Not yet deployed.** To go live: apply migration `20260616140000_discovery_intelligence.sql`, then deploy core-api from this branch (or after merge to `main`) — same gated path as the cutover. Recommend a live synthetic-user trace of the exact scenario post-deploy.

## Changed files

`supabase/migrations/20260616140000_discovery_intelligence.sql`; `apps/lifenavigator-core-api/app/services/life_discovery.py`, `life_bridge.py`, `relationship_manager.py`; `apps/lifenavigator-core-api/tests/test_discovery_intelligence.py`. Docs in `docs/discovery-intelligence/`.
