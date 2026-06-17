# Core API Divergence Report — `origin/main` vs `origin/advisor/p0-upgrade-2.3.0`

**Mode:** EVIDENCE-ONLY (read-only git). No checkout, no edits, no fixes.
**Deployed branch (Fly `lifenavigator-core-api`):** `origin/advisor/p0-upgrade-2.3.0` @ `9d25180`
**Stale branch:** `origin/main` (default; PR target)
**Date:** 2026-06-16

---

## 1. Top-line

- **Commits diverged:** the deployed branch is **66 commits AHEAD** of `origin/main`
  (`git log --oneline origin/main..origin/advisor/p0-upgrade-2.3.0 | wc -l` → `66`).
- **Reverse check:** `origin/main` is **0 commits ahead** of the deployed branch —
  both for core-api (`git log --oneline origin/advisor/p0-upgrade-2.3.0..origin/main -- apps/lifenavigator-core-api` → empty)
  **and repo-wide** (`git log --oneline origin/advisor/p0-upgrade-2.3.0..origin/main | wc -l` → `0`).
  The deployed branch is a **strict superset** of main. Main has **no fix that the deployed branch lacks**.
- **Files diverged (core-api only):** **37 files changed, +4721 / −96**
  (`git diff --stat origin/main..origin/advisor/p0-upgrade-2.3.0 -- apps/lifenavigator-core-api`).
- **Frontend (apps/web) divergence:** **112 files changed, +11272 / −1592**
  (`git diff --stat origin/main..origin/advisor/p0-upgrade-2.3.0 -- apps/web`).
- **Headline:** `origin/main` is **behind the deployed code** and \*\*lacks the entire hybrid-advisor stack
  - model-orchestration + pilot tier\*\*. The advisor/discovery brain that runs in production exists
    ONLY on the deployed branch. The version string is identical (`__version__ = "0.1.0"` on both —
    `app/__init__.py`), so version number is NOT a reliable divergence signal; the code is.

---

## 2. Files PRESENT on deployed, ABSENT on main (the advisor stack)

Each confirmed by `git show origin/main:<path>` (fails → ABSENT) vs
`git show origin/advisor/p0-upgrade-2.3.0:<path>` (succeeds → PRESENT). All listed files: **main=ABSENT, deployed=PRESENT.**

| File                                   | main   | deployed | Diffstat |
| -------------------------------------- | ------ | -------- | -------- |
| `app/services/advisor_orchestrator.py` | ABSENT | PRESENT  | +436     |
| `app/services/advisor_llm.py`          | ABSENT | PRESENT  | +306     |
| `app/services/advisor_context.py`      | ABSENT | PRESENT  | +373     |
| `app/services/advisor_math.py`         | ABSENT | PRESENT  | +144     |
| `app/services/advisor_validator.py`    | ABSENT | PRESENT  | +229     |
| `app/services/model_registry.py`       | ABSENT | PRESENT  | +138     |
| `app/services/model_router.py`         | ABSENT | PRESENT  | +237     |
| `app/services/pilot_service.py`        | ABSENT | PRESENT  | +88      |
| `app/services/life_graph_workspace.py` | ABSENT | PRESENT  | +265     |
| `app/services/pdf_renderer.py`         | ABSENT | PRESENT  | +188     |

Supporting tests, also main=ABSENT:
`tests/test_advisor_hybrid.py` (+627), `tests/test_advisor_graphrag.py` (+293),
`tests/test_model_router.py` (+174), `tests/test_pilot_service.py` (+72),
`tests/test_life_graph_workspace.py` (+204), `tests/test_onboarding_model.py` (+117),
`tests/validate_transcript.py` (+70).

**Migrations / pilot tables present ONLY on deployed** (confirmed via `git show origin/main:<path>` → ABSENT):

- `supabase/migrations/160_advisor_turns.sql` (+82) — advisor turn-log table (cross-turn context store). main=ABSENT, deployed=PRESENT.
- `supabase/migrations/20260616120000_pilot_routing.sql` (+101) — pilot tier / usage ledger / routing. main=ABSENT, deployed=PRESENT.
- `supabase/migrations/20260611020000_life_candidate_goals.sql` (+27) — candidate-goals table (RelationshipManager `_persist_candidate_goals` writes here).
- `supabase/migrations/20260611030000_fix_course_sync_topic.sql` (+37)
- `supabase/migrations/20260613000000_family_members_pets_guardianship.sql` (+76)
- `supabase/migrations/20260613010000_cleanup_archetype_risks.sql` (+19)

> Implication: even if main's code were promoted, the advisor stack would 500 without `160_advisor_turns`
> and `20260616120000_pilot_routing` applied first.

---

## 3. Files MODIFIED on BOTH (divergent)

### 3a. `app/routers/life.py` — the discovery wiring (CRITICAL)

The `/discovery/chat` route binds to a **different service** on each branch.

**MAIN** (`git show origin/main:apps/lifenavigator-core-api/app/routers/life.py`):

- L7 `from ..dependencies import ... get_relationship_manager` (no `get_advisor_orchestrator`).
- L82–86:
  ```py
  async def discovery_chat(..., svc: RelationshipManager = Depends(get_relationship_manager), ...):
      """Chat-native Relationship Manager: one advisor turn ... The advisor IS the onboarding."""
      return await svc.converse(_ctx(user), message, pending_key or None)
  ```
  → onboarding chat = **pure rule-based `RelationshipManager.converse`**. No streaming route exists.

**DEPLOYED** (`git show origin/advisor/p0-upgrade-2.3.0:apps/lifenavigator-core-api/app/routers/life.py`):

- L10 `from ..dependencies import ... get_advisor_orchestrator, ...`
- L85–98:
  ```py
  async def discovery_chat(..., svc=Depends(get_advisor_orchestrator), ...
                           conversation_id: str = Body(...), trace: bool = Body(...)):
      """Chat-native hybrid advisor: one turn. The deterministic engine handles persistence + safety
      ... the LLM leads ... gated by the output validator. The advisor IS the onboarding."""
      ...
      return await svc.converse(_ctx(user), message, pending_key or None,
                                conversation_id=conversation_id or None, trace=trace_ok)
  ```
- L101–118: an **additional SSE route** `@router.post("/discovery/chat/stream")` →
  `svc.converse_stream(...)` (does not exist on main at all).

**Behavioral difference:** main's onboarding chat is wired to the **rule-based RelationshipManager**;
the deployed (production) onboarding chat is wired to the **hybrid AdvisorOrchestrator** (rules guardrail +
LLM lead + validator gate), plus extra params (`conversation_id`, `trace`) and a streaming endpoint.

### 3b. `app/dependencies.py` — `get_advisor_orchestrator` (+67/−? net per stat)

`git diff origin/main..origin/advisor/p0-upgrade-2.3.0 -- .../app/dependencies.py`:

- Main has **no** `get_advisor_orchestrator` (the function is added entirely on deployed, diff L265–`+`).
- Deployed `get_advisor_orchestrator` (added block):
  - L+ builds `AdvisorContextBuilder(supabase, coverage, life)`, selects LLM via
    `ADVISOR_LLM_ENABLED` (default `"true"`) and `USE_VERTEX_CLAUDE` (default `"false"`),
    `GeminiAdvisorLLM(gemini)` vs `VertexClaudeAdvisorLLM(...)`.
  - L+ constructs a `ModelRouter(_llm_factory)` over `model_registry.MODELS` (selective routing,
    gated `MODEL_ROUTER_ENABLED`, default OFF), returns
    `AdvisorOrchestrator(rm, builder, llm, enabled=enabled, supabase=supabase, router=router)`.
  - The provider must call `from .services.model_router import ModelRouter` / `model_registry` /
    `advisor_*` — all of which are **absent on main**, so this factory cannot be back-ported piecemeal.
- Unrelated divergence in same file: `get_report_engine` now passes a `readiness=` arg
  (deployed L+167) that main lacks (main L-167 returns `UniversalReportEngine(... reco_os=...)` with no readiness).

### 3c. `app/services/relationship_manager.py` (+85/−? per stat)

`git diff ... -- .../relationship_manager.py` hunks:

- `@@ -93,6 +94,60 @@` adds methods on `RelationshipManager`:
  `_future_status(goal)` (L+ static), `_persist_candidate_goals(self, ctx, goals)` (L+),
  `_load_candidate_goals(self, ctx)` (L+) — i.e. deployed RM gained candidate-goals persistence
  (writes to `life_candidate_goals`, migration only on deployed).
- Further hunks `@@ -217,7 +272 @@`, `@@ -268,7 +328 @@`, `@@ -280,17 +349 @@` modify `converse`/turn logic.
- Note: deployed RM is **still present and used** — the AdvisorOrchestrator wraps `rm` (deterministic
  persistence + fallback), so RM is not deleted, it is composed under the orchestrator.

### 3d. Domains & app wiring

- `app/main.py`: deployed imports + registers `life_graph` router (`app.include_router(life_graph.router)`,
  diff L+68); main does not import `life_graph` at all (main L-19 import list lacks it).
  Backed by new `app/routers/life_graph.py` (+69) and `app/services/life_graph_workspace.py` (+265, absent on main).
- `app/domains/career.py` (+16, hunks @84/@135/@298), `education.py` (+4, @93), `family.py` (+3, @90):
  small read/column-mapping fixes on deployed (consistent with main-era "career_profiles read from wrong
  schema" P0 commit `e3dbb63`, which lives on the deployed branch).
- `app/clients/gemini.py` (+30/−), `app/clients/supabase.py` (+18), `app/services/my_life.py` (+111/−),
  `app/services/report_engine.py` (+95/−5), `app/routers/analytics.py` (+46/−), `app/services/analytics.py` (+14),
  `app/services/discovery_coverage.py` (+18/−), `app/services/life_discovery.py` (+129/−),
  `app/services/recommendations_os.py` (+2): all forward-only changes on deployed.

---

## 4. Classification table (A–E)

A = main newer / deployed obsolete · B = deployed newer, migrate into main · C = both needed temporarily ·
D = harmful / delete · E = unknown.

| Area                                                                                                  | Class                          | Evidence (file:line / SHA)                                                                 | One-line reason                                                                        |
| ----------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Hybrid advisor stack (`advisor_orchestrator/llm/context/math/validator.py`)                           | **B**                          | files main=ABSENT, deployed=PRESENT; deps `dependencies.py:get_advisor_orchestrator` L+265 | Production brain; only on deployed; must migrate to main.                              |
| Discovery/chat wiring (`routers/life.py` `/discovery/chat`)                                           | **B** (safety-critical, §5)    | main L82–86 `RelationshipManager.converse` vs deployed L85–98 `get_advisor_orchestrator`   | Prod uses orchestrator; main reverts onboarding to rules — regression if main shipped. |
| SSE streaming chat (`routers/life.py` `/discovery/chat/stream`)                                       | **B**                          | deployed L101–118; route absent on main                                                    | Added capability; deployed-only.                                                       |
| Model orchestration (`model_registry.py`, `model_router.py`)                                          | **B** (default-OFF)            | files main=ABSENT; wired `dependencies.py` `_llm_factory`/`ModelRouter` L+                 | Default-off-safe routing layer; migrate; activation gated.                             |
| Advisor validator (`advisor_validator.py`)                                                            | **B**                          | main=ABSENT, deployed=PRESENT (+229); gates orchestrator output                            | Trust gate inseparable from orchestrator; migrate together.                            |
| Pilot tier (`pilot_service.py` + `20260616120000_pilot_routing.sql`)                                  | **B**                          | files/migration main=ABSENT, deployed=PRESENT                                              | Pilot readiness; deployed-only; migrate.                                               |
| Advisor-turns store (`160_advisor_turns.sql`)                                                         | **B** (prereq)                 | migration main=ABSENT, deployed=PRESENT                                                    | Required by orchestrator cross-turn context; must apply before promote.                |
| RelationshipManager candidate-goals (`relationship_manager.py` + `..._candidate_goals.sql`)           | **B**                          | diff `@@ -93,+94,60 @@` `_persist/_load_candidate_goals`; migration main=ABSENT            | Forward-only RM addition; migrate.                                                     |
| Life-graph workspace (`routers/life_graph.py`, `services/life_graph_workspace.py`, `main.py` include) | **B**                          | `main.py` L+68 include; files main=ABSENT                                                  | New /v1/life-graph capability; deployed-only.                                          |
| Domain read fixes (`career/education/family.py`)                                                      | **B**                          | career @84/@135/@298 (+16); edu @93 (+4); family @90 (+3)                                  | P0 schema/read fixes; only on deployed; main lacks the fix.                            |
| `get_report_engine` readiness arg (`dependencies.py`)                                                 | **B**                          | deployed L+167 `readiness=` vs main L-167 no readiness                                     | Forward-only; migrate.                                                                 |
| Frontend (apps/web, 112 files)                                                                        | **B** (scope = separate audit) | `git diff --stat ... -- apps/web` → +11272/−1592                                           | Large forward-only delta; pairs with core-api routes; treat in its own pass.           |
| Anything main-newer for core-api                                                                      | **A: NONE**                    | `origin/advisor/p0-upgrade-2.3.0..origin/main -- apps/lifenavigator-core-api` → empty      | Main has zero exclusive core-api commits.                                              |
| `__version__` as a signal                                                                             | **E**                          | `app/__init__.py` = "0.1.0" both refs                                                      | Version identical; cannot distinguish branches by it.                                  |

**No area classified A, C, or D for core-api.** Every diverging core-api capability is class **B**
(deployed newer → migrate into main). There is nothing to delete and nothing where main leads.

---

## 5. Critical safety call-out — the onboarding-bug source

The `/discovery/chat` route is bound to **two different services**:

- **Deployed (production):** `discovery_chat(..., svc=Depends(get_advisor_orchestrator))` →
  `AdvisorOrchestrator.converse(...)` (hybrid: rules guardrail + LLM lead + validator gate +
  cross-turn context from `advisor_turns`). — `life.py` L85–98 + `dependencies.py:get_advisor_orchestrator` L+265.
- **Main:** `discovery_chat(..., svc: RelationshipManager = Depends(get_relationship_manager))` →
  `RelationshipManager.converse(...)` (pure rule-based, no LLM lead, no validator, no
  `conversation_id`, no `advisor_turns` table on main). — `life.py` L82–86.

**Classification: B (deployed newer, must migrate) — and it is the highest-risk single divergence.**
If `main` is promoted/redeployed as-is, the onboarding advisor **silently reverts** from the production
hybrid advisor to the older rule-based RelationshipManager, **drops** the `/discovery/chat/stream` SSE
endpoint the frontend may call, **drops** the `conversation_id`/cross-turn context, and references an
`advisor_turns` table that **does not exist on main**. This route-binding divergence is the structural
onboarding-bug source: the deployed branch and main do not run the same onboarding brain.

---

## 6. Reverse check (does main have anything newer?)

- `git log --oneline origin/advisor/p0-upgrade-2.3.0..origin/main -- apps/lifenavigator-core-api` → **EMPTY** (0 commits).
- `git log --oneline origin/advisor/p0-upgrade-2.3.0..origin/main | wc -l` → **0** (repo-wide).

**Result: NO.** `origin/main` contains **no commit, fix, or file** for core-api (or anywhere) that the
deployed branch lacks. The deployed branch is a strict superset. Consolidation direction is unambiguous:
**fast-forward / merge deployed → main**; there is nothing to salvage _from_ main.

---

## Appendix — commands run (read-only)

```
git log --oneline origin/main..origin/advisor/p0-upgrade-2.3.0 | wc -l            # 66
git diff --stat origin/main..origin/advisor/p0-upgrade-2.3.0 -- apps/lifenavigator-core-api  # 37 files +4721/-96
git diff --stat origin/main..origin/advisor/p0-upgrade-2.3.0 -- apps/web          # 112 files +11272/-1592
git log --oneline origin/advisor/p0-upgrade-2.3.0..origin/main -- apps/lifenavigator-core-api  # (empty)
git log --oneline origin/advisor/p0-upgrade-2.3.0..origin/main | wc -l            # 0
git show origin/main:<path> / git show origin/advisor/p0-upgrade-2.3.0:<path>     # presence checks
git diff origin/main..origin/advisor/p0-upgrade-2.3.0 -- <file>                   # per-file hunks
```

UNKNOWN markers: none required — every claim above is git-determinable.
