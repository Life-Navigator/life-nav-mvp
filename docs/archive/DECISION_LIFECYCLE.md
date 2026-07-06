# LIOS — Decision Lifecycle

> The complete lifecycle of a **decision** in LifeNavigator: framing, inputs, modeling, tradeoffs, the user's
> choice, tracking, and revisiting. Validation review against the LIOS architecture. Architecture review
> only — no code, no prompts.

A "decision" = a consequential choice the user is weighing ("should I buy this house?", "leave my job?",
"retire early?"). LifeNavigator's job is **not** to make the decision — it is to _frame it, model the
tradeoffs from the user's real data, name what's missing, and let the user decide with clarity_. This is the
"decision intelligence platform" promise, and it is where the advice boundary matters most.

---

## 1. The cardinal rule

> **LifeNavigator models decisions; it never makes them.** Every number in a decision comes from
> deterministic Tool Execution with a `calculation_trace`; the advisor frames tradeoffs and gathers missing
> inputs; the final choice — and any "you should do X" — belongs to the user. Decision Intelligence returns
> _the modeled tradeoffs + missing inputs_, never "the answer."

This is the live posture: the decision brain / scenario compare return `calculation_trace` /
`tool_calculations` (traceable numbers), and the advisor, when asked "can I afford it / how much," names the
inputs needed rather than answering with a recommendation.

---

## 2. States

| State             | Meaning                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `raised`          | the user surfaces a decision (in chat or a decision workspace)        |
| `framed`          | the decision, its options, and the relevant domains are identified    |
| `inputs_gathered` | the inputs the model needs are collected; missing ones named          |
| `modeled`         | each option is simulated deterministically (with a calculation trace) |
| `presented`       | tradeoffs + risks/opportunities per option shown to the user          |
| `chosen`          | the user makes a choice (recorded, with rationale if given)           |
| `tracked`         | the choice becomes goals/actions/recommendations to execute           |
| `revisited`       | inputs change → re-model; the decision can be reopened                |
| `archived`        | the decision is closed/no longer active                               |

---

## 3. State transitions

```
 user ─▶ raised ─▶ framed ─▶ inputs_gathered ─(complete?)─▶ modeled ─▶ presented ─▶ chosen ─▶ tracked
                      │            │ missing               │             │            │          │ inputs change
                      │            ▼                       │             │            │          ▼
                      │      ask (advisor names            │             │            │      revisited ──re-model──▶ modeled
                      │      missing inputs; Missing Data)  │             │            │
                      │                                     │             │            ▼
                      └─────────────── citation contract for cross-domain links ──────  archived
```

| Transition                    | Trigger                       | Owning agent                              | Guard                                              |
| ----------------------------- | ----------------------------- | ----------------------------------------- | -------------------------------------------------- |
| → `raised`                    | user asks a decision question | Orchestrator (intent = decision)          | classified as a decision                           |
| `raised` → `framed`           | identify options + domains    | Decision Intelligence                     | options are the user's real situation              |
| `framed` → `inputs_gathered`  | collect inputs                | Missing Data + Advisor + domains          | missing inputs named, not guessed                  |
| `inputs_gathered` → `modeled` | simulate                      | **Tool Execution** (deterministic)        | every number from data/engine + a trace            |
| `modeled` → `presented`       | render tradeoffs              | Decision Intelligence + Response Composer | no "the answer"; show tradeoffs + per-option risks |
| `presented` → `chosen`        | user decides                  | RelationshipManager (records)             | explicit user choice                               |
| `chosen` → `tracked`          | convert to goals/actions      | RelationshipManager / domains             | user-confirmed goals only                          |
| any → `revisited`             | inputs change                 | Decision Intelligence                     | re-model from new truth                            |

**Invariant:** `inputs_gathered → modeled` is deterministic — the LLM may _frame_ and _explain_, but the
numbers come only from Tool Execution with a trace. The LLM never produces the decision's figures and never
selects the option for the user.

---

## 4. Framing & missing inputs (the anti-evasion balance)

A decision question must be **engaged, not deflected**. When the user provides figures ("$120k income, $60k
saved, $450k house"), the advisor reflects them and names the _specific_ inputs needed to model THIS
decision (down payment comfort, monthly budget, timeline) — rather than retreating to a generic "what's your
vision." (This is the decision-engagement behavior; the live eval measured a meaningful drop in evasiveness.)
Balance:

- Engage the specific decision and use the user's own numbers (allowed-numbers).
- Name the few decisive missing inputs (Missing Data) and ask for the most decisive one.
- Never cross into "you should buy it" (advice boundary).
- Never compute new numbers in prose — modeling is deterministic.

---

## 5. Modeling & tradeoffs

- Each option is simulated by deterministic engines; the output is a set of modeled outcomes per option,
  each with a `calculation_trace` so every figure is auditable.
- Per-option **risks/opportunities** are surfaced (each evidence-backed; see `RISK_LIFECYCLE.md`).
- Cross-domain effects (e.g. a housing choice affecting retirement) require a **cited real edge** to be
  asserted (citation contract).
- The presentation is a **comparison**, not a verdict: tradeoffs, what each option costs/protects, and what
  more data would sharpen the model.

---

## 6. Choice, tracking, revisiting

- The user's choice is recorded (with optional rationale) as a `user_stated` event — the system never marks
  a decision "made" on the user's behalf.
- A choice becomes **tracked** by converting to user-confirmed goals/actions/recommendations, which then
  follow their own lifecycles.
- Decisions are **revisitable**: when inputs change (a new document, a market change, a life event), the
  decision re-models and can be reopened — decisions are living, not one-shot.

---

## 7. Observability

- The decision's inputs, the `calculation_trace` per option, the surfaced tradeoffs, and the user's choice
  are all recorded — so "why was this modeled this way?" is answerable.
- Decision turns flow through the same advisor telemetry (status, validator, latency) plus the decision
  workspace's own record.

---

## 8. Invariants (decision-specific)

1. LifeNavigator models decisions; it never makes them (no "you should choose X").
2. Every decision figure comes from deterministic Tool Execution with a calculation trace.
3. Decision questions are engaged using the user's own numbers, not deflected to generic vision.
4. Missing inputs are named, never guessed.
5. Cross-domain decision links require a cited real edge.
6. The user's choice is an explicit `user_stated` event; tracking uses confirmed goals only.
7. Decisions are revisitable when inputs change.

---

## 9. Failure / escalation

| Failure                        | Handling                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Insufficient inputs to model   | present what's known + the missing-input list; do not fabricate a model      |
| User pushes for "just tell me" | reflect the tradeoffs + the decisive missing input; hold the advice boundary |
| Engine can't simulate          | honest limitation, not a guessed outcome                                     |
| Inputs change after a choice   | offer to revisit/re-model                                                    |

---

## 10. Validation review

| Requirement                               | Today                                                                | Verdict / gap                                                           |
| ----------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Numbers from deterministic engine + trace | live (decision brain `calculation_trace`/`tool_calculations`)        | ✅ holds                                                                |
| Models, doesn't decide (advice boundary)  | live (validator advice gate; decisions probe 0 advice)               | ✅ holds                                                                |
| Engage decision with user's numbers       | live (decision-engagement prompt + allowed-numbers)                  | ✅ holds (evasiveness measurably reduced)                               |
| Cross-turn input carry                    | partial (same-message numbers used; prior-turn not yet threaded)     | ⚠️ **gap: thread prior-turn stated inputs into the decision model**     |
| Per-option risks evidence-backed          | live (RecommendationOS)                                              | ✅ holds                                                                |
| Choice recorded + tracked                 | partial (workspace exists; formal decision→goal tracking incomplete) | ⚠️ **gap: formal choice record + decision→goal/action tracking**        |
| Revisit on input change                   | partial                                                              | ⚠️ **gap: re-model trigger on data change + reopen flow**               |
| Decision-quality eval                     | partial (decisions probe measures fallback/evasiveness)              | ⚠️ **gap: decision golden-set scoring quality of the framed tradeoffs** |

**Open questions:**

1. Where do decisions live — purely conversational, or a first-class "decision workspace" object with state?
2. How are option outcomes compared/normalized for presentation without implying a ranking ("the answer")?
3. What is the trigger and cadence for revisiting a tracked decision?

---

## 11. Live vs planned

- **Live:** deterministic modeling with traces; models-not-decides boundary; decision-engagement with the
  user's numbers; evidence-backed per-option risks.
- **Planned:** cross-turn input threading; a first-class decision object with choice record + tracking;
  re-model-on-change + reopen; a decision golden-set for quality.
