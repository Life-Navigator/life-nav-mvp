# Advisor Discovery Framework

> Design only — no code, no runtime, no prompt change, no beta change. How the advisor turns discovery from
> _question collection_ into _advisor-led discovery_. Inherits every LIOS guardrail
> (`ADVISOR_OPERATING_SYSTEM.md` §3) and never violates them. Fixes gap-report #3/#14/#24 (surveys instead of
> uncovering; loses context; generic-vision deflection). Pairs with `ADVISOR_REASONING_FRAMEWORK.md`
> (discovery is _step 6_ of the reasoning sequence) and `ADVISOR_TRADEOFF_FRAMEWORK.md`.

---

## 1. The rule

> **Discovery uncovers; it never surveys.** The advisor never asks for a fact it has no reason to want yet.
> Every discovery question is the visible tip of a full internal reasoning pass — never a bare intake field.

The Question Quality analysis found ~30–35% of decision turns are **LOW** — generic vision-deflection or
formulaic intake that _outsources the thinking back to the user_
(`docs/advisor-excellence-review/QUESTION_QUALITY_ANALYSIS.md` §2, §4). Discovery, done as a survey, _is_ that
failure. This framework replaces survey-discovery with advisor-led discovery: reason about the
highest-value gap, ask one sharp question that **also advances understanding**, integrate the answer, repeat.

## 2. What discovery uncovers (the six objects — not a checklist)

Discovery is not a form with six sections; it is the advisor _coming to understand a person_. These are the
objects a great advisor ends up holding — surfaced opportunistically, never marched through:

| Object            | What it is                                          | Where it lands in LIOS                                                                 |
| ----------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Goals**         | what the user is trying to achieve, in their words  | Goal Discovery candidate (`docs/lios-agent-specifications/GOAL_DISCOVERY_AGENT.md` §5) |
| **Motivations**   | the _why_ beneath the goal (the real objective)     | reasoning step 3 "Objectives" (`ADVISOR_REASONING_FRAMEWORK.md` §2)                    |
| **Constraints**   | what limits the options (stated/on-record only)     | reasoning step 4 "Constraints"                                                         |
| **Fears**         | what the user is protecting against / worried about | colors the frame; never asserted as fact                                               |
| **Opportunities** | a possibility the user hasn't named yet             | framing only; never a fabricated claim                                                 |
| **Tradeoffs**     | tensions among the above                            | `ADVISOR_TRADEOFF_FRAMEWORK.md`; goal-to-goal needs a cited edge                       |

> The art is that **one good question can uncover several of these at once.** "If you bought in the next year,
> how much cash would you want left over before you'd feel uneasy?" surfaces a constraint (liquidity floor), a
> fear (running dry), and a tradeoff (cushion vs. down payment) in a single turn — the opposite of a survey,
> which would ask for each separately. (Real HIGH example, `QUESTION_QUALITY_ANALYSIS.md` §2/§3.)

## 3. The discovery loop

Discovery is a loop, not a queue. It rides entirely on the reasoning framework — it has no independent
"ask the next field" path.

```
Reason about the highest-value gap   (what, if known, would most change the guidance?)   ← Missing Data
   ↓
Ask ONE sharp question                (that ALSO advances the user's own understanding)   ← Question craft
   ↓
Integrate                             (update goals/constraints/fears; carry it forward)   ← Context/Memory
   ↓
Repeat                                (re-rank gaps with the new knowledge)
```

- **Reason** — the advisor runs the eight-step internal pass; discovery is steps 3–6 of it (objectives,
  constraints, tradeoffs, missing info) (`ADVISOR_REASONING_FRAMEWORK.md` §2). The output of step 6 — the
  ranked decisive unknowns — is what discovery draws from.
- **Ask one** — one strong question per turn (LIOS guardrail; `ADVISOR_OPERATING_SYSTEM.md` §3). The question
  must do _double duty_: get the input **and** give the user insight (the HIGH property,
  `QUESTION_QUALITY_ANALYSIS.md` §3).
- **Integrate** — the answer becomes carried context, not a one-shot read; cross-turn loss (0/10 prior-turn
  numbers reused, `QUESTION_QUALITY_ANALYSIS.md` §4) is exactly the failure that manufactures the uncertainty
  that triggers deflection.
- **Repeat** — re-rank; the next question is whatever is now most decisive, not the next slot in a form.

## 4. Value-of-information ranking (what to ask next)

The order of discovery is **value of information**, never convenience or form-order. This ties directly to the
Missing Data Agent, whose entire job is "tell the system the single most valuable thing it does not know yet"
ranked by impact on guidance (`docs/lios-agent-specifications/MISSING_DATA_AGENT.md` §1, §6 steps 4–5).

```
ranked unknowns (Missing Data: rank + why_it_matters)
   → advisor picks rank #1 that it is ALLOWED to ask and that a single sharp question can reach
   → frames it as the one question for this turn
```

- Missing Data **ranks and explains** (`why_it_matters`); it never phrases the user-facing question — that is
  the Advisor's job (`MISSING_DATA_AGENT.md` §3, §11). The Discovery Framework is the _consumer_ of that
  ranking.
- The advisor asks the **most decisive** unknown, not the easiest — this is the "sensitivity" move shared with
  the decision framework (`ADVISOR_DECISION_FRAMEWORK.md` §6): lead with what would change the answer.
- A gap that maps to an extracted-but-unconfirmed value is _confirmed_, not re-asked (`MISSING_DATA_AGENT.md`
  §14 edge 4) — re-asking a known fact is survey behavior.

## 5. The anti-pattern to kill: generic-vision deflection under low confidence

> **Diagnosed default failure:** the advisor falls back to a generic vision question — _"what does a truly
> successful and fulfilling life look like to you?"_ — _whenever it lacks confident context_
> (`QUESTION_QUALITY_ANALYSIS.md` §5). It is "the verbal equivalent of a shrug dressed as depth," and it
> misfires worst on emotional, high-stakes turns (divorce → "what would need to be true for you to feel truly
> successful?") (§5).

The kill rule:

> **Low context-confidence is the trigger to get _specific and grounded_, not abstract.** When the advisor is
> unsure, it must anchor to whatever concrete thing the user _did_ say and ask the sharpest grounded question
> that thing supports — never retreat to a vision abstraction.

| Confidence state                 | Survey reflex (kill)                          | Advisor-led replacement                                                       |
| -------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| High (numbers in-message)        | OK-ish, but flat intake field                 | mirror their numbers + ask the decisive fork                                  |
| **Low** (ambiguous/lost context) | **vision-deflection** ("what's your vision?") | anchor to the one concrete detail given; ask a specific question about _that_ |
| Emotional / high-stakes          | vision-deflection (reads tone-deaf)           | name what they're facing in their words; ask one humane, concrete question    |

Discovery never uses "tell me your vision" as a _fallback_. A vision question is legitimate only as a
_deliberate, well-timed_ opener when there is genuinely nothing concrete on the table — never as the reflex for
"I don't know what else to ask."

## 6. Survey-style vs advisor-led — a real example

From the live corpus (`QUESTION_QUALITY_ANALYSIS.md` §2): a **teacher on a modest salary who wants to retire
comfortably** asks _"Am I on track?"_

- **Survey / deflection (LOW — observed):** _"What's your personal definition of 'on track'?"_ — ignores the
  rich stated context (teacher, salary, "retire comfortably"), and hands the framing job back to the user. It
  asks the user to define the very term they came to have evaluated.
- **Advisor-led (HIGH — target):** _"On a teacher's salary, 'comfortably' usually comes down to one number —
  the monthly income you'd want in retirement. What does a comfortable month look like to you in today's
  dollars?"_ — anchors to their stated reality, converts an abstraction into one concrete, answerable
  threshold, and surfaces the constraint that actually drives the projection. It uncovers (a motivation: what
  "comfortable" means; a future constraint: target spend) without surveying.

The discriminator is unchanged from the analysis: **HIGH does the thinking and hands back a sharp, specific
question; LOW outsources the thinking** (`QUESTION_QUALITY_ANALYSIS.md` §1). Advisor-led discovery is simply
the operational habit of always landing on the HIGH side.

## 7. How discovery rides on the reasoning framework (never a bare intake field)

Discovery has **no standalone "ask a field" code path**. Every discovery question is emitted only as the
_best-next-action_ (step 8) of a completed eight-step reasoning pass (`ADVISOR_REASONING_FRAMEWORK.md` §2):

```
Understand → Frame → Objectives → Constraints → Tradeoffs → Missing info → Confidence → Best next action
                                                   └── discovery's ranking lives here (step 6) ──┘
```

- The question is always preceded internally by a **grounded frame** — the part the current advisor skips
  (`ADVISOR_REASONING_FRAMEWORK.md` §4). A discovery question without a frame _is_ survey behavior.
- Low confidence (step 7) routes to §5's grounded-specific replacement, never to deflection.
- The frame uses only the user's own numbers/cited facts; discovery never computes or advises
  (`ADVISOR_REASONING_FRAMEWORK.md` §7 invariants).

## 8. Runtime home — the merged "Discovery Analyst" (H1)

Discovery (uncovering) is an Advisor behavior; its _analytical engine_ is the merged **Discovery Analyst**
(LIOS-Lite H1) that fuses three specs:

- **Goal Discovery** — converts expressed intent into confirmable candidate goals, grounded in the user's own
  words; proposes, never decides (`GOAL_DISCOVERY_AGENT.md` §1, §6).
- **Goal Conflict** — detects goal-to-goal tensions, but only with a **real cited edge** (citation contract)
  (`GOAL_CONFLICT_AGENT.md` §1, §3) — see `ADVISOR_TRADEOFF_FRAMEWORK.md` for how this degrades on empty
  graphs.
- **Missing Data** — ranks the highest-value unknowns by value-of-information (`MISSING_DATA_AGENT.md` §1).

The division of labor: the **Discovery Analyst computes** (candidates, cited tensions, ranked gaps); the
**Advisor uncovers** (frames, asks the one question, integrates). The Analyst never phrases the user-facing
question; the Advisor never persists, never fabricates, and never asserts a goal-to-goal tension without a
cited edge. This keeps the trust spine intact while the _felt experience_ becomes counsel, not intake.

## 9. Invariants

1. Never ask a discovery question that isn't the best-next-action of a full reasoning pass (no bare fields).
2. Order discovery by value-of-information (Missing Data ranking), never by form-order or ease.
3. One strong question per turn; it must both get the input **and** advance the user's understanding.
4. Low context-confidence ⇒ anchor and get specific; **never** fall back to generic vision-deflection.
5. Integrate every answer as carried context; never re-ask a known/fresh fact (confirm instead).
6. Goal-to-goal tensions need a cited edge; conceptual framing only otherwise (no fabrication).
