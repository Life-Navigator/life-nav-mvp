# LIOS — Agent Failure Behavior (standardized outcome states)

> The fixed set of outcome states **every** LIOS agent must return. No agent invents its own status words.
> Specification only — no code, no prompts, no runtime. Referenced by every agent spec and by
> `AGENT_OUTPUT_SCHEMAS.md`, `AGENT_ESCALATION_MODEL.md`, `AGENT_CONFIDENCE_MODEL.md`.

LIOS never "guesses to fill a gap." When an agent cannot produce a confident, grounded result, it returns a
**typed outcome** that tells the Orchestrator exactly what to do next. The user never sees an exception, a
fabricated value, or a silent partial result.

---

## 1. The six outcome states

Every agent output carries `status` ∈ exactly one of:

| State                 | Meaning                                                        | Carries                           | Orchestrator's next move                                      |
| --------------------- | -------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------- |
| `success`             | confident, valid, grounded result                              | `payload`, `confidence`           | continue the pipeline                                         |
| `needs_data`          | required inputs missing; cannot answer confidently             | `missing_data[]` (ranked)         | route to Missing Data / Advisor to ask; or honest empty state |
| `needs_confirmation`  | has a candidate that must be user-confirmed before use/persist | `candidates[]` + what to confirm  | surface for confirmation; never persist yet                   |
| `blocked`             | a precondition/tool failed; cannot proceed safely              | `reason`                          | stop safely; fall back to deterministic text; log             |
| `escalated`           | work belongs to another agent                                  | `escalation{to, reason, payload}` | hand off (via Orchestrator only)                              |
| `compliance_rejected` | output failed the Compliance gate                              | `reasons[]`                       | use deterministic fallback; log as a quality signal           |

> These six are exhaustive and mutually exclusive. An agent returns **exactly one** per invocation.

---

## 2. When to use each (decision order)

An agent evaluates in this order and returns the first that applies:

```
1. Can I even start? (tools/preconditions ok?)        no → blocked
2. Does this work belong to another agent?            yes → escalated
3. Do I have the required inputs?                      no  → needs_data
4. Is my best result a candidate needing the user?    yes → needs_confirmation
5. (After Compliance) did my output pass the gate?    no  → compliance_rejected
6. Otherwise                                          → success
```

`compliance_rejected` is set by the Orchestrator/Compliance after the agent returns, not by the agent
itself — but every agent's schema must be able to _carry_ it, because the governed response reflects it.

---

## 3. State → confidence relationship

The outcome state is tied to the confidence band (see `AGENT_CONFIDENCE_MODEL.md`):

| Confidence  | Typical state                                                          |
| ----------- | ---------------------------------------------------------------------- |
| ≥ 0.75      | `success`                                                              |
| 0.40 – 0.75 | `needs_data` (missing inputs) or `needs_confirmation` (have candidate) |
| < 0.40      | `blocked` or `escalated` (cannot responsibly answer)                   |

A `success` with confidence below 0.75 is **not allowed** — if the agent isn't confident, it must return a
non-success state, never a low-confidence assertion dressed as an answer.

---

## 4. Invariants

1. Every agent returns exactly one of the six states.
2. `needs_data` must include the **ranked missing inputs**, never a guess at their values.
3. `needs_confirmation` items are candidates only — never persisted, never shown as confirmed.
4. `blocked` is a safe stop: it triggers the deterministic fallback, never an error to the user.
5. `escalated` always names the target agent + reason and routes **through the Orchestrator** (no direct
   agent-to-agent calls).
6. `compliance_rejected` always lists reasons (for Audit + quality metrics).
7. No state ever results in fabricated data, a silent partial write, or an unhandled exception.

---

## 5. Mapping to the live system

This standard generalizes the live advisor's behavior:

| Live advisor outcome                        | Standard state        |
| ------------------------------------------- | --------------------- |
| `llm_status = enhanced`                     | `success`             |
| `fallback:unavailable` / `fallback:empty`   | `blocked`             |
| `fallback:<validator reasons>`              | `compliance_rejected` |
| `fallback:error`                            | `blocked`             |
| `missing_data` populated                    | `needs_data`          |
| candidate facts/goals awaiting confirmation | `needs_confirmation`  |

So the six-state model is not new behavior — it is the existing behavior, named uniformly so every future
agent uses the same vocabulary.
