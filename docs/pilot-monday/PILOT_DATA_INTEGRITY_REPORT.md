# PILOT DATA INTEGRITY REPORT

**Scope:** Discovery → Persistence → API (`/v1/life/my-life` canonical contract) → Dashboard → Report → Graph, for 5 pilot personas.
**Method:** Code- and test-level verification grounded in `file:line`. Live verification (real Supabase session) is called out explicitly where it cannot be proven from code/tests.
**Date:** 2026-06-18 · **Audience:** Monday 20-person pilot Go/No-Go.

> **Rule applied throughout:** AUDIT ONLY. No code changed, nothing committed.

---

## 0. Verification baseline (what is provably true)

- **Full core-api suite green:** `.venv/bin/python -m pytest -q` → **523 passed, 7 warnings in ~3.2s** (baseline confirmed, matches the stated 523).
- **Discovery intelligence suite green:** `tests/test_discovery_intelligence.py` → **44 passed in 0.04s**. This is the harness that proves narrative + goal logic for the personas.
- **Cross-surface contract documented + tested:** `docs/data-flow/CROSS_SURFACE_VALIDATION.md` (Phase 8, 2026-06-18) asserts every surface reads the ONE canonical source `/v1/life/my-life` (built from `snapshot()` + `canonical_goals`), backed by 523 backend + 13 frontend rendering tests.

### The single canonical read-path (one source, no per-surface recompute)

| Hop           | Code                                                                                  | Note                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| API entry     | `app/routers/life.py:127` `GET /v1/life/my-life` → `MyLifeService.my_life`            | flagship aggregate                                                                                       |
| Aggregate     | `app/services/my_life.py:92` `my_life()`                                              | composes snapshot + canonical goals + readiness + reco OS; **no new intelligence**                       |
| Narrative     | `app/services/life_discovery.py:285` `dominant_narrative()` (via `snapshot()` `:868`) | surfaced at `my_life.py:228-260` as `dominant_narrative` / `narrative_summary` / `narrative_explanation` |
| Goals (dedup) | `app/services/canonical_goals.py:74` `CanonicalGoalsService.canonical_goals()`        | read-path join across 4 stores; merge at `:143`, rank at `:174`                                          |
| Contract spec | `docs/data-flow/CANONICAL_RENDERING_CONTRACT.md`                                      | field-by-field source map for the my-life payload                                                        |

**Surfaces all read this one contract** (confirmed in code):

- **Dashboard:** `apps/web/src/app/dashboard/page.tsx:69,74` and `apps/web/src/app/dashboard/my-life/page.tsx:63` fetch `/api/life/my-life`; ExecutiveSummary prefers `canonical_goals` over `/api/goals`.
- **Report:** `app/services/report_engine.py:145,212` `snapshot()`, `:255-257` `CanonicalGoalsService(...).canonical_goals(ctx)`, `:278` `dominant_narrative`. The report builds goals from the **same** `CanonicalGoalsService`, so no duplicate goals can appear on the report.
- **Graph:** `apps/web/src/app/api/life/graph/route.ts` → core-api `GET /v1/life/graph` (`life.py:40` → `personal_graph`). **Residual:** `CROSS_SURFACE_VALIDATION.md` notes the graph reads a slightly stale readiness field (`api/life-graph/route.ts:60`) — documented one-line fix, not a data-correctness divergence (same underlying model).

### Anti-fabrication / dedup guarantees (code-level)

- **No duplicate goals:** `canonical_goals.py:143` `_merge()` groups by normalized title (`_norm` `:54`), keeps the most authoritative source (`_PRIORITY` `:27`), and merges duplicates into one entry carrying every `source_id` (`:158-170`) with `provenance.is_duplicate_merge`. Confirmed-user goals beat candidate/persona goals; unconfirmed persona goals never override a confirmed version.
- **No fabricated risks/opps:** `my_life.py:100-119` surfaces ONLY grounded risks/opps from the Recommendation OS; archetype template labels (`GENERIC_RISK_OPP_LABELS`) are filtered out (`:116-117`).
- **No invented next-move / north-star:** `my_life.py:129-136` provenance gating (`user_confirmed`/`user_stated`/`advisor_inferred`/`assumption`); `:195-199` honest "insufficient" state when nothing is grounded; `life_brief` (`life_discovery.py:416`) tested to never invent stakes/risk/next-move (`test_life_brief_never_invents_risk_or_next_move`, `test_life_brief_v2_empty_when_no_grounding`).
- **No fabricated timeline:** `my_life.py:299` `_timeline_passthrough` returns free-text horizon + future-tagged goals with `structured:false` — dates are never parsed/invented.

---

## 1. Per-persona verification

Each persona is traced through: **dominant narrative** (proven by `dominant_narrative()` + persona test), **goals** (multi-goal portfolio survives, dedup at read), **constraints/risks/recs** (grounded-only), and **cross-surface consistency** (one canonical source). The narrative theme keys are the contract that the entire downstream payload organizes around.

### Persona 1 — Family Builder

- **Harness:** `test_discovery_intelligence.py` `_PERSONAS["A_family"]` (`:205-208`) — credit card + down payment + wedding + buy a house + start a family + fitness + NVIDIA promotion + Masters in AI.
- **Expected narrative:** `family_foundation`. **Verified:** `test_dominant_narrative_per_persona[A_family]` PASS; end-to-end `test_narrative_validation_end_to_end_clean[A_family]` PASS (snapshot `dominant_narrative.key == family_foundation`, `len(goal_portfolio) >= 2`).
- **Persona-seed resistance:** `test_narrative_validation_with_persona_seed[A_family]` PASS — a `financial_independence`/"retire comfortably" persona seed does NOT override the family life story. `test_validation_example_family_not_financial_independence` (`:166`) proves FI stays an unconfirmed **candidate**, family is primary, and the next question is the tradeoff/"postpone" question (not "timeline for financial independence").
- **Goals (dedup):** multi-goal portfolio (wedding/home/family/debt/promotion/Masters/fitness) coexists; `canonical_goals` clustering keys (`_CLUSTER_KEYWORDS` `:38`) group home/debt/education/wedding/family/fitness/career/retirement so near-duplicates group rather than over-merge.
- **Constraints/risks/recs:** grounded-only path applies; "competing goals → tradeoff" question proven (`test_multipursuit_gets_concrete_tradeoff`).
- **Verdict: CODE/TEST-VERIFIED ✅** (narrative, multi-goal, persona-resistance, tradeoff framing). Cross-surface consistency = code-verified (one source). **Needs-live:** real Supabase row persistence + dashboard/report render with a live session.

### Persona 2 — Founder / Entrepreneur

- **Harness:** `test_dominant_narrative_founder_legacy` (`:275`) — building a company, legacy for family, balancing family/health/law school/career/multiple businesses; FI "mostly for freedom."
- **Expected narrative:** `legacy_entrepreneurship`. **Verified:** PASS. Narrative ordering checks the legacy signal **before** career/family so a founder is not mislabeled (`dominant_narrative` `:316-321`).
- **Drift robustness:** `test_narrative_not_sticky_legacy_absorbs_vc` (`:294`) PASS — adding a VC opportunity keeps `legacy_entrepreneurship` (career/finance treated as means, not ends).
- **Goals/constraints/recs:** multi-business + family + education portfolio handled; `narrative_question` has a dedicated `legacy_entrepreneurship` branch (`life_discovery.py:367`) → a real, person-specific question.
- **Note on coverage parity:** the founder persona is exercised by **standalone** tests, not the parametrized `_PERSONAS` map (which holds the other 4). Coverage is equivalent at the narrative level; it is simply not run through the `test_narrative_validation_*` end-to-end parametrization.
- **Verdict: CODE/TEST-VERIFIED ✅** (narrative + drift). **Needs-live:** end-to-end persist→render not in the parametrized e2e set; confirm with a live founder session.

### Persona 3 — Burnout Executive

- **Harness:** `_PERSONAS["B_burnout"]` (`:210`) — financially fine, constantly working, two children, travel, poor sleep, weight gain, questioning whether to push harder.
- **Expected narrative:** `health_life_balance`. **Verified:** `test_dominant_narrative_per_persona[B_burnout]` + both e2e variants PASS. `emotional_signals` detects `burnout` (`test_emotional_signals_detects_distress_and_burnout`).
- **Question quality (safety/tone):** `test_burnout_gets_balance_question_not_postpone_children` (`:323`) PASS — never asks "would you postpone your children?"; warm balance framing (health/love). This matters for pilot trust.
- **Persona-seed resistance:** `test_narrative_validation_with_persona_seed[B_burnout]` PASS — financial persona seed does not flip the story to `financial_stabilization`.
- **Verdict: CODE/TEST-VERIFIED ✅**. **Needs-live:** dashboard rendering of the balance narrative + grounded constraints with a live session.

### Persona 4 — Career Maximizer

- **Harness:** `_PERSONAS["C_career"]` (`:213`) — 28, in AI, director before 40, willing to grind a decade, considering MBA/startup/top lab, no children, comfortable prioritizing career.
- **Expected narrative:** `career_acceleration`. **Verified:** `test_dominant_narrative_per_persona[C_career]` + e2e PASS. `emotional_signals` detects `family_deprioritized` (`:233`), which correctly removes family from the present-domain set (`dominant_narrative` `:300-301`) so the story is career, not family.
- **Drift:** `test_narrative_drift_evolves_on_major_life_event` (`:284`) PASS — adding "getting married next year" evolves the narrative away from `career_acceleration` (major life event is not ignored).
- **Verdict: CODE/TEST-VERIFIED ✅**. **Needs-live:** render + persistence with a live session.

### Persona 5 — Financial Recovery

- **Harness:** `_PERSONAS["D_stress"]` (`:216`) — ~$18k credit card debt, barely making payments, fears losing apartment, no savings, relationship strained, overwhelmed.
- **Expected narrative:** `financial_stabilization`. **Verified:** `test_dominant_narrative_per_persona[D_stress]` + e2e PASS. Requires BOTH `money_stress` AND `distress` (`dominant_narrative` `:309`) so a mere "pay off card" goal is not miscoded as crisis.
- **Question quality (crisis warmth):** `test_crisis_gets_warm_stabilization_question_not_tradeoff` (`:315`) PASS — uses breathe/relieve/pressure language, references the user's actual debt, and never asks the cold "postpone" tradeoff. Critical for pilot trust with a distressed user.
- **Anti-fabrication under crisis:** `test_life_brief_never_invents_risk_or_next_move` (`:379`) PASS — with no grounded inputs the brief states `stakes=None`, `next_move=None`, but acknowledges crisis tension ("breathe").
- **Verdict: CODE/TEST-VERIFIED ✅**. **Needs-live:** confirm the warm crisis path renders end-to-end with a live distressed-persona session.

---

## 2. Consistency / dedup / staleness findings

| Property                                               | Result           | Evidence                                                                                                                                                   |
| ------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same narrative across reveal/dashboard/brief/report    | ✅ code-verified | all read `dominant_narrative`/`narrative_summary`/`narrative_explanation` from `my_life.py:228-260`; report `report_engine.py:278`                         |
| Same goals across reveal/dashboard/canonical/report    | ✅ code-verified | all read `canonical_goals`; report builds via `CanonicalGoalsService` (`report_engine.py:255-257`)                                                         |
| No duplicate goals                                     | ✅ code-verified | `_merge` normalizes + dedups (`canonical_goals.py:143-172`); `CROSS_SURFACE_VALIDATION.md` "no duplicate goals"                                            |
| Confirmation state (confirmed vs candidate) consistent | ✅ code-verified | `confirmation_status` carried + rendered as badge (cross-surface doc)                                                                                      |
| No stale values                                        | ⚠️ mostly        | one documented stale read: graph readiness field `api/life-graph/route.ts:60` — same model, not a contradiction; one-line fix tracked, graph deprioritized |
| No fabricated data                                     | ✅ code-verified | grounded-only risks/opps (`my_life.py:100-119`), honest empty states, defensive omission tests                                                             |

---

## 3. Honest limits of this audit

- **Code/test-level, not live.** All five personas are proven by the discovery-intelligence harness (narrative + goal portfolio + question quality + persona-seed resistance) and by the cross-surface contract being a single source. What is **NOT** proven here is a live round-trip against real Supabase (`life.life_objectives` / `life.candidate_goals` / `public.goals` / `analytics`) with a logged-in user. A live session is required to confirm: (a) discovery answers actually persist, (b) the dashboard/report/graph render the persisted values, (c) no environment-specific RLS/grant gap blocks a read.
- **Founder persona** is covered by standalone narrative tests, not the parametrized end-to-end set — equivalent narrative confidence, lighter e2e coverage.
- **Persistence layer** uses `FakeSupabase` in tests (`tests/conftest.py`); real persistence is asserted by separate persistence tests referenced in `CROSS_SURFACE_VALIDATION.md` but should be spot-checked live.

---

## 4. Verdict

| Persona              | Narrative                  | Multi-goal | Persona-seed resist | Question quality | Verdict                              |
| -------------------- | -------------------------- | ---------- | ------------------- | ---------------- | ------------------------------------ |
| 1 Family Builder     | ✅ family_foundation       | ✅         | ✅                  | ✅ tradeoff      | **CODE/TEST-VERIFIED**               |
| 2 Founder            | ✅ legacy_entrepreneurship | ✅         | n/a                 | ✅ legacy Q      | **CODE/TEST-VERIFIED** (lighter e2e) |
| 3 Burnout Exec       | ✅ health_life_balance     | ✅         | ✅                  | ✅ warm balance  | **CODE/TEST-VERIFIED**               |
| 4 Career Maximizer   | ✅ career_acceleration     | ✅         | ✅                  | ✅ + drift       | **CODE/TEST-VERIFIED**               |
| 5 Financial Recovery | ✅ financial_stabilization | ✅         | ✅                  | ✅ warm crisis   | **CODE/TEST-VERIFIED**               |

**Overall: DATA INTEGRITY GREEN at code/test level — APPROVED pending one live smoke session.**

The narrative engine, the canonical contract, the read-path dedup, and the anti-fabrication gates are all proven (523 + 44 tests green; documented single-source contract). The one outstanding requirement before flipping to a full GO is a **live end-to-end smoke per persona** (login → discovery → confirm rows persist → dashboard/report/graph render the same values). The single stale read (graph readiness, `api/life-graph/route.ts:60`) is cosmetic and does not create a cross-surface contradiction.
