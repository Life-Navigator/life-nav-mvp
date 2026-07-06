# ADVISOR_SUPERVISION_PIPELINE_AUDIT.md — Phase 1

## Pipeline (advisor_orchestrator.\_enhance)

RM deterministic turn → urgent-care safety net → **context build** (SQL fact packet, no muzzle) → `build_constraints` → **model generate** (Vertex Gemini 2.5 Pro) → **validate** → **supervised repair loop (≤2)** → compose → stream. No streaming before the validated answer.

## Where the model WAS prevented from answering (now fixed)

- Pre-gen prompt language (prior sprints): "avoid numbers / ask first" → already replaced with answer-first + scenario-labeling.
- The number gate blocked benchmark/scenario $ and fell back after ONE failed repair → **now a 2-attempt structured loop** repairs instead.
- Advice/verdict reasons were NON-repairable (hard fallback) → **now repairable** (model reframes to checklist/hedge).

## Components

- number gate `_fabricated_personal_numbers` (3-tier + bounded benchmark-derivation auto-accept).
- derivation verifier `verify_derivations` (strict + scenario tiers).
- advice/clinical/legal/tax/verdict gate `_ADVICE`.
- relationship gate `_check_relationships`.
- **NEW** `classify_issues` → structured repair feedback; orchestrator loop (≤2) re-validates each draft.
