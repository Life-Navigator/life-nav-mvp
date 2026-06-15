# Advisor Memory Framework

> **Design only — no code, no runtime change, no prompt change, no beta change.** What the advisor should
> _remember_, _surface_, _ignore_, and let _expire_ — and how memory shapes _what it asks next_. Companion to
> `ADVISOR_CONTEXT_FRAMEWORK.md` (what context to carry + how to use it) and
> `ADVISOR_REASONING_FRAMEWORK.md` (reason before asking). Inherits every LIOS guardrail
> (`ADVISOR_OPERATING_SYSTEM.md` §3) and never violates them.
>
> **Built on:** `docs/lios-agent-specifications/MEMORY_AGENT.md` (the deterministic supplier — the
> `AdvisorContextBuilder`), `docs/lios-prompt-operating-system/base/MEMORY_RULES.md` (Layer-2 contract),
> `TRUTH_AND_PROVENANCE_MODEL.md` (categories, provenance, no-fabrication invariants),
> `FACT_LIFECYCLE.md` (states + freshness windows), and
> `docs/advisor-excellence-review/CONTEXT_RETENTION_ANALYSIS.md` (the "starts over" finding).

---

## 1. Two kinds of memory (keep them distinct)

The Context Retention Analysis proved a split the advisor must honor explicitly
(`CONTEXT_RETENTION_ANALYSIS.md` §1, §3):

|                | **Deterministic memory**                                                             | **Conversational memory**                                                                                    |
| -------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **What**       | persisted goals, vision/north-star, confirmed facts, **rejected goals**, constraints | the **session-stated specifics** — numbers, the named goal, the named decision, the situation just described |
| **Layer**      | durable structured state, read each turn                                             | the `session_thread` projection (`ADVISOR_CONTEXT_FRAMEWORK.md` §2)                                          |
| **Authority**  | **authoritative** — drives framing & suppression                                     | usable _as candidate_ in-session; not persisted until confirmed                                              |
| **Today**      | retained reliably (goals/vision persist; rejected-goal suppression works)            | **lost at the turn boundary** — 0/10 prior-turn numbers reused (§2)                                          |
| **Written by** | approved writers only (RelationshipManager / domain writers)                         | nobody persists it; Memory threads it; an approved writer persists only on confirmation                      |

> The cardinal rule, unchanged: **the LLM never persists.** Deterministic memory is written only by approved
> writers (`TRUTH_AND_PROVENANCE_MODEL.md` §5; `FACT_LIFECYCLE.md` §2 invariant). Conversational memory is
> _threaded into context_, never silently promoted to stored truth (`MEMORY_RULES.md` "Session vs persisted").

## 2. What should be REMEMBERED

Carried in the bounded context every turn (`MEMORY_AGENT.md` §5; `ADVISOR_CONTEXT_FRAMEWORK.md` §2):

- **Confirmed goals, vision, primary objective** — durable, authoritative; the spine of continuity.
- **Rejected goals** — durable; **already suppressed deterministically** and reliably
  (`CONTEXT_RETENTION_ANALYSIS.md` §3). Remember them precisely so they are _never re-raised_
  (`TRUTH_AND_PROVENANCE_MODEL.md` §8 invariant 6).
- **Constraints** — stated limits and risk posture (`safety_constraints`); they bound every option set.
- **Family obligations** — dependents, caregiving, the situation (e.g. a divorce in progress) that shapes
  objectives — today these are dropped and cause vision-deflection (`CONTEXT_RETENTION_ANALYSIS.md` §2, §3).
- **Prior decisions** — decisions made or named, this session (thread) or persisted (durable).
- **Stated preferences** — tone-relevant facts ("I'm a teacher," modest salary) that should shape the
  _framing_, not just sit unused (`CONTEXT_RETENTION_ANALYSIS.md` §2 "Am I on track?" generic reply).
- **Session-stated specifics** — the numbers, named goal, and named decision from earlier this session, as
  classified candidates (the §1 conversational layer; the direct fix for the #1 "intake" tell).

## 3. SURFACE proactively vs on-demand vs IGNORE

| Class                   | Behavior                                                | Examples                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Surface proactively** | bring it into the frame _this turn_ without being asked | the session's just-stated numbers/goal/decision (continuity); a confirmed constraint that bounds the current question; a `stale` critical input (flag it); a rejected goal (to _avoid_ re-raising it)                                   |
| **Surface on-demand**   | hold it; use it only when the topic makes it decisive   | secondary domain facts not relevant to the current decision; lower-priority goals; historical/superseded values (only if asked "what changed?")                                                                                         |
| **Ignore**              | never let it shape output                               | noise and one-off asides; anything **low-provenance** (`advisor_inferred`, weak `inferred`) presented as if it were user truth; anything not in the bounded context ("general knowledge about the user" — forbidden, `MEMORY_RULES.md`) |

Provenance governs surfacing: confirmed > candidate; `advisor_inferred` is **lowest and must never masquerade
as user truth** (`TRUTH_AND_PROVENANCE_MODEL.md` §3). A candidate may be surfaced _as a candidate_, never as
confirmed (`MEMORY_AGENT.md` §13 bucket separation). The advisor surfaces _signal_, not _everything it holds_
— elite recall is selective.

## 4. What EXPIRES (freshness by fact type)

Freshness is a **per-fact-type property** (`FACT_LIFECYCLE.md` §4; `MEMORY_RULES.md` "Freshness"):

| Fact type                                                              | Window                   | Memory behavior                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Volatile** — account balances, prices, "$60k saved" as a live figure | short                    | mark `stale` quickly; usable but **flagged**; prefer prompting a re-sync/re-confirm over presenting as current        |
| **Semi-stable** — income, role, risk posture                           | medium                   | re-confirm on a longer cadence; flag if past window                                                                   |
| **Stable** — number of children, degree held, a named life goal        | effectively non-decaying | persists; no staleness prompt                                                                                         |
| **Rejected goals**                                                     | non-decaying tombstone   | never expire toward resurrection — they stay suppressed forever (`FACT_LIFECYCLE.md` §1 `rejected`)                   |
| **Session specifics**                                                  | this session             | live for the session as candidates; expire at session end unless an approved writer confirmed them into durable truth |

A `stale` fact follows the lifecycle: still usable, but flagged, with a Missing-Data nudge to re-confirm; it
is **never silently treated as fresh** (`FACT_LIFECYCLE.md` §4, §7). Superseded values stay in history, not in
the current frame (`FACT_LIFECYCLE.md` §3). Conflicting confirmed values are surfaced, not auto-picked
(`FACT_LIFECYCLE.md` §7; `MEMORY_AGENT.md` §14 edge case 2).

## 5. How memory shapes QUESTIONING

This is where memory turns intake into counsel — it changes _what the advisor asks next_
(`ADVISOR_REASONING_FRAMEWORK.md` §2 "missing info" → "best next action"):

1. **Don't re-ask what's known.** If a fact/number/goal is in durable memory or the session thread, the
   advisor must not request it again. Re-asking just-given context is the signature "starting over" failure
   (`CONTEXT_RETENTION_ANALYSIS.md` §2, §4).
2. **Ask what's missing AND decisive.** Rank unknowns by value-of-information; ask the single input that
   would most change the answer (`ADVISOR_REASONING_FRAMEWORK.md` step "Missing info"). In the affordability
   case: budget/target-price/debt are missing and decisive — _those_ get asked, not "what does 'it' mean."
3. **Reference prior turns when asking.** Anchor the question in what's already on record so it lands as
   continuity: "Given the house you're targeting next year and the $60k you mentioned, what could you put
   toward housing monthly?" — one question, grounded, no advice (`ADVISOR_CONTEXT_FRAMEWORK.md` §5).
4. **Let rejected goals prune the option set.** Never frame around or re-ask about something the user already
   declined (`TRUTH_AND_PROVENANCE_MODEL.md` §8 invariant 6).
5. **Re-confirm stale, decisive inputs.** If the deciding number is past its freshness window, the "one
   question" may be a re-confirm ("is the $60k still current?") rather than a new ask (§4).

One strong question per turn remains the rule (`ADVISOR_OPERATING_SYSTEM.md` §3); the validator repairs
multi-question. Memory changes _which_ question, not _how many_.

## 6. Worked illustration (memory shaping the question)

**Setup:** durable memory = teacher, modest salary, goal "retire comfortably." User asks **"Am I on track?"**

- **Today:** _"what's your personal definition of 'on track'?"_ — generic; prior context didn't shape the
  question (`CONTEXT_RETENTION_ANALYSIS.md` §2).
- **AOS:** memory surfaces the role + the goal + whatever savings number is on record. The advisor doesn't
  re-ask who they are; it asks the _missing decisive input_ anchored in the known frame: "For a teacher
  aiming to retire comfortably, the thing that most moves the answer is your target retirement age — do you
  have one in mind?" Grounded in remembered specifics, one question, no fabricated track or percentage
  (`TRUTH_AND_PROVENANCE_MODEL.md` §8 invariant 8).

## 7. How this aligns with the LIOS Memory layer

- **Memory supplies; the AOS specifies usage.** The deterministic `AdvisorContextBuilder` remains the sole
  assembler of the bounded context, including the `session_thread` projection (`MEMORY_AGENT.md` §1–§6). This
  framework specifies _what should be in it, what to surface, and how it shapes questioning_ — not a new
  store, not a new writer.
- **Writes go through approved writers only.** Promoting a remembered candidate (e.g. a session-stated
  number) into durable truth happens **only** when an approved writer confirms it
  (`FACT_LIFECYCLE.md` §2 `candidate → confirmed`; `TRUTH_AND_PROVENANCE_MODEL.md` §5). The advisor/LLM only
  _proposes_ (`FACT_LIFECYCLE.md` §6 invariant 1).
- **Every gate still holds.** Allowed-numbers, category separation, citation contract, rejected-goal
  suppression, tenant isolation, no raw rows/secrets — all enforced by Compliance and Memory exactly as today
  (`MEMORY_AGENT.md` §13; `TRUTH_AND_PROVENANCE_MODEL.md` §8). Better memory operates _inside_ the trust
  spine; it never widens it.

## 8. Invariants

1. **Deterministic vs conversational memory stay distinct:** persisted goals/rejected-goals/constraints are
   authoritative; session specifics are candidate-grade, usable in-session, not stored until confirmed.
2. The advisor **never re-asks** what durable memory or the session thread already holds.
3. The advisor asks the **missing, decisive** unknown — ranked by value-of-information — anchored in prior
   turns.
4. **Rejected goals are never resurrected**; the deterministic suppression must keep working.
5. **Freshness is honored by fact type:** volatile facts go `stale` and are flagged; stable facts persist;
   nothing stale is shown as current.
6. **Provenance governs surfacing:** confirmed > candidate; low-provenance/`advisor_inferred` never
   masquerades as user truth; noise and one-off asides are ignored.
7. **The LLM never persists.** Memory is supplied by the deterministic builder; durable writes go only
   through approved writers after confirmation; tenant isolation and no-raw-rows always hold.
