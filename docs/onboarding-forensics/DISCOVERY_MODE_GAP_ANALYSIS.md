# Discovery Mode Gap Analysis (Phase 5 + Phase 4)

**Evidence-only.** Determines whether a true Discovery Mode exists, what is actually running, and how a seeded value became a stated fact.

## Phase 5 — Does a true Discovery Mode exist?

**Yes — in this repo.** A real, conversational discovery mode exists and is fully implemented:

- `apps/lifenavigator-core-api/app/services/relationship_manager.py` — `RelationshipManager.converse` (`:227-344`).
- Question bank `:42-61` (warm, open questions, asked one at a time).
- Reflect-the-user's-words rule `:296-314`.
- Output assembly `:341`: `assistant = reflection + opener + next_question + why_line`.
- **No LLM, no sections, no disclaimer, no tradeoffs** (E3, E5, E6).

| Mode                                  | Does the active production onboarding use it?                                  | Evidence                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Discovery prompt** (conversational) | **NO** (exists in-repo, not what's running)                                    | observed output has none of the in-repo discovery's characteristics (E2 vs observed)                      |
| **Advisor prompt**                    | **most consistent with the observed output** but `EXTERNAL` (not in this repo) | observed 6-section decision-analysis format; not in repo (E5)                                             |
| **Hybrid prompt**                     | `UNKNOWN — EXTERNAL`                                                           | out-of-repo context suggests the deployed discovery/chat is a hybrid advisor; not file:line-provable here |
| **Fallback prompt**                   | `UNKNOWN — EXTERNAL`                                                           | —                                                                                                         |
| **Benchmark prompt**                  | `UNKNOWN — EXTERNAL`                                                           | benchmark artifacts absent from repo (Phase 6)                                                            |

**Active path (provable portion):**

```
advisor/page.tsx:189 → api/life/discovery-chat/route.ts:7 → CORE_API (_helper.ts:2-4) → /v1/life/discovery/chat → [EXTERNAL advisor] → assistant_message → advisor/page.tsx:182
```

The provable conclusion: **production is NOT running the in-repo Discovery Mode.** Which specific external mode it runs is `UNKNOWN — EXTERNAL`, but the output's structure is the **advisor** format, not the **discovery** format.

## Phase 4 — Assumption leak: "Your primary objective is 'Reach financial independence'" presented as fact

### Where the value comes from (provable, in-repo)

1. **The user selected a persona.** The onboarding persona seeds the canonical life model with a `primary_objective` (and `life_vision`):
   - `apps/web/src/components/onboarding/SampleFinancialProfile.tsx` (persona selection UI; activation → advisor, per the first-15-min audit `:75`).
   - `apps/web/src/app/api/integrations/plaid/activate-persona/route.ts` (server activation that seeds the persona's data).
2. **In-repo, the objective is a confidence-scored candidate, not a confirmed fact:**
   - `services/life_discovery.py:149-201` — "Reason from statement → themes → objective **with confidence**, alternatives…"; returns `{"primary_objective": …, "confidence": …, "alternatives": …}` (`:168`, base confidences `0.3` at `:175,184,193`).
   - `services/relationship_manager.py:212-220` `_context_panel` exposes `primary_objective` as a plain title to the UI — **without** the confidence or "confirmed" status.

### Classification

| Trace target     | Finding                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| Source node      | the persona-seeded `primary_objective` in the canonical life model (`activate-persona/route.ts`) |
| Source document  | none (persona seed, not an uploaded document)                                                    |
| Source memory    | the `life.life_vision` / objective rows written during persona activation                        |
| Source inference | `life_discovery.py:149-201` infers objective+confidence from signals                             |
| Source prompt    | `EXTERNAL` (the declarative restatement is produced by the deployed advisor composition)         |
| Source formatter | `EXTERNAL`                                                                                       |
| Source validator | `EXTERNAL` (no in-repo validator)                                                                |

**Confirmed / Inferred / Candidate / Unknown:** **CANDIDATE → INFERRED.** The value originates from the **persona the user picked** (an implicit selection), and in-repo it is explicitly a _confidence-scored_ candidate with alternatives. It was **not** confirmed by a typed discovery answer.

**Was it actually confirmed by the user?** **No** — not via a discovery confirmation. It was implied by persona selection and inferred with a confidence score.

**Which component elevated it to fact?** The **`EXTERNAL` advisor composition** (deployed core-api) restated the seeded/inferred objective as a flat declarative ("Your primary objective is 'Reach financial independence'"), dropping the confidence/candidate framing that the in-repo layer preserves (`life_discovery.py:149-201`). That elevation does **not** occur anywhere in this repo — the in-repo code carries the confidence and never asserts it as established fact. The exact external line is `UNKNOWN — EXTERNAL`.

## Summary

A correct, conversational Discovery Mode **exists in this repo and is not the problem**. Production runs a different (advisor-style, `EXTERNAL`) implementation on the discovery route, which both (a) leads with analysis instead of questions and (b) restates a persona-seeded, confidence-scored candidate objective as a confirmed fact.
