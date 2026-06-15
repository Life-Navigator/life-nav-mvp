# LIOS Compliance Pipeline (execution model)

> **Design/spec only — no code, no Gemini wiring, no runtime, no Vertex, no beta.** This describes the review
> pipeline as an execution model: when each reviewer runs, in what order, how the repair loop is bounded, and
> how outcomes tie into the execution state machine. Derived from
> `docs/lios-execution-architecture/EXECUTION_ARCHITECTURE.md` (stages [7]–[10]),
> `docs/lios-execution-architecture/EXECUTION_STATE_MACHINE.md`, `COMPLIANCE_AND_SAFETY_FLOW.md`,
> `docs/lios-agent-specifications/COMPLIANCE_AGENT.md`, `docs/lios-agent-specifications/CRITIC_AGENT.md`,
> `docs/lios-agent-specifications/RESPONSE_COMPOSER_AGENT.md`, and
> `docs/lios-prompt-operating-system/schemas/COMPLIANCE_OUTPUT_SCHEMA.md`.

---

## 1. The one rule everything else serves

**Compliance is mandatory and unbypassable before any user-facing text.** Every LLM-authored output is routed
through Compliance, and only the Response Composer (post-verdict) produces text the user sees. No raw agent
output ever reaches the user. On any failure the deterministic floor (Relationship Manager turn, stage [0])
guarantees a safe, truthful response. This generalizes the live advisor path
(`advisor_validator.validate → accept/repair/reject → fallback`) to all domains.

---

## 2. Two-tier review model (deterministic wins)

Compliance is **two tiers**, and the deterministic tier is authoritative:

```
        ┌──────────────────────────────────────────────────────────┐
        │  TIER 1 — DETERMINISTIC GATE  (authoritative)             │
        │  the live advisor_validator rules: advice/medical/legal/  │
        │  tax boundary · allowed-numbers · citation contract ·     │
        │  persistence lock · single-question repair · malformed/   │
        │  empty reject. Pure functions, no LLM, no IO.             │
        └──────────────────────────────────────────────────────────┘
                              ▲  (final verdict)
                              │  deterministic hard-rule ALWAYS overrides
        ┌──────────────────────────────────────────────────────────┐
        │  TIER 2 — LLM-ASSISTED REVIEW  (optional, augments)       │
        │  may surface extra unsupported/unsafe claims, caveats,    │
        │  sensitive-data flags the rules didn't enumerate.         │
        │  It can only make the verdict STRICTER, never looser.     │
        └──────────────────────────────────────────────────────────┘
```

- The deterministic gate is the trust floor. If it says `reject/blocked`, no LLM-assisted review can rescue
  the output. The LLM tier **augments, never replaces** — it can escalate (approve → require_repair, or
  require_repair → blocked) but can never downgrade a hard-rule failure to approved.
- On any disagreement, the **deterministic verdict wins**. Tier 2 is advisory; Tier 1 is law.

---

## 3. Status vocabulary (and how the two map)

The compliance contract (`COMPLIANCE_OUTPUT_SCHEMA.md`, Layer 8) emits four statuses; the live validator
spec uses three verdicts. They map one-to-one:

| Schema status (Layer 8) | Validator verdict   | Meaning                                     | Next                                       |
| ----------------------- | ------------------- | ------------------------------------------- | ------------------------------------------ |
| `approved`              | `accept`            | safe + grounded                             | → Response Composer                        |
| `approved_with_caveats` | `accept` (+caveats) | safe; required caveats attached             | → Response Composer (caveats travel along) |
| `require_repair`        | `repair`            | salvageable; deterministic fix or re-author | → repair loop (see §6)                     |
| `blocked`               | `reject`            | hard violation; unrepairable                | → deterministic fallback + Audit flag      |

`risk_level ∈ {low, medium, high, regulated}` is set on every verdict; `regulated` (financial / insurance /
tax / legal / medical) is what _gates whether the Critic ran_ (§5) and forces caveats on approval.

---

## 4. When Compliance runs — ALWAYS, and LAST before the user

Compliance runs **after every LLM-authored output, before the Composer, every time** — no intent, domain, or
confidence level exempts it. It is the last reviewer before rendering. There is no path from an LLM agent to
the Composer that skips Compliance.

---

## 5. When the Critic runs — high-stakes only, BEFORE Compliance

The Critic (planned, adversarial, judges-never-rewrites) is invoked **conditionally and before Compliance**,
for cost control. It runs only when a claim is flagged high-stakes:

- a **decision recommendation**, or
- a **cross-domain tradeoff**, or
- an **advice-adjacent / regulated** claim, or
- a **low-confidence** high-impact claim.

The Critic tries to _refute_ the claim from its cited evidence and **defaults to `refuted` under
uncertainty**; a majority-refute kills the claim (→ safe lower-confidence response + Audit). A `real` verdict
only lets the claim _stand_ — it never asserts the claim. The Critic never overturns or relaxes a Compliance
verdict (it runs first; Compliance still gates whatever survives). Most turns never invoke it.

---

## 6. Order of operations (stages [7]→[10])

```
[5] Agent Execution ─▶ [6] Conflict Resolution ─▶ [7] Recommendation Generation
                                                          │
                                                          ▼
                                          high-stakes / regulated / decision-rec /
                                          low-confidence claim?
                                            │ yes                      │ no
                                            ▼                          │
                                   [8] CRITIC (refute?)                │
                                       │ refuted → drop claim          │
                                       │ real    → claim stands        │
                                       └────────────┬──────────────────┘
                                                    ▼
                                   [9] COMPLIANCE  (deterministic gate, then optional LLM tier)
                                            │
                 ┌──────────────┬───────────┼───────────────┬──────────────────┐
            approved      approved_       require_repair    blocked
                 │        with_caveats         │                │
                 │            │           ┌────┘                ▼
                 │            │           ▼              deterministic fallback
                 │            │     REPAIR LOOP (§7)     (stage [0] floor) + Audit
                 │            │     bounded by cap N
                 └────────────┴───────────┬─────────────────────┘
                                          ▼  (validated content only)
                              [10] RESPONSE COMPOSER  (renders; adds no claim)
                                          ▼
                                        user
                                          ▲
                       Audit / Observability runs in parallel at every stage
```

Critic → Compliance is the fixed order: the Critic removes indefensible high-stakes claims **first**, then
Compliance gates whatever survived. The Composer is reached only with `approved`/`approved_with_caveats`
content.

---

## 7. The repair loop (bounded; deterministic vs. agent re-author)

`status = require_repair` does not reach the user and does not silently fail. Two repair kinds exist:

1. **Deterministic repair (in-gate, no loop):** the gate itself fixes safe-but-over-broad output — trim a
   second question to the first, filter facts to `source=user_message`, drop a rejected-matching goal, force
   `should_persist=false`. These are content-preserving and applied _inside_ Compliance; they yield `approved`
   /`repair` immediately and consume **no** loop attempt. (This is the fix that took the live fallback rate
   from 17% → 0% without weakening any rule.)

2. **Agent re-author (the loop):** when the violation needs new content the gate cannot synthesize (e.g. an
   unsupported claim that must be re-grounded), Compliance returns `require_repair` with precise, actionable
   `repair_instructions`. The **Orchestrator** — never agent-to-agent — routes those instructions back to the
   originating agent, which re-runs and re-submits for re-review.

**Maximum repair attempts: N = 2.** After the second failed re-review, the loop is exhausted → deterministic
fallback (`fallback:repair_exhausted`) + Audit flag. The cap guarantees termination (the call graph stays
acyclic and bounded).

```
                    ┌──────────────────────────────────────────────┐
                    │              REPAIR LOOP STATE                │
                    ▼                                               │
            ┌───────────────┐  require_repair (attempt n)          │
   ──────▶  │  RE-REVIEW    │ ───────────────────────────┐         │
   author   │ (Compliance)  │                            │         │
            └───────────────┘                            ▼         │
                 │   │                          ┌──────────────────┴───┐
       approved /│   │ blocked                  │  n < N (=2) ?         │
  approved_w_cav │   │                          │   yes → re-author     │
                 ▼   ▼                          │   no  → fallback      │
        ┌───────────────────┐                   └──────────┬───────────┘
        │ → Response Composer│                              │
        └───────────────────┘                              ▼
                                              ┌────────────────────────────┐
        blocked ──────────────────────────▶  │ deterministic fallback      │
                                              │ (stage [0] floor) + Audit   │
                                              └────────────────────────────┘

   attempt counter: starts 0; each agent re-author increments; n == N exhausts the loop.
   deterministic in-gate repairs do NOT increment n.
```

---

## 8. Blocking conditions (→ deterministic fallback, no repair)

These are hard violations: `status = blocked` / verdict `reject`, served the deterministic floor immediately,
never looped:

- a **regulated directive** — "you should buy/sell/invest/borrow…", a diagnosis/prescription/dosage, "for tax
  purposes you should…", "legally you must…";
- an **unsupported or unsafe claim** that cannot be re-grounded — a financial-looking number not in
  `allowed_numbers`, a goal-to-goal relationship with no real cited edge;
- a **contradiction with truth** — output that conflicts with the user's own data / the deterministic outcome;
- **malformed or empty** output (non-JSON, no question and no summary);
- **sensitive-data / cross-tenant** exposure flags.

Reflecting the user's own "how much should I…?" wording is **not** advice (carve-out); "connects to your
vision/goals" generic phrasing is **not** a graph claim (carve-out). Both carve-outs are safe because the
substantive protections still apply.

---

## 9. Escalation paths

| Trigger                                | Action                      | User sees                                    |
| -------------------------------------- | --------------------------- | -------------------------------------------- |
| LLM unavailable / unparseable          | `fallback:unavailable`      | deterministic safe text                      |
| Compliance `blocked` / `reject`        | `fallback:<reasons>`        | deterministic safe text                      |
| Repair loop exhausted (n == N)         | `fallback:repair_exhausted` | deterministic safe text                      |
| Critic refutes a high-stakes claim     | drop the claim              | safe, lower-confidence response + Audit flag |
| Empty composition                      | `fallback:empty`            | deterministic safe text                      |
| Unhandled error                        | `fallback:error`            | deterministic safe text                      |
| Repeated rejects (same user/turn-type) | quality alert to Audit      | (no user impact; ops signal)                 |
| Suspected jailbreak / abuse            | refuse + log                | safe refusal                                 |

Every escalation degrades to **safe + truthful**, never an exception or an unvalidated claim.

---

## 10. Tie-in to the execution state machine

Compliance and the repair loop are stages [8]+[9]; their results drive the per-agent and turn-level states in
`EXECUTION_STATE_MACHINE.md`:

| Compliance outcome           | Originating agent execution state                      | Turn-level effect                                  |
| ---------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `approved` / `_with_caveats` | `completed`                                            | content flows to [10]; turn → `completed_governed` |
| `require_repair` (n < N)     | back to `running` (re-author)                          | loop continues; turn pending                       |
| `require_repair` (n == N)    | `completed` (content dropped)                          | turn → `fallback_safe`                             |
| `blocked` / `reject`         | `compliance_rejected` → `completed`, content discarded | turn → `fallback_safe`                             |

`compliance_rejected` is an _outcome_; the agent's _execution_ still resolves to `completed` (its content is
discarded). A turn **never** ends in user-visible `failed`: the deterministic floor guarantees `fallback_safe`.

---

## 11. Stage [8]+[9] contract

| Aspect            | [8] Critic (conditional)                       | [9] Compliance (mandatory)                                                                     |
| ----------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs            | flagged high-stakes claim + its cited evidence | candidate output (post-Critic) + bounded context (allowed_numbers, real edges, rejected goals) |
| Outputs           | `{verdict: real                                | refuted, reasons[], refutation_confidence}`                                                    | `{status, risk_level, issues[], required_caveats[], unsupported_claims[], unsafe_claims[], sensitive_data_flags[], repair_instructions, confidence}` |
| Determinism       | LLM-assisted, fail-safe default `refuted`      | Tier 1 deterministic (authoritative) + optional Tier 2 LLM (augments only)                     |
| Failure state     | unreadable evidence → `refuted` (fail safe)    | always returns a verdict; never throws; under uncertainty fails toward repair/blocked          |
| On adverse result | drop claim → safe lower-confidence response    | `require_repair` → loop (cap N=2); `blocked` → deterministic fallback                          |
| Observability     | `critic` event                                 | `compliance` event (status, reasons, repairs, fallback_reason)                                 |

---

## 12. Invariants

1. Compliance runs after every LLM-authored output, before the Composer, always — unbypassable.
2. The deterministic gate is authoritative; the LLM-assisted tier augments and may only tighten, never loosen.
3. The Critic runs only on flagged high-stakes claims, before Compliance, and never overturns its verdict.
4. The repair loop is bounded at N = 2 agent re-authors (in-gate deterministic repairs don't count); exceeding → fallback. The call graph stays acyclic.
5. Repair routing goes through the Orchestrator (agents never call each other); only the originating agent re-authors.
6. Blocking conditions (regulated directive · unsupported/unsafe claim · contradiction with truth · malformed/empty · sensitive-data) → immediate deterministic fallback, no loop.
7. No turn ends in user-visible `failed`; every degraded path lands on `fallback_safe`.
8. No rule is ever weakened to make output pass; loosening a gate must be surgical and tested.
