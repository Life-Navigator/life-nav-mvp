# LIOS Runtime Blueprint — Critic Runtime

> **Implementation planning only — no code, no runtime change, no deploy, no Gemini wiring, no beta change.**
> The Critic is an adversarial reviewer that tries to **refute** high-stakes claims from their cited evidence
> before Compliance gates them. **It does not exist today — this whole component is NEW.** This doc decides
> _when_ it runs (the core question), the cost/latency math behind that decision, where it sits in the
> pipeline, its flag, and its judges-never-rewrites contract. Anchored to the live measured baseline in
> `CURRENT_STATE_AUDIT.md` §6 and the pipeline in `docs/lios-execution-architecture/COMPLIANCE_PIPELINE.md`
> (§5, stages [7]→[10]) + `COMPLIANCE_AND_SAFETY_FLOW.md` §3. Paths relative to `apps/lifenavigator-core-api/`.

---

## 1. The decision: (A) every time vs (B) high-stakes only

**Recommendation: (B) — run the Critic ONLY on high-stakes claims.** It is an _extra_ LLM call; running it on
every turn roughly doubles the per-turn LLM cost and adds the full LLM-call latency to a path that is already
~76% LLM time. The trust value of a refutation pass is concentrated where the stakes are (regulated /
decision-recommendation / cross-domain / low-confidence). On a discovery turn that asks one question, there is
no high-stakes claim to refute, so the Critic would add cost and seconds for ~zero safety gain. The
deterministic Compliance gate (`advisor_validator.py:validate`) already runs on _every_ turn and is the
mandatory floor — the Critic is a _second_ line of defense layered exactly where it pays for itself.

This matches the design intent already recorded: `COMPLIANCE_PIPELINE.md` §5 ("high-stakes only, BEFORE
Compliance… Most turns never invoke it") and `ORCHESTRATOR_IMPLEMENTATION_PLAN.md` Phase 8 ("runs only on
high-stakes/regulated/decision-recommendation turns (cost control)").

---

## 2. Cost + latency analysis (measured baseline)

Live baseline per turn (`CURRENT_STATE_AUDIT.md` §6, `beta20-economic-and-chat-blocker` memory):

- **Tokens:** ~3,110/turn (max ~3,800). Model `gemini-2.5-flash`, Fly backend only.
- **Latency:** avg ~9–10s/turn, p95 ~13–16s; `llm_generate` ≈ 76% of the turn.
- **Cost ceiling:** a real ~$4/day Gemini cap + prepay-credit posture (cost is a live constraint, not academic).

The Critic is **one extra LLM call** (claim + cited evidence in, `{verdict, reasons, refutation_confidence}`
out). It is a smaller prompt than the full advisor generate (it judges a single claim against its evidence,
it does not author the whole turn), so model it as **~40–60% of a generate call** ≈ ~1,300–1,900 tokens and
~4–7s added latency when invoked.

|                                  | (A) Every time                                      | (B) High-stakes only (recommended)                               |
| -------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| Critic invocations               | 100% of turns                                       | est. ~10–20% of turns (decision/regulated/cross-domain/low-conf) |
| Added tokens (amortized/turn)    | ~+1,300–1,900 (~+42–61% over 3,110)                 | ~+130–380 (~+4–12%)                                              |
| Added latency (per turn it runs) | +4–7s on **every** turn → ~13–17s avg               | +4–7s only on the ~10–20% high-stakes turns                      |
| Added latency (amortized)        | +4–7s                                               | ~+0.4–1.4s                                                       |
| Daily-cap impact ($4/day)        | ~1.4–1.6× faster cap burn → fewer served turns      | negligible (~+5–12% burn)                                        |
| Trust value                      | high on high-stakes turns, ~zero on discovery turns | full value, concentrated where stakes are                        |
| User-perceived speed             | every turn slower (regression vs today)             | discovery turns unchanged; only high-stakes turns slower         |

**Saving of (B) vs (A):** roughly **a full extra LLM call avoided on ~80–90% of turns** — ~40–55% lower
amortized token/cost overhead and ~4–6s lower amortized added latency, while keeping the Critic's protection
intact on exactly the turns where a bad claim would do real harm. Under a hard $4/day cap, (B) preserves far
more served turns. (A) would make _every_ discovery turn slower and burn the cap ~1.5× faster for no safety
gain on those turns.

---

## 3. Recommended triggers (B) — when the Critic runs

The Critic is invoked **only** when the candidate output carries a high-stakes claim, defined as ANY of:

1. **Decision recommendation** — the turn proposes/ranks an option from a decision or scenario (decision
   pipeline output; `decision_brain.py` / `scenario_compare.py` lineage).
2. **Cross-domain tradeoff** — a claim that reconciles ≥2 domains (e.g. Texas-move job vs house vs family),
   produced by Conflict Resolution.
3. **Advice-adjacent / regulated** — `risk_level == regulated` from Compliance's classification (financial /
   insurance / tax / legal / medical territory), i.e. the boundary `advisor_validator._ADVICE` guards.
4. **Low-confidence high-impact** — an asserting agent's confidence is below threshold on an impactful claim.

If none fire (the common discovery turn — "ask one strong question"), the Critic is **skipped** and the turn
goes straight to Compliance, exactly as today. Trigger evaluation is deterministic and cheap (no LLM).

---

## 4. Where it runs — BEFORE Compliance, judges-never-rewrites

Order is fixed (`COMPLIANCE_PIPELINE.md` §6, stages [7]→[10]):

```
[7] Recommendation Generation
        │
        ▼  high-stakes? (deterministic trigger check, §3)
   yes ─┤                          └─ no ─────────────┐
        ▼                                             │
[8] CRITIC (NEW)  — refute the claim from cited evidence
        │  refuted → DROP the claim  → safe lower-confidence response + Audit flag
        │  real    → claim STANDS (Critic never asserts it; it only lets it pass)
        └────────────────────────┬───────────────────┘
                                 ▼
[9] COMPLIANCE  (advisor_validator.validate — authoritative, runs on EVERYTHING that survives)
                                 ▼
[10] RESPONSE COMPOSER (advisor_orchestrator.py:_compose)
                                 ▼
                               user
```

- **Critic runs first, Compliance still gates whatever survives.** The Critic never overturns or relaxes a
  Compliance verdict; Compliance is downstream and authoritative (see `COMPLIANCE_RUNTIME.md`).
- **It judges/refutes, never rewrites.** It returns `{verdict: real|refuted, reasons[], refutation_confidence}`
  and the Orchestrator acts on it (drop or keep). It does not author replacement text — that would make it a
  second author and break the "one Composer faces the user" invariant.
- **Fail-safe default: `refuted`.** Under uncertainty / unreadable evidence, it refutes (drops the claim). A
  majority-refute kills the claim → safe lower-confidence response. A `real` verdict only lets the claim
  _stand_; it never strengthens or asserts it.

---

## 5. Where it lives · what owns it · what changes · what must NOT

| Concern          | Where today                                                            | What owns it     | What must change for LIOS                                                                                                                | What must NOT change                                               |
| ---------------- | ---------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Critic itself    | — (does not exist)                                                     | —                | **NEW** `critic.py` — adversarial reviewer; one LLM call                                                                                 | n/a (greenfield)                                                   |
| Trigger check    | —                                                                      | —                | **NEW** deterministic high-stakes detector in the Orchestrator (uses Compliance `risk_level`, decision/cross-domain markers, confidence) | must be cheap + deterministic; no LLM                              |
| Invocation point | `advisor_orchestrator.py:_enhance` runs `validate` directly (line 139) | the orchestrator | insert the conditional Critic stage **before** `validate`                                                                                | `validate` still runs on everything that reaches it                |
| On refute        | —                                                                      | —                | Orchestrator drops the claim → safe lower-confidence response + Audit                                                                    | the deterministic floor still answers; never user-visible `failed` |
| Flag             | —                                                                      | —                | **NEW** `CRITIC_ENABLED` (default off) in `config.py:Settings`                                                                           | with flag off, runtime == today exactly                            |
| Telemetry        | `_finish` logs `advisor_turn` (line 223)                               | the orchestrator | add a `critic` event (verdict, refutation_confidence, triggers)                                                                          | non-blocking, metadata-only logs                                   |

---

## 6. Flag + rollout

- **Flag:** `CRITIC_ENABLED` (default **off**). Phase 8 of `ORCHESTRATOR_IMPLEMENTATION_PLAN.md`.
- With the flag off, no Critic call is made and the path is byte-identical to today (Compliance-only).
- **Acceptance (per the plan):** high-stakes claims pass the Critic before Compliance; refuted claims drop to
  a safe lower-confidence response; eval shows trust = 0 violations and the latency/cost delta stays inside
  the per-turn ceiling and the $4/day cap. Re-run `apps/web/advisor-eval.mjs` +
  `apps/web/advisor-decisions-probe.mjs`.

---

## 7. Invariants

1. **NEW component** — the Critic does not exist in the live code; it is built greenfield, flag-gated off.
2. Runs **only** on flagged high-stakes claims (decision-rec · cross-domain · regulated · low-confidence),
   for cost control — most turns never invoke it.
3. Runs **before** Compliance and **never** overturns or relaxes a Compliance verdict.
4. **Judges/refutes; never rewrites, never asserts, never persists.**
5. Fail-safe: defaults to `refuted` under uncertainty; a refute drops the claim to a safe lower-confidence
   response + Audit flag; the deterministic floor still answers (no user-visible `failed`).
6. Cost/latency are first-class: (B) high-stakes-only is chosen specifically to avoid an extra LLM call on
   ~80–90% of turns and to protect the $4/day cap; (A) every-time is rejected.
7. Telemetry for the Critic is non-blocking + metadata-only, consistent with the live `advisor_turn` envelope.

> Bottom line: the Critic is a NEW, flag-gated, high-stakes-only refutation pass placed before the
> authoritative Compliance gate. Running it every time would add a full LLM call's cost/latency to every
> discovery turn for no safety gain there and burn the $4/day cap ~1.5× faster; running it high-stakes-only
> (B) keeps its full protective value exactly where the stakes justify it while leaving the common path as
> fast and cheap as it is today.
