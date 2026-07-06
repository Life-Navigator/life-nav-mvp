# LIOS — Compliance & Safety Flow

> How LifeNavigator reviews every response before the user sees it, prevents hallucination, enforces the
> advice boundary, and escalates safely. Companion to `TRUTH_AND_PROVENANCE_MODEL.md`. Architecture only —
> no code.

---

## 1. Philosophy

Compliance in LIOS is **deterministic and mandatory**. It is not a model judging a model's vibe; it is a
set of explicit, testable rules that every LLM output must pass before it can reach the user. The LLM leads
the conversation; the Compliance gate guarantees it can never fabricate, overstep, or persist.

> **Review before output is not optional and not bypassable.** The Orchestrator must route every LLM
> proposal through Compliance, and on failure it serves a deterministic safe response instead. This is
> already how the live advisor works (`advisor_validator.validate` → accept/repair/reject → fallback).

Three outcomes only:

- **Accept** — the proposal is safe and grounded; ship it.
- **Repair** — the proposal is safe but cosmetically over-broad (e.g. asked two questions); trim to a safe
  form and ship the repaired version.
- **Reject** — the proposal violates a safety/anti-fabrication rule; discard it and serve the deterministic
  fallback. Record the reason.

---

## 2. The gate's rule set

Run over the **full visible text** of the proposal (reflection + question + why + summary) plus its
structured fields, against the bounded context.

### 2.1 Safety boundaries (reject)

| Rule                     | What it blocks                                                                                                                                              | Why                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Advice boundary**      | "I recommend / you should buy·sell·invest·borrow·put·withdraw…", "the best option is", medical diagnosis, "for tax purposes you should", "legally you must" | the advisor _discovers_; recommendations come from the evidence-backed engine; medical/legal/tax advice is never given |
| **Medical**              | any diagnosis, prescription, dosage                                                                                                                         | never                                                                                                                  |
| **Reflection exception** | the advisor _reflecting_ the user's own "how much should I…" question is **not** advice                                                                     | avoids false positives while keeping the boundary                                                                      |

### 2.2 Anti-fabrication (reject)

| Rule                  | What it blocks                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Allowed-numbers**   | any financial-looking number not in the user's own data (the `allowed_numbers` set)                                        |
| **Citation contract** | a goal-to-goal relationship claim without a real, cited graph edge (and any relationship claim when the user has no edges) |
| **Malformed output**  | non-JSON / unparseable proposals                                                                                           |
| **Empty turn**        | no question and no summary (a useless turn)                                                                                |

### 2.3 Persistence lock (always applied on accept)

- Force `should_persist = false` (the LLM never persists).
- Drop any candidate goal matching a previously **rejected** goal (never resurrect).
- Filter facts to `source == "user_message"` (no fabricated-source facts).
- Keep only relationship citations that are **valid** real edges.

### 2.4 Repairs (accept, but make safe first)

- **Multi-question → first question.** If the proposal asks more than one question, trim to the first and
  accept (don't reject). This salvages good, on-topic turns instead of dropping them to a generic fallback —
  the fix that took the live fallback rate from 17% to 0% without weakening any safety rule.

> Design note (precision over bluntness): gates must avoid false positives that needlessly drop good
> answers. Two carve-outs are part of the model: (a) "connects to your vision/goals" generic language is not
> a graph claim; (b) reflecting the user's own "should I…" wording is not advice. Both are safe because the
> _substantive_ protections (real-edge requirement; no directive advice; allowed-numbers) still apply.

---

## 3. The review pipeline

```
 LLM proposal ─▶ COMPLIANCE (deterministic)
                   │
        ┌──────────┼─────────────┐
     accept      repair         reject
        │          │              │
        │          ▼              ▼
        │   trim to safe     llm_status = fallback:<reason>
        │   form (record     ──▶ deterministic safe text
        │   _repairs)            (Relationship Manager)
        ▼          ▼
   [high-stakes?] ──yes──▶ CRITIC (adversarial, planned)
        │                     │ refute? ──yes──▶ drop claim → safe lower-confidence response
        │ no                  │ no
        ▼                     ▼
   RESPONSE COMPOSER (merge validated text + deterministic outcomes)
        ▼
   AUDIT (log status, validator_result, repairs, fallback_reason, ...)
        ▼
   user
```

**Critic (planned) — when it runs:** only for high-stakes outputs (a decision recommendation, a cross-domain
tradeoff, anything that could be read as advice-adjacent). It runs an independent skeptic pass that tries to
**refute** the claim using the cited evidence; it defaults to "refuted" when uncertain; a majority refute
kills the claim. It judges — it never rewrites. This keeps cost bounded (most turns never invoke it) while
adding a second line of defense exactly where the stakes justify it.

---

## 4. Hallucination prevention — defense in depth

Hallucination is prevented at **five** layers, not one:

1. **Context bounding (prevent).** The LLM only sees a bounded `prompt_dict` — the user's real facts, real
   edges, and allowed numbers. It is told, in the constitution, to use only what's present.
2. **Structured output (constrain).** The LLM must return a fixed JSON schema (reflection, one question,
   candidate facts/goals, citations), not free prose — narrowing the surface for invention.
3. **Compliance gate (detect + block).** The deterministic rules above catch any number/edge/goal/advice
   that slipped through, and reject or repair.
4. **Evidence-or-nothing (starve).** Recommendations/risks/opps can only exist with cited evidence
   (RecommendationOS), so there is no path to a fabricated recommendation.
5. **Critic (refute, planned).** High-stakes claims face an adversarial reviewer before shipping.

If all five somehow failed, the **deterministic fallback** is still a correct, safe response — so the worst
case is "less helpful," never "untrue or unsafe."

---

## 5. The advice boundary (what LifeNavigator will and won't say)

| The advisor MAY                                                                           | The advisor MAY NOT                                      |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| reflect the user's situation in their own numbers                                         | tell the user to buy/sell/invest/borrow a specific thing |
| ask one strong question that surfaces priorities/tradeoffs                                | give a diagnosis, prescription, or dosage                |
| name the inputs needed to reason about a decision                                         | say "for tax purposes you should…" / "legally you must…" |
| explain a deterministic projection (with its trace)                                       | invent a number, goal, risk, or relationship             |
| surface an **evidence-backed** recommendation (from the engine, labeled, with provenance) | present a recommendation as a directive or as certain    |

Domain disclaimers travel with domain output: finance carries "not financial advice"; family/estate carries
"not legal advice"; health never diagnoses. These are part of the domain prompt layer (see
`PROMPT_OPERATING_SYSTEM_PLAN.md`) and reinforced by the Compliance boundary.

---

## 6. Escalation matrix

| Trigger                                | Action                                                                      | User sees                                    |
| -------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| LLM unavailable/unparseable            | `fallback:unavailable`                                                      | deterministic safe text                      |
| Compliance reject                      | `fallback:<reasons>`                                                        | deterministic safe text                      |
| Empty composition                      | `fallback:empty`                                                            | deterministic safe text                      |
| Unhandled error                        | `fallback:error`                                                            | deterministic safe text                      |
| Critic refutes (high-stakes)           | drop the claim                                                              | safe, lower-confidence response + Audit flag |
| Repeated rejects (same user/turn-type) | quality alert to Audit                                                      | (no user impact; ops signal)                 |
| Self-harm / crisis signals (planned)   | safety escalation path: surface supportive resources, never clinical advice | supportive, resource-forward message         |
| Suspected abuse / jailbreak attempt    | refuse + log                                                                | safe refusal                                 |

Every escalation degrades to **safe + truthful**, never to an exception or an unvalidated claim.

---

## 7. Compliance observability (proving the gate works)

Every turn records the compliance outcome so it is measurable, not assumed:

- `validator_result` ∈ {accepted, repaired, rejected, n/a}
- `validator_reason` (why rejected) and `validator_repairs` (what was repaired)
- `fallback_used` + `fallback_reason`
- aggregated into `analytics.advisor_turn_metrics`: **fallback rate** and **validation failure rate**.

This is how we can state, with evidence, that the live fallback rate is 0% and that the safety gates never
had to reject across the evaluation runs — and how a regression (e.g. a prompt change that re-introduces
rejections) is caught immediately.

---

## 8. Governance of the rules themselves

- Compliance rules are **code-reviewed and unit-tested** (the live validator has tests for: rejects invented
  numbers, rejects directive advice, allows reflecting the user's question, allows generic vision language,
  rejects goal-to-goal claims without an edge, drops rejected goals, forces no-persist). LIOS keeps this:
  **no rule changes without a test proving safety is preserved.**
- Loosening a gate to reduce false positives must be **surgical and tested** (as the two carve-outs were),
  never a blanket relaxation.
- The advice/medical/legal/tax boundary is **owned by Compliance**, not by any prompt — a prompt can ask the
  LLM to behave, but the gate is what guarantees it.

---

## 9. Live vs planned

- **Live:** the full accept/repair/reject gate; the advice + anti-fabrication + persistence-lock rules; the
  two precision carve-outs; fallback escalation; compliance telemetry + metrics; the validator test suite.
- **Planned:** the Critic stage for high-stakes turns; an explicit crisis/self-harm escalation path; a
  per-turn record of _which_ evidence/edges a claim cited (for post-hoc audit); a compliance "policy
  version" stamped on each turn alongside the prompt version.
