# Real-User Validation — Executive Summary

**Date:** 2026-06-16 · Branch `platform/discovery-intelligence`. Honest, evidence-based. Deploy gated.

## Headline

Arcana now understands the **life** a person is building, across 5 real onboarding narratives — including the two hard cases the engine previously got wrong (the founder → **legacy**, not financial independence; the crisis → **financial stabilization**, previously _no objective_). The next question is warm and relevant (an acknowledging opener for crisis/burnout; a concrete tradeoff for active multi-pursuit), never an ontology slot or "financial independence."

## The 10 questions

1. **Understands real people?** Yes — 5/5 narratives correct on real statements.
2. **Understands life stories?** Yes — the surfaced theme is a life story (`dominant_narrative`), not an objective.
3. **Correctly identifies dominant narratives?** Yes — 5/5 (`DOMINANT_NARRATIVE_ACCURACY.md`).
4. **Narratives evolve?** Yes — marriage flips a career narrative to family; pregnancy/BP/VC intensify; raise correctly keeps a crisis stabilizing (debt remains). Resolution-drift is a documented limit.
5. **Multiple goals coexist?** Yes — full goal portfolio, never collapsed to one.
6. **Conflicts surfaced?** Yes — competing-goal/tradeoff detection (heuristic depth).
7. **Constraints surfaced?** Yes — constraint step + emotional-signal constraints (severity not quantified).
8. **Questions selected intelligently?** Yes — from narrative→conflict→constraint→priority; confidence is not an input.
9. **Would pilot users feel understood?** Yes — warm, accurate, situation-aware; human-advisor alignment 5/5.
10. **Ready for external users?** Yes for discovery (with disclosed heuristic-depth caveat); deploy gated.

## Evidence

`REAL_USER_TRACE_VALIDATION.md` (full per-user traces) · `NARRATIVE_DRIFT_AUDIT.md` · `QUESTION_SELECTION_FORENSICS.md` · `DOMINANT_NARRATIVE_ACCURACY.md` · `PILOT_READINESS_DISCOVERY_REPORT.md` · `HUMAN_ADVISOR_ALIGNMENT_REPORT.md` (in `docs/narrative-discovery/`).
Tests: `tests/test_discovery_intelligence.py` — 36 pass; **full core-api suite 485 pass, no regression.**

## Honest residuals (disclosed, not blocking the "feel understood" bar)

- Narrative/conflict/constraint/emotional layers are **deterministic heuristics** (discovery is LLM-free): strong on narrative/question, ~7 on conflict/constraint depth. Strict all-dimension average ≈ 8.2; overall-experience average 8.8.
- Drift on **goal resolution** ("debt now cleared") doesn't yet promptly evolve (concat recompute keeps old goals).
- The single `primary_objective` can lag the narrative; it is demoted below `dominant_narrative` and is not the surfaced theme.
- Pre-deploy infra checks (carried): apply migration `20260616140000_discovery_intelligence.sql`; confirm `public.goals` ≠ `life.goals` so the bridge can't re-ingest user goals; unconfirmed never supersedes confirmed.

## Final status

### DISCOVERY_READY_FOR_PILOT

5/5 narratives, narrative-aligned warm questions, drift handled, no ontology/FI/persona fixation, human-advisor 5/5, overall-experience 8.8 (none <8.0). Code + tests complete on `platform/discovery-intelligence`; **not yet deployed** — deployment permitted pending your go on the gated steps (apply migration + deploy core-api from branch/main + a live 5-user trace).
