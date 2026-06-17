# LIOS — Agent Escalation Model

> When and how an agent hands work to another agent, blocks, requests confirmation, or requests more data.
> Specification only — no code, no prompts, no runtime. Pairs with `AGENT_FAILURE_BEHAVIOR.md` and
> `AGENT_INTERACTION_CONTRACTS.md`.

---

## 1. The four "I can't finish this alone" moves

| Move                     | State                | When                                                                      |
| ------------------------ | -------------------- | ------------------------------------------------------------------------- |
| **Escalate**             | `escalated`          | the work (or part of it) belongs to another agent's ownership             |
| **Block**                | `blocked`            | a precondition/tool failed; cannot proceed safely                         |
| **Request confirmation** | `needs_confirmation` | the agent has a candidate that the user must confirm before use/persist   |
| **Request data**         | `needs_data`         | required inputs are missing; the agent names them (ranked), never guesses |

---

## 2. Escalation is always _through the Orchestrator_

No agent calls another agent directly. An agent that needs another agent returns `status: escalated` with an
`escalation` object; the **Orchestrator** performs the routing. This keeps the call graph acyclic and
observable.

```json
"escalation": {
  "to": "decision_scientist",
  "reason": "cross-domain tradeoff between home purchase and retirement",
  "payload": { "...": "the bounded context the target needs" },
  "blocking": true
}
```

`blocking: true` means the current agent cannot complete without the escalation's result;
`blocking: false` is an advisory referral the Orchestrator may parallelize.

---

## 3. Canonical escalation routes (ownership-driven)

Escalation follows ownership (see each agent's spec §2). Representative routes:

| From                     | Trigger                        | → To                     |
| ------------------------ | ------------------------------ | ------------------------ |
| Domain agent (Finance/…) | cross-domain conflict/tradeoff | Decision Scientist       |
| Decision Scientist       | needs option modeling          | Scenario Agent           |
| Scenario Agent           | needs option comparison        | Tradeoff Agent           |
| Tradeoff Agent           | a concrete action emerges      | Recommendation Agent     |
| Recommendation Agent     | high-stakes claim              | Critic                   |
| Critic                   | output ready for the gate      | Compliance               |
| Compliance               | accepted                       | Response Composer        |
| Any agent                | needs facts/edges              | Memory / GraphRAG (read) |
| Any agent                | needs a calculation            | Tool Execution           |
| Advisor / domain         | highest-value gap unclear      | Missing Data             |
| Onboarding               | goal expressed                 | Goal Discovery           |
| Goal Discovery           | goals may conflict             | Goal Conflict            |

> These are _referrals expressed as `escalated` outcomes_; the Orchestrator sequences them. The pipeline
> order (…→ Recommendation → Critic → Compliance → Response Composer) is the Orchestrator's, not a chain of
> direct calls.

---

## 4. Escalation guards (must hold)

1. **Ownership-justified.** An agent escalates only work outside its ownership; it does not offload work it
   owns.
2. **No self-escalation.** An agent never escalates to itself.
3. **No cycles.** The escalation graph is a DAG; the Orchestrator rejects a route that would form a cycle.
4. **Bounded payload.** Escalation passes only the typed, bounded context the target needs — never raw DB
   rows, never secrets.
5. **Confidence-aware.** An agent that _could_ answer at medium confidence prefers `needs_data` /
   `needs_confirmation` over escalation; escalation is for _ownership_, not for "I'm unsure."
6. **Terminates.** Every escalation chain ends at a terminal agent (Response Composer or a safe fallback)
   within a bounded number of hops; the Orchestrator caps hop count.

---

## 5. Block vs escalate vs needs_data (disambiguation)

- **blocked** = "I cannot run" (tool down, precondition false). Safe stop → deterministic fallback.
- **escalated** = "someone else owns this." Hand off.
- **needs_data** = "I could run, but inputs are missing." Ask (Missing Data / Advisor).
- **needs_confirmation** = "I have a candidate, but the user must confirm before it's truth/persisted."

When more than one could apply, prefer the one that keeps the user moving with the least friction:
`needs_data`/`needs_confirmation` (ask one thing) over `escalated` (hand off) over `blocked` (stop).

---

## 6. Escalation observability

Every escalation is logged on the turn (from, to, reason, blocking, hop index). This makes "why did this
turn involve five agents?" answerable and lets us detect routing pathologies (long chains, near-cycles,
hot escalation targets).

---

## 7. Invariants

1. Escalation is via the Orchestrator only; agents never call each other directly.
2. The escalation graph is acyclic and hop-bounded.
3. No self-escalation; no bypassing the Orchestrator.
4. Escalation is ownership-driven, not uncertainty-driven (uncertainty → needs_data/confirmation).
5. Every chain terminates at Response Composer or a safe fallback.
6. Every escalation is logged.
