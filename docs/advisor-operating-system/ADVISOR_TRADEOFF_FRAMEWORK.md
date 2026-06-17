# Advisor Tradeoff Framework

> Design only — no code, no runtime, no prompt change, no beta change. A formal model for _identifying_ and
> _surfacing_ the tensions that make a life decision hard — naturally, as framing, never as a lecture or an
> answer. Inherits every LIOS guardrail (`ADVISOR_OPERATING_SYSTEM.md` §3) and never violates them. Fixes
> gap-report #4/#15 (tradeoffs rarely surfaced). Tradeoff discovery is **step 5 of the reasoning sequence**
> (`ADVISOR_REASONING_FRAMEWORK.md` §2) and the framing layer of `ADVISOR_DECISION_FRAMEWORK.md`.

---

## 1. The rule

> **Name the tension the user is living inside but hasn't articulated — as a framing question, not a verdict.**

The Tradeoff Discovery analysis found the live advisor scores **4/10**: it almost never surfaces competing
priorities proactively, and is weakest exactly where it matters most — **family-vs-career** (divorce → vision
deflection) and **short-term-vs-long-term** (house-in-12-months → "what does 'it' refer to?")
(`docs/advisor-excellence-review/TRADEOFF_DISCOVERY_ANALYSIS.md` §1, §6). The single strength to preserve:
**every tradeoff it does name is grounded — it never invents the conflict** (§2). This framework's job is
"surface more of what's real," not "start making things up."

## 2. The compliance line (the load-bearing distinction)

Two very different acts wear the word "tradeoff." The framework keeps them strictly separate:

| Act                                                                                                                      | Status                               | Why                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Naming a conceptual tension** ("buying now and funding retirement both want the same dollars")                         | **Allowed (framing)**                | a general truth about the _kind_ of decision; not a claim about this user's specific goals |
| **Asserting a link between two of the USER's specific goals** ("_your_ house goal competes with _your_ retirement goal") | **Graph claim — needs a cited edge** | a relational assertion about the user's real priorities (citation contract)                |

This is the citation contract from `GOAL_CONFLICT_AGENT.md` §3: "Cannot assert a goal-to-goal relationship
without a real cited graph edge … no edge ⇒ no conflict claim." Naming the abstract tension is _framing_ and is
permitted even with an empty graph (`ADVISOR_OPERATING_SYSTEM.md` §3: "Framing ≠ advice"; "naming the real
tradeoff … is allowed"). Asserting the user's _specific_ conflict is a graph claim and is forbidden without the
edge. Framing is also never advice — name the tension and the deciding inputs, never "so choose X"
(`ADVISOR_DECISION_FRAMEWORK.md` §4).

## 3. How tradeoff discovery rides on the frameworks

- **Reasoning step 5.** In the eight-step internal pass, tradeoffs are identified _after_ objectives and
  constraints and _before_ missing-info ranking (`ADVISOR_REASONING_FRAMEWORK.md` §2). The table there is
  explicit: "cited edges for goal-to-goal; otherwise conceptual" (§3). So tradeoff discovery is not a separate
  feature — it is one disciplined step of every reasoning pass.
- **Decision framing.** A tradeoff is part 2 of the decision frame ("the central tradeoff"), sitting between
  the real decision and what-decides-it (`ADVISOR_DECISION_FRAMEWORK.md` §3). Each decision type carries a
  canonical tension (cushion vs. commitment, freedom now vs. security later, etc.) (§5).
- **Runtime engine.** The cited, goal-to-goal version is computed by the **Goal Conflict** spec inside the
  merged Discovery Analyst (`GOAL_CONFLICT_AGENT.md` §1) — it cites a real edge with `edge_confidence` and
  evidence, frames the tradeoff (what each goal costs/protects), and **never resolves it** (§6 step 6, §11).

## 4. Honest degradation when there is no graph

The structural trap (`TRADEOFF_DISCOVERY_ANALYSIS.md` §1, §5): fresh users have empty graphs → no edges → the
cited goal-to-goal path is _off_ exactly for the users who most need help with their first hard decision. The
honest degradation ladder:

```
Cited edge exists      → name the user's SPECIFIC tradeoff (Goal Conflict, with edge_confidence + evidence)
User states both sides → reflect the tension back from their OWN words (same-message context)
No edge, no statement  → name the CONCEPTUAL tension as framing ("decisions like this usually pull between…")
                          + ask the question that would reveal whether it applies to THEM
Never                  → fabricate the user's specific conflict, or assert an un-edged goal-to-goal link
```

The key move on an empty graph: **degrade to the conceptual tension, then ask** — do not assert. "Decisions
like this usually pull between X and Y; which one is more alive for you right now?" is compliant framing that
_also_ opens the discovery path toward the eventual cited edge. This converts the structural gap into a
discovery question instead of either silence (today's behavior) or fabrication (the unconstrained-assistant
failure mode in `TRADEOFF_DISCOVERY_ANALYSIS.md` §4).

## 5. The six tradeoff types

For each: the **signals** it is present, **how to surface it naturally** as a framing question, and the
**compliance line** for that axis. Every framing example below is conceptual-tension framing — allowed on an
empty graph; the user's _specific_ version of any of these requires a cited edge (§2).

### 5.1 Time vs money

- **Signals:** overtime/second-job mentions; "I could earn more but…"; burnout language; wanting to "buy back"
  hours; a high-earning path that costs presence. Note: there is no native graph concept for "hours as a good"
  (`TRADEOFF_DISCOVERY_ANALYSIS.md` §3), so this axis is almost always conceptual-only — surface it as framing.
- **Surface naturally:** _"It sounds like there's a quiet tension here between earning more and having more of
  your own time back — when you picture the next year, which one would you regret shorting?"_
- **Compliance:** conceptual framing is fine; you may **not** assert "your income goal competes with your
  family-time goal" without a cited edge.

### 5.2 Family vs career

- **Signals:** relocation/promotion alongside aging parents, kids, or a partner; divorce; caregiving; "the
  job's great but it's far from…". The corpus's most painful miss — divorce drew a vision deflection
  (`TRADEOFF_DISCOVERY_ANALYSIS.md` §3).
- **Surface naturally:** _"A move like this usually asks you to weigh what it does for your career against what
  it costs the people around you — at this moment, which side feels heavier?"_
- **Compliance:** naming the conceptual pull is framing; claiming "_your_ relocation goal conflicts with _your_
  caregiving constraint" needs a real cited family-to-career edge (`GOAL_CONFLICT_AGENT.md` §3).

### 5.3 Certainty vs upside

- **Signals:** a guaranteed offer vs. a bigger "maybe"; safe job vs. startup equity; "the sure thing pays less"
  (`TRADEOFF_DISCOVERY_ANALYSIS.md` §0, §3 — absent in corpus today).
- **Surface naturally:** _"This looks like a choice between a sure, smaller outcome and a larger one that isn't
  guaranteed — if the bigger bet didn't pay off, how would that land for you?"_
- **Compliance:** framing the certainty/upside tension is allowed; quantifying "expected value" or saying "take
  the upside" crosses into advice (`ADVISOR_DECISION_FRAMEWORK.md` §4) and any numbers come from a tool, never
  the advisor's prose.

### 5.4 Short-term vs long-term

- **Signals:** a near-term purchase (house, car) sitting beside retirement/savings goals; "buy now vs. save";
  a horizon clash. The marquee miss — house-in-12-months met "what does 'it' refer to?"
  (`TRADEOFF_DISCOVERY_ANALYSIS.md` §3).
- **Surface naturally:** _"Buying in the next year and the longer-term savings picture both draw on the same
  pool — which horizon are you most worried about getting wrong?"_
- **Compliance:** conceptual horizon framing is fine; asserting "_your_ house goal competes with _your_
  retirement goal" is a graph claim needing a cited `competes_for_resource` edge
  (`GOAL_CONFLICT_AGENT.md` §14 positive 1).

### 5.5 Freedom vs stability

- **Signals:** wanting autonomy/flexibility (go independent, travel, fewer commitments) against security
  (steady income, benefits, a mortgage, dependents); "I want out, but it's safe."
- **Surface naturally:** _"There's often a pull here between freedom to do it your way and the stability you'd
  be giving up — which one would you miss more if it were gone?"_
- **Compliance:** framing only; do not assert the user's specific freedom-goal vs. stability-constraint link
  without a cited edge, and never recommend which to keep.

### 5.6 Present vs future

- **Signals:** spending/enjoying now vs. deferring for a future self; "live a little" vs. "be responsible";
  delayed-gratification fatigue; YOLO language against heavy saving.
- **Surface naturally:** _"Part of this is really about your present self and your future self wanting different
  things — when you imagine yourself in ten years, what would they thank you for doing now?"_
- **Compliance:** conceptual present/future framing is allowed (it's a near-universal tension, not a claim
  about this user's goals); a specific assertion that two of _their_ goals trade present for future needs a
  cited edge.

## 6. The natural-surfacing test (not a lecture)

A tradeoff is surfaced _well_ when it passes all four (mirrors the HIGH-question anatomy,
`QUESTION_QUALITY_ANALYSIS.md` §3):

1. **It's a question, not a statement** — ends in a fork the user answers, not a paragraph they absorb.
2. **It's grounded** — anchored in what the user said (or honestly flagged as a conceptual pattern, §4).
3. **It holds two axes, not one** — the discipline-driven single-axis probe is exactly the gap
   (`TRADEOFF_DISCOVERY_ANALYSIS.md` §5 root cause 3); the framing question names _both_ sides in one turn,
   while still being **one question** (LIOS one-question rule).
4. **It advances the decision** — answering it moves the frame forward (sensitivity move,
   `ADVISOR_DECISION_FRAMEWORK.md` §6), it doesn't reset to zero.

A tradeoff lecture fails 1 and 4; vision-deflection fails all four.

## 7. Invariants

1. Naming a conceptual tension = framing (allowed). Asserting a link between two of the user's specific goals =
   a graph claim needing a cited edge. Never blur the two.
2. Tradeoff discovery runs as step 5 of the reasoning pass and as the central-tradeoff of the decision frame.
3. Never resolve a tradeoff or advise which side to pick — name it and the deciding inputs only.
4. On an empty graph, degrade to the conceptual tension and **ask**; never fabricate the user's specific
   conflict.
5. Surface as one two-sided framing question (the natural-surfacing test), never a single-axis probe or a
   lecture.
6. Any number in a tradeoff frame comes from a tool/the user, never from the advisor's prose.
