# Advisor Context Framework

> **Design only — no code, no runtime change, no prompt change, no beta change.** How the advisor _uses_
> context so it never "starts over." This is the fix for the #1 "intake" tell: cross-turn amnesia on the
> specifics the user just stated. Inherits every LIOS guardrail (`ADVISOR_OPERATING_SYSTEM.md` §3) and never
> violates them. Companion to `ADVISOR_MEMORY_FRAMEWORK.md` (what to remember) and
> `ADVISOR_REASONING_FRAMEWORK.md` (how to think before speaking).
>
> **Built on:** `docs/lios-agent-specifications/MEMORY_AGENT.md` (the deterministic runtime supplier — the
> `AdvisorContextBuilder`), `docs/lios-prompt-operating-system/base/MEMORY_RULES.md` (Layer-2 prompt
> contract), `TRUTH_AND_PROVENANCE_MODEL.md` (fact categories, provenance, allowed-numbers, citation
> contract), `FACT_LIFECYCLE.md` (states + freshness), and
> `docs/advisor-excellence-review/CONTEXT_RETENTION_ANALYSIS.md` (the "starts over" finding).

---

## 1. The problem this framework fixes

The Context Retention Analysis measured the live advisor: **0/10 decision turns reused a number the user
stated in a prior turn** (`CONTEXT_RETENTION_ANALYSIS.md` §1, §2). The split it names is the whole point:

> **The deterministic spine remembers the STRUCTURE. The conversational layer forgets the SPECIFICS.**

- **Retained (deterministic):** goals, vision/north-star, and rejected-goal suppression — they live in durable
  state the advisor reads each turn (`CONTEXT_RETENTION_ANALYSIS.md` §3).
- **Forgotten (conversational):** "buy a house in the next year," "$120k income," "$60k saved," "I'm a
  teacher," "going through a divorce" — the _session's stated specifics_. The Memory layer builds a **bounded
  context per turn** that does not thread these forward, so they "evaporate at the turn boundary"
  (`CONTEXT_RETENTION_ANALYSIS.md` §4).

Because users feel continuity through the specifics they hear themselves say, the structural memory is
invisible and the amnesia is vivid. **This framework specifies what the bounded context must additionally
carry, and how the advisor must reference it — without touching the trust spine.**

## 2. What context the advisor must have available each turn

The Memory Agent already supplies the durable, classified `bounded_context` envelope
(`MEMORY_AGENT.md` §5): `classified_facts` (confirmed / candidate / assumption, never merged),
`numbers_you_may_reference` (allowed-numbers), `relationship_edges` + `connected_pairs`,
`relationships_available`, `discovery_scores`, `domain_priorities`, `rejected_goals`, `safety_constraints`.
**The AOS extends — never relaxes — this with a `session_thread` block** so the advisor has both the
_skeleton_ (durable) and the _flesh of this conversation_ (session specifics):

| Bucket                        | What it carries                                                                                                                   | Source / layer                              | Provenance bound                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| **Goals & vision**            | confirmed goals, primary objective, north-star                                                                                    | durable (Memory)                            | `user_stated`/`user_confirmed`                                      |
| **Rejected goals**            | goals the user declined                                                                                                           | durable (Memory)                            | `user_rejected` — never resurrected                                 |
| **Family & obligations**      | dependents, family situation, caregiving duties                                                                                   | confirmed facts (Memory)                    | `user_confirmed`/`on_record`                                        |
| **Career**                    | role, employer, work situation ("I'm a teacher")                                                                                  | confirmed facts (Memory)                    | `user_stated`/`on_record`                                           |
| **Finances**                  | income, savings, balances, the user's own numbers                                                                                 | confirmed/candidate facts + allowed-numbers | per category; balances flagged `stale` per §6                       |
| **Constraints & preferences** | stated limits, risk posture, tone-relevant facts                                                                                  | `safety_constraints` + facts (Memory)       | confirmed/candidate                                                 |
| **Relationships**             | real cited edges + connected pairs                                                                                                | GraphRAG via Memory                         | real edge only; cite the pair                                       |
| **Prior decisions**           | decisions named/made this session or persisted                                                                                    | `session_thread` + durable                  | per category                                                        |
| **Session thread (NEW)**      | the _specifics the user stated this session_ — numbers, named goal, named decision, situation — classified as candidate/confirmed | conversational, threaded by Memory          | candidate unless confirmed; numbers join allowed-numbers in-session |

**The `session_thread` is the fix.** It is the bounded, classified projection of what the user said earlier
_this session_ — not the raw transcript, not "general knowledge about the user." It is still produced by the
deterministic Memory layer (the runtime supplier), still tenant-scoped, still redacted of raw rows/secrets,
still bucketed by category. The AOS only _specifies that it must exist and what it must contain_; the LLM
never assembles or persists it (`MEMORY_AGENT.md` §3; `MEMORY_RULES.md` "Session vs persisted memory").

> What the session thread is **not**: it is not promotion of candidates to confirmed. An in-session stated
> number is a **candidate** that is _usable this turn_ and joins `allowed_numbers` for the session
> (`TRUTH_AND_PROVENANCE_MODEL.md` §3; `FACT_LIFECYCLE.md` §1 `validated`/`candidate`). It becomes persisted
> truth only when an approved writer confirms it. Threading ≠ persisting.

## 3. How the advisor should reference context

Continuity is _felt_, not declared. The advisor uses context the way an elite advisor who took notes would:

1. **Reflect prior specifics in the user's own numbers/words.** "With the $60k you mentioned and the house
   you're aiming for next year…" — this is the grounded frame of `ADVISOR_REASONING_FRAMEWORK.md` §4,
   extended to _cross-turn_ specifics, not just same-message ones.
2. **Acknowledge continuity, don't announce memory.** Build on the last answer ("so the cushion question
   we were circling…") rather than re-asking. Never say "as you told me earlier" mechanically; weave it in.
3. **Never re-ask what's on record.** If a specific is in the durable buckets or the session thread, the
   advisor must not request it again. Re-asking just-given information is the marquee "starting over" failure
   (`CONTEXT_RETENTION_ANALYSIS.md` §2). Ask instead for the _missing decisive input_ (see §5 of
   `ADVISOR_MEMORY_FRAMEWORK.md`).
4. **Honor the rejected list and the north-star without over-using them.** Rejected-goal suppression is real
   memory and should keep working; vision is durable but must not become a deflection
   (`CONTEXT_RETENTION_ANALYSIS.md` §3 vision-over-use note).

## 4. The rules (inherited, non-negotiable)

The advisor may use context **only** within the LIOS trust spine (`TRUTH_AND_PROVENANCE_MODEL.md` §8;
`MEMORY_RULES.md`):

- **Only confirmed/candidate per provenance.** Confirmed facts may drive framing; candidates (incl. session
  specifics) may be referenced _as candidates_, never as confirmed truth. Categories never merge
  (`TRUTH_AND_PROVENANCE_MODEL.md` §2; `MEMORY_AGENT.md` §3).
- **Allowed-numbers is the whitelist.** A financial number may appear only if it's the user's own and in
  `numbers_you_may_reference`. The advisor **reflects** the user's numbers; it **never computes** new ones in
  conversational text (`TRUTH_AND_PROVENANCE_MODEL.md` §7).
- **Cited relationships only.** A goal-to-goal link may be asserted only with a real cited edge in
  `relationship_edges`; if `relationships_available` is false, no relationship may be claimed
  (`TRUTH_AND_PROVENANCE_MODEL.md` §6; `MEMORY_AGENT.md` §8).
- **Never invent.** No fact, number, edge, goal, or "north star" that isn't in the bounded context. If it's
  not there, it's missing — ask or mark missing (`MEMORY_RULES.md` "Hard rules").
- **Bounded, read-only, redacted, tenant-scoped.** No raw rows, no secrets, no cross-tenant data; the LLM
  never persists — writes go through approved writers (`MEMORY_AGENT.md` §3, §13).
- **Freshness respected.** A `stale` fact is usable but must be flagged with a preference to re-confirm
  (`MEMORY_RULES.md` "Freshness"; `FACT_LIFECYCLE.md` §4) — detailed in `ADVISOR_MEMORY_FRAMEWORK.md` §4.

## 5. Before / after — the real "Can I afford it?" failure

The marquee live failure (`CONTEXT_RETENTION_ANALYSIS.md` §2; `ADVISOR_REASONING_FRAMEWORK.md` §5):

**Setup (prior turns this session):** user said "buying a house in the next year," "$120k income,"
"$60k saved." Then asks: **"Can I afford it?"**

- **Today (intake / starts over):** _"Understanding what 'it' refers to will help us identify your primary
  objective."_ — the advisor asked the user to re-explain a thing stated one turn earlier. The bounded
  context didn't thread the session specifics, so they weren't present to shape the reply
  (`CONTEXT_RETENTION_ANALYSIS.md` §2, §4).

- **AOS (carries it forward):** the `session_thread` block now holds: candidate goal _"buy a house within a
  year,"_ candidate numbers _$120k income / $60k saved_ (in allowed-numbers for the session), decision in
  play _"affordability."_ The advisor reflects these and asks the one decisive missing input:

  > "With the $60k you've saved against the house you're targeting in the next year, the real question is how
  > much of that $60k goes to the down payment versus staying as a cushion — and that turns on your monthly
  > budget. Roughly what could you comfortably put toward housing each month?"

  Grounded frame using the **user's own** numbers (reflected, not computed), the named goal carried forward,
  continuity acknowledged, one sharp question, no advice, no fabricated figure — fully Compliance-gated.

The only change between the two is that the session's stated specifics are **present in the bounded context**
and the advisor is **required to reference them**. No guardrail moved.

## 6. Alignment with the LIOS Memory layer

This framework is a **specification of what the runtime must carry and how the advisor must use it** — the
runtime _supplier_ is the deterministic Memory Agent (`AdvisorContextBuilder`), and that ownership is
unchanged (`MEMORY_AGENT.md` §1–§3):

- **Memory owns assembly; the AOS owns usage.** Memory assembles the bounded, classified, tenant-scoped
  context (now including the `session_thread` projection). The AOS specifies _that the thread exists, what it
  contains, and how the advisor references it_. The advisor still "reasons only from the bounded context"
  (`MEMORY_RULES.md`).
- **No new capability outside the guardrails.** The session thread is built by deterministic classification
  (candidate vs confirmed), redacted, bucketed, and allowed-numbers-bound — exactly the existing Memory
  contract, extended in _scope of recall_, not in _trust_.
- **Same downstream gates.** Every advisor turn still passes Compliance against the same `allowed_numbers`
  and `relationship_edges`; the richer context cannot smuggle a non-allowed number or an uncited edge
  (`MEMORY_AGENT.md` §13; `TRUTH_AND_PROVENANCE_MODEL.md` §8).

## 7. Invariants

1. Every turn, the advisor has both **durable** context (goals/vision/rejected/family/career/finances) and
   the **session thread** (this session's stated specifics) — bounded, classified, tenant-scoped.
2. The advisor **reflects prior specifics** (numbers/named goal/named decision) and **never re-asks** what's
   on record or in the thread.
3. Categories stay separate; candidates (incl. session specifics) are referenced as candidates, never as
   confirmed.
4. Only the user's own numbers (allowed-numbers) are referenced; the advisor reflects, never computes.
5. Relationships are claimed only with a real cited edge; otherwise the advisor abstains.
6. Nothing is invented; stale facts are flagged, not presented as current.
7. The LLM never assembles or persists context — Memory supplies it; approved writers persist.
