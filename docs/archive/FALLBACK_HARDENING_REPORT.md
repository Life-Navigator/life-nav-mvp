# FALLBACK_HARDENING_REPORT.md — 2026-06-25 (commit 054796e)

Surgical pass: ensure the old regex/fragment fallback cannot silently re-enter substantive onboarding
discovery, without breaking the working semantic path or removing useful deterministic validators.

## P1 — Reachable legacy fallback call sites (audited)

| Site                                                                                                                                    | Reachable in discovery?      | Persists goals? | Builds response/reveal?         | Action                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------- | ------------------------------- | -------------------------------------------------------- |
| `RelationshipManager.answer()` goal branch — `else analyze_statement(ans)`                                                              | yes                          | yes             | feeds reveal                    | **GATED → `else []`**                                    |
| `RelationshipManager.converse()` — `else analyze_statement(message)`                                                                    | yes (every turn)             | yes             | feeds reflection/reveal/actions | **GATED → `else []`** + status capture                   |
| `LifeDiscoveryService.analyze_statement()` (the splitter itself)                                                                        | only via the two sites above | n/a             | n/a                             | **KEPT** (deterministic; now unreachable from discovery) |
| reveal (built from `rec.objective`, not fragments)                                                                                      | yes                          | no              | yes                             | KEPT (not fragment-sourced)                              |
| deterministic validators (complete-phrase ≥2 words, domain map, deprioritization, rejected-goal suppression, safety gates, persistence) | yes                          | —               | —                               | **KEPT**                                                 |

Only **two** reachable legacy sites existed; both are now gated.

## P2/P3 — Gating + safe LLM-failure behavior

- Goals in discovery come **only** from `_interpret_plan` (the semantic plan). The clause-splitter is never
  used to create goals for a substantive turn.
- `_interpret_plan` records status: `ok | no_llm | skipped_short | llm_failed | parse_failed | empty`.
- On `llm_failed | parse_failed` for a substantive (≥6-word) turn: **no goals persisted, no fragments**, a
  safe clarification ("I'm having trouble turning that into a clean plan right now… what's the most important
  thing you want LifeNavigator to help you organize first — finances, health, career, family…?"), and a
  `onboarding_interpreter_failed` warning is logged.
- Validators/normalizers kept intact (complete-phrase, no raw-paragraph title, domain, deprioritization-only,
  safety, persistence).

## P4 — Deprioritization-only preserved

"I already have my degree, so education is not a priority." → education deprioritized (persisted to
`life_vision.prompts.deprioritized_domains`), no fake education goal, no intake loop, no legacy fallback.

## P5 — Trace fields (returned in `onboarding_trace` + logged for substantive turns)

`interpreter_used, interpreter_failed, interpret_status, semantic_path_used, legacy_fragment_path_used,
fallback_type, persisted_goals_count, rejected_goals_count, response_source, reveal_source,
action_unlock_source`. Invariants for substantive turns: `legacy_fragment_path_used=false`;
`response_source ∈ {semantic, safe_clarification}`.

## P6 — Regression tests (tests/test_onboarding_hardening.py, +existing)

1. **LLM failure** (FailingGem): no fragments, no persisted goals, safe clarification, `legacy_fragment_path_used=false`, `interpreter_failed=true`.
2. **Known good** (clean LLM): semantic path, ≥3 clean goals, no forbidden fragments, complete phrases.
3. **Deprioritization-only**: education deprioritized, no fake goal, no legacy fallback.
4. **Short vague ("family")**: no persisted raw goal, no fragment fallback, a focused follow-up.
   Existing discovery tests now inject `FakeInterpreterGemini` (mirror prod, where the interpreter LLM is
   always present). **707 core-api tests pass.** Forbidden strings ("This gives me a year to get my financial",
   "Career foundation built", "But getting back in shape", raw-paragraph title, "Did I capture that correctly?",
   "is this about family…") are asserted absent.

## P7 — Production verification (live, deployed 054796e)

Known paragraph through the deployed RM:
`onboarding_trace`: semantic_path_used=**true**, legacy_fragment_path_used=**false**, interpreter_failed=false,
response_source=**semantic**, persisted_goals_count=5. Goals: "Get married next year", "Start a family",
"Build a strong financial foundation", "Get back in shape", "Build a solid career foundation" — **no fragments**.
deprioritized_domains=["education"]. Scratch user cleaned. No new console errors.

## Definition of done

- Passing onboarding preserved ✅ · legacy fragment fallback unreachable for substantive discovery ✅ ·
  LLM failure cannot corrupt persisted goals ✅ · deterministic validators intact ✅ · deprioritization-only
  intact ✅ · regression tests pass (707) ✅ · production verified ✅.

This was a hardening pass, not a redesign. The semantic path that finally works is unchanged.
