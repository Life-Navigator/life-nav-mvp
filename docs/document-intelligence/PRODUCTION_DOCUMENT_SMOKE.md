# Production Document Smoke

**Date:** 2026-06-18 · Code/test-verified now; the live upload pass needs a magic-link session + sample files (gated on auth, not code).

## Verified now (the bridge — 12 tests in `tests/test_document_bridge.py`, full suite 537 pass)

| Path                                                                           | Result               | Evidence                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Will → `life.facts` (executor, guardian)                                       | ✅                   | bridge test                                                                                                                                                                                                                                                                         |
| Will → `estate_plans.has_will=true` + `guardianship_plans.designated_guardian` | ✅                   | bridge test (only when extracted; FamilyService reads these)                                                                                                                                                                                                                        |
| Life Insurance → `life.facts` (coverage) + `insurance_profiles.life_coverage`  | ✅                   | bridge test                                                                                                                                                                                                                                                                         |
| No fabrication when a field isn't extracted                                    | ✅                   | bridge test (nothing written)                                                                                                                                                                                                                                                       |
| Below-threshold facts are `inferred`, not auto-`confirmed`                     | ✅                   | bridge test                                                                                                                                                                                                                                                                         |
| Idempotent re-upload (no duplicate facts/rows)                                 | ✅                   | bridge test                                                                                                                                                                                                                                                                         |
| User-confirmed value preserved (won't be overwritten by lower-confidence doc)  | ✅                   | bridge test                                                                                                                                                                                                                                                                         |
| Tenant scoping from context                                                    | ✅                   | bridge test                                                                                                                                                                                                                                                                         |
| Downstream consumption                                                         | ✅ (chain confirmed) | FamilyService reads `insurance_profiles.life_coverage` / `estate_plans` / `guardianship_plans` (`family.py:89-102`); recommendations_os protection-gap rec derives from the same coverage (`recommendations_os.py:275-292`); dashboard Family Overview card reads the family tables |

## The live pass (run with one magic-link user + sample files)

For each of a sample **will**, **trust**, **life insurance policy**:

1. Upload via `/dashboard/documents` (or `/dashboard/family/documents`).
2. Confirm the upload result shows the **state machine + "what changed"** (e.g. "✓ Will detected", "✓ Guardian identified", "✓ Estate plan updated") — not bare "Upload successful".
3. Open `/dashboard/family` → confirm **family/estate/protection readiness moved** (has_will / guardian / life_coverage now set).
4. Open `/dashboard/recommendations` → confirm the estate "missing documents" dependency resolves and/or the protection-gap rec reflects the policy's coverage.
5. Open the dashboard **Family Overview** card → confirm it reflects the new estate/insurance state.

Capture before/after for each. This is a ~15-minute manual pass; everything it exercises is verified at the code/test layer above.

## Honest residuals to note during the smoke

- **Life Brief / explainable graph** won't yet show document-derived `life.facts` (no consumer reads `life.facts` — documented follow-on). The **Family** surfaces (the user's actual examples) do update.
- **Trust-specific fields** (trustee/grantor/successor) persist to `estate_plans.metadata` + `life.facts` but FamilyService doesn't read metadata yet — `has_will`/guardian/coverage do surface.
- Prose/scanned docs still extract weakly until the **Gemini/Vision extraction upgrade** (DOCUMENT_EXTRACTION_ARCHITECTURE.md) — labeled native docs bridge today.

## Status

Bridge: **code/test-verified.** Live UI pass + extraction-quality upgrade: **pending** (gated on a session / the Phase-3 upgrade).
