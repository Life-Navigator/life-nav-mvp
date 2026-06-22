# Pilot Readiness Reassessment

**LifeNavigator Elite Pilot Sprint · Final pilot deliverable**
Grounding date: 2026-06-22 · No new infra / models / databases · No fabrication.
Supersedes the V2 reassessment (86/100).

## Prior baseline

**GO-WITH-CONDITIONS · 86/100** (V2 reassessment, itself +4 over the productization A2 audit's
82/100). The V2 score was held below higher by three blocking conditions:

1. Live citation validation with real credentials (carried-over TODO).
2. **P0-1 — `life.facts` reader in `advisor_facts.py`** (advisor could not cite extracted document values).
3. Zero-dead-end enforcement on Health + Education.

## What changed since the 86/100 baseline

| Change                                                                                              | Status                  | Evidence                                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint B — `life.facts` advisor reader**                                                          | **SHIPPED + TESTED**    | `app/services/advisor_facts.py`; `tests/test_advisor_facts.py`; 6/6 advisor-facts tests pass, full backend suite 595 passed                 |
| **Sprint A — Arcana Advisor OS** (state-change → impact → approval → MCP write → show-what-changed) | **DESIGNED, NOT BUILT** | `ARCANA_ADVISOR_OS.md`, `ADVISOR_ACTION_FRAMEWORK.md`, `APPROVAL_AND_CHANGE_SYSTEM.md`, `MCP_ADVISOR_INTEGRATION.md`                        |
| **Life Graph as demo hero**                                                                         | **NO-GO** (decided)     | `GRAPH_GO_NO_GO.md`: data spine excellent; presentation reads as engineering; ship "Life Map" Coming-Soon, keep graph reachable secondarily |
| **Sprint H surfacing audits + Command Center docs**                                                 | **DESIGNED**            | `*_COMMAND_CENTER.md`, `*_EXPERIENCE_REDESIGN.md`, `EDUCATION_DECISION_CENTER.md`                                                           |

**The most consequential change: Sprint B closes baseline blocking condition #2.** `life.facts` was a
fully-built, provenance-complete, conflict-checked write-only sink with **zero readers** — the single
biggest hidden-intelligence finding of the program. The advisor now reads it (confirmed/inferred only,
trust-gated, bounded, citable with `sourceTable=life.facts` + `recordId` + confidence), so extracted
document values (trustee, beneficiaries, coverage amount, comp figures) are assertions the advisor can
make _and defend_ through the existing validator. The number-gate now harvests figures from
`life.facts`, so the advisor can echo a real coverage amount without rejection. **No new infra** — a
pure read over an existing RLS-protected table. This is the #1-ROI advisor-citation fix, now live.

## Gate-by-gate assessment

| Gate                                                      | V2 (86)                   | Now                         | Notes                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------- | ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Trust spine — no fabrication**                          | PASS                      | **PASS**                    | Reinforced: no-evidence→no-recommendation (`recommendations_os.write()`); `_confirmation` gate; PII counts-only; Sprint B reader excludes `candidate` facts and flags `inferred` as "pending your confirmation."                                                                                                   |
| **Provenance traceability (digital docs)**                | PASS                      | **PASS**                    | Migration 165 page/section/char-span; `OCR_TRUST_AUDIT` confirms no fabrication. Scanned/image = honest dead-end (no OCR).                                                                                                                                                                                         |
| **Conflict safety**                                       | PASS (narrow)             | **PASS (narrow)**           | Migration 166 + `conflicts.py`; advisor refuses conflicted facts. Narrow but correct.                                                                                                                                                                                                                              |
| **Citations / advisor grounding**                         | PASS, with a known gap    | **PASS**                    | **Gap CLOSED.** Sprint B `life.facts` reader makes extracted field _values_ citable and number-gate-eligible. Validator keeps only cited facts.                                                                                                                                                                    |
| **Readiness one-source-of-truth**                         | PASS                      | **PASS**                    | Migration 163 — TS + Python read one record.                                                                                                                                                                                                                                                                       |
| **Advisor action loop (state-change → approval → write)** | (not yet a gate)          | **DESIGNED, NOT BUILT**     | New gate. Sprint A specifies the loop end-to-end over existing MCP write primitives + a mandatory approval gate (no silent writes). Personas confirm the advisor reads but cannot act — this is the principal advisor-experience gap. Not pilot-blocking (read path is sound), but it caps advisor quality at 7.1. |
| **Surfacing / experience**                                | DESIGNED, NOT FULLY BUILT | **DESIGNED, PARTIAL BUILD** | Family Office shipped; Sprint B advisor reader shipped; Health/Education/domain-recs/user-facing-life.facts render still to build. Principal residual gate.                                                                                                                                                        |
| **Honest empty states / zero dead ends**                  | PASS, with exceptions     | **PASS, with exceptions**   | Exceptions unchanged: static `HealthTabEmpty` (9/13 tabs), inert `EducationTabEmpty` ROI tabs, scanned-doc dead-end, frontend doc-type catalog vs backend `TAXONOMY` mismatch (silent 400). All have designed fixes; the catalog/taxonomy mismatch is a _trust_ dead-end and should close before pilot.            |
| **Live validation w/ real credentials**                   | STILL OPEN                | **STILL OPEN**              | Live advisor + report citation suite vs a live model + populated account remains a TODO (needs key rotation + Gemini prepay credit).                                                                                                                                                                               |

## Updated score

**GO-WITH-CONDITIONS · 89/100** (+3 from the 86 baseline).

**Rationale for the +3:** Sprint B converts the single highest-leverage advisor-citation gap from
"known open gap" to **shipped + tested** (the citations/advisor-grounding gate flips from "PASS with a
known gap" to clean PASS). The score does not rise further because: (a) the Arcana Advisor OS — the
loop that would make the advisor _act_, not just read — is **designed but not built** (new gate,
caps advisor quality and emotional resonance); (b) the broad surfacing program (Health/Education/
user-facing `life.facts`) is still designed-not-built; and (c) the live-credential validation gate
remains open. The trust spine is now materially complete; the residual is **surfacing, the advisor
action loop, and one live-validation run** — none requiring new infrastructure.

## Conditions that remain (the pilot gates)

**Blocking for a broad pilot (must close):**

1. **Live citation validation with real credentials** — the carried-over TODO. Run the advisor +
   report citation suite (now including `life.facts`-cited values) against a live model + populated
   account; confirm zero fabrication and correct page-level citations end to end. (Needs key rotation
   - Gemini prepay credit.)
2. **Doc-type catalog vs backend `TAXONOMY` mismatch** — frontend lists ~9 doc types absent from the
   backend taxonomy → a silent 400 dead-end on upload (worst kind of trust failure, `FACT_VISIBILITY_AUDIT.md`).
   Fix the catalog or the taxonomy before pilot.
3. **Zero-dead-end enforcement on Health + Education** — static `HealthTabEmpty` (9/13 tabs) and inert
   `EducationTabEmpty` ROI tabs are dead ends a pilot user _will_ hit. Designed (`HEALTH_EXPERIENCE_REDESIGN.md`,
   `EDUCATION_DECISION_CENTER.md`); must build.

**Non-blocking but pilot-quality (should close early):** 4. **User-facing `life.facts` render** — the advisor reader shipped; surface the same table to the user
("recently learned" strip) so extracted values aren't invisible post-upload. 5. **Arcana Advisor OS build** — designed; converts the read-only advisor into the state-change →
approval → write loop. Highest-impact _experience_ lift; not trust-blocking (approval gate + MCP
writers already enforce no silent writes). 6. Unify domain recommendation pages onto the OS card; confidence bands at first sight; scanned-doc
manual-entry fallback.

**Explicitly deferred (named, not half-built):** OCR/vision for scanned docs; Credly OAuth rework;
cross-document reasoning edges; Life Graph as demo hero (NO-GO — ship Coming-Soon tease); promotion ML.
None gate the pilot.

## Verdict

**GO-WITH-CONDITIONS, 89/100.** The trust spine is now materially complete: provenance, conflict
detection, readiness one-source-of-truth, and — newly — the advisor's ability to cite extracted
document values (Sprint B, shipped + tested). The pilot is gated on a small, well-defined set:
one live-credential validation run, the doc-type catalog/taxonomy fix, and zero-dead-end enforcement
on Health/Education. The biggest _experience_ lever (the Arcana Advisor OS action loop) is designed
and scoped but not built — important for advisor quality, not blocking for trust. **The remaining
work is surfacing, one validation run, and building a designed loop — not new infrastructure.**
