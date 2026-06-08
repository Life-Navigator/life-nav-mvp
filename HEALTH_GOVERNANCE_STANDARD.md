# HEALTH GOVERNANCE STANDARD

The safety contract for the Health domain. Health is **wellness/lifestyle guidance only** —
never medical care. This standard extends the generic `AdviceBoundary` with a stricter
`MedicalBoundary` and hard `EscalationRule`s. Design only.

## Hard prohibitions (never, regardless of data)

- **No diagnosis** — never name, infer, or imply a medical condition.
- **No treatment recommendations** — no therapies, procedures, or medical interventions.
- **No prescription guidance** — no drugs, dosing, or medication changes (supplements are
  logged as user data, never prescribed).
- **No medical claims** — no "this will cure/treat/prevent <condition>" language.

A recommendation that would require any of the above is **not generated** (the engine returns
nothing or a referral, never a medical answer).

## Supported (the allowed surface)

- **Educational guidance** — general, sourced wellness information.
- **Wellness coaching** — habits, routines, adherence, encouragement.
- **Lifestyle optimization** — sleep hygiene, activity, nutrition patterns, recovery balance.
- **Physician review** — flag for a clinician when signals warrant.
- **Arcana referral** — hand off to the concierge/clinical partner for anything clinical.

## Boundary model

### `AdviceBoundary` (generic, from RECOMMENDATION_FRAMEWORK)

`boundary_type, disclaimer_text, requires_human_review, escalation_path`.

### `MedicalBoundary` (Health specialization — attached to EVERY health recommendation)

| Field                   | Value                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `boundary_type`         | `medical`                                                                                                   |
| `disclaimer_text`       | "This is general wellness guidance, not medical advice. Consult a licensed clinician for medical concerns." |
| `requires_human_review` | `true` when any `EscalationRule` fires, else `false`                                                        |
| `escalation_path`       | `physician` \| `arcana_referral`                                                                            |
| `prohibited_intents`    | `[diagnosis, treatment, prescription, medical_claim]` (asserted, for audit)                                 |

Materialized in the graph as `(:HealthRecommendation)-[:REQUIRES_REVIEW]->(:AdviceBoundary {boundary_type:"medical", …})` — same fan-out as Finance.

## `EscalationRule` (when to force human review / referral)

| Rule                 | Trigger (from evidence)                             | Action                                                                                                                           |
| -------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `red_flag_vital`     | a `Vital`/`LabMarker` outside a safe reference band | `requires_human_review=true`, `escalation_path=physician`, suppress any optimization advice; emit a referral-only recommendation |
| `symptom_language`   | user query implies symptoms/pain/illness            | route to educational + referral; no optimization                                                                                 |
| `medication_context` | query mentions a drug/condition                     | refuse medical guidance; refer                                                                                                   |
| `minor_or_pregnancy` | profile flags                                       | conservative: referral-first                                                                                                     |
| `rapid_change`       | sharp adverse trend in a metric                     | physician review                                                                                                                 |

Escalation is enforced **before** Gemini (the orchestrator's gate) AND encoded on the boundary
node, so both the answer and the audit trail reflect it.

## Enforcement points (defense in depth)

1. **Engine:** never emits diagnosis/treatment/prescription content; attaches `MedicalBoundary`
   to every recommendation; checks `EscalationRule`s against the evidence.
2. **Orchestrator / Trust-Safety:** the system prompt forbids medical claims; Trust/Safety
   reviews Gemini output and blocks medical-claim language (falls back to safe text).
3. **Graph:** `:AdviceBoundary` node + `REQUIRES_REVIEW` edge make the boundary first-class and
   auditable; chat surfaces the disclaimer from the node.
4. **Gate:** Health does not unlock until a governance gate proves every health recommendation
   has a `MedicalBoundary` and red-flag inputs escalate (extends GRAPH_QUALITY_GATES Gate 10/11).

## Audit

Every health recommendation persists its `governance_verdict` (with the boundary + any fired
escalation) — replayable and auditable, exactly like Finance's `financial_planning` boundary.
