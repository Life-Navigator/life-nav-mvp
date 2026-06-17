# Discovery Intelligence — Failure Analysis (Validation Sprint)

**Date:** 2026-06-16 · **Verdict: BLOCKED — do not deploy.** Human-scenario validation of the four personas through the **real discovery pipeline** (not unit tests) shows Arcana still does not identify the correct dominant theme. The remediation fixed ranking/candidate-protection/priority-capture/tradeoff-questions — but the theme is decided **upstream**, at objective creation, which was not fixed.

## What was run

Each persona's narrative was driven through `RelationshipManager.converse()` + `LifeDiscoveryService` (the actual code on `platform/discovery-intelligence`), and the resulting objectives / primary theme / next question were inspected. Two configurations: with a financial persona seed (contamination test) and clean (pure narrative).

## Results (clean user-narrative path — the true behavior)

| Persona              | Expected dominant theme               | **Actual primary theme**          | Next question            | Verdict                   |
| -------------------- | ------------------------------------- | --------------------------------- | ------------------------ | ------------------------- |
| A — young family     | Building a family/life (next 1–2 yrs) | **"Advance your career"**         | tradeoff/postpone (good) | ❌ wrong theme            |
| B — burnout exec     | Health / family / balance             | **"Optimize health & longevity"** | tradeoff/postpone (good) | ⚠️ partial (health only)  |
| C — career maximizer | Career advancement                    | **"Build family stability"**      | tradeoff/postpone (good) | ❌ wrong theme (inverted) |
| D — financial stress | Immediate financial stability         | **None** (no objective created)   | generic priority         | ❌ no theme               |

**Pass criterion = all four identify the correct dominant theme. Result: 0/4 (1 partial). BLOCKED.**

## Root cause (real, not a test artifact)

1. **Single-objective collapse.** A multi-goal narrative produces exactly **one** `discover_goal` call → **one** root objective (`relationship_manager.py` goal branch → `life_discovery.discover_goal`). The user's many goals are extracted as `candidate_goals` (correctly — all domains captured) but are **never promoted to ranked objectives**.
2. **`analyze()` mis-picks the single root** for multi-domain statements: career for a family story (A), family for a career story (C), `None` for a debt story (D). `analyze()` was built to find one "need behind the need," not to weigh a multi-goal life.
3. **Therefore the weighted ranking engine + candidate protection cannot help** — they choose among _existing confirmed objectives_, but there is only ever **one**, and it's already the wrong one. The fix operated one layer too late.

## What the remediation DID fix (verified working)

- **Tradeoff/priority question** fires from the user's own competing goals (A/B/C show "…which would be easiest to postpone?"). ✅
- **Candidate protection**: persona-seeded `financial_independence` never became primary in any persona. ✅ (No "financial independence fixation" — the original audit symptom is gone.)
- **Priority capture** and **narrative storage** work at the unit level. ✅

## Additional risk found (verify before any deploy)

**Bridge re-ingest / supersede.** In the seeded run, the user's stated goal was re-ingested by `LifeBridgeService.sync()` (via `_public_goals` reading the `goals` table) and, through `discover_goal`'s "supersede same surface-goal, different root" rule, an **unconfirmed persona objective superseded the user's confirmed one** → `primary=None`. In the test harness `FakeSupabase` keys tables by name and **ignores schema**, so `public.goals` and `life.goals` collide — this specific path may be a harness artifact. **Action:** confirm in real Supabase that `public.goals` ≠ `life.goals` (so the bridge cannot re-ingest user goals) AND fix the supersede rule so an **unconfirmed** objective can never supersede a **confirmed** one. Until verified, treat as a live risk.

## Scoring (1–10, averaged across personas, honest)

Narrative understanding 6 (goals extracted well) · Priority recognition 7 (tradeoff Q) · Emotional awareness 3 (no sentiment/urgency-of-stress handling, e.g. D) · **Goal selection 2 (the core failure)** · Follow-up question quality 7 · **Ontology-leakage avoidance 4** (theme still ontology-collapsed) · Persona-contamination avoidance 8 (clean path) · Human-likeness 5 · Discovery quality 4 · **Overall 4.5**.

## Root-cause checks (per the sprint)

1. Persona goals became primary? **No** (candidate protection holds) — improvement.
2. Ontology completion drove selection? **Partially** — theme is still a single ontology root collapse.
3. Confidence dominated ranking? **No** (weighted now) — but moot, only one objective exists.
4. User priorities dominated ranking? **When captured, yes** — but the priority step is reached _after_ the wrong primary is already set.
5. Narrative preserved? **Yes** (verbatim + summary stored).
6. Next question relevant? **Yes** (tradeoff) for A/B/C; generic for D.
7. Would a human advisor ask similarly? **The tradeoff question, yes**; the _theme_ a human infers (family for A, career for C) is wrong here.

## Required before re-validation (not implemented — STOP per sprint)

- **Derive the dominant theme from the full candidate-goal set**, not a single `analyze()` pick: create/rank an objective per distinct stated goal-domain (confirmed=user), then let the weighted engine choose — OR compute the primary theme from the weighted candidate_goals directly.
- **Fix supersede**: unconfirmed never supersedes confirmed; bridge must never ingest user-origin goals (verify schema separation).
- **Emotional/urgency signal** for stabilization-first cases (D).
- Re-run this exact 4-persona validation; require 4/4 correct themes.

## Final status

### BLOCKED

The original "financial independence fixation" is gone and the tradeoff questioning is genuinely better, but 0/4 personas identify the correct dominant theme because the theme is set by a single upstream `analyze()` pick the remediation did not change. **Do not deploy.** Returns to remediation with the scoped fixes above.
