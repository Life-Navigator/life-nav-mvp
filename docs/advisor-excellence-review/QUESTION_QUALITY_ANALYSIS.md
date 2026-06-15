# Question Quality Analysis (likely the single biggest issue)

> **Analysis only — no fixes, no code, no prompt changes.** This evaluates advisor **quality**, NOT safety.
> Grounded in the real observed corpus in [`ADVISOR_QUALITY_AUDIT.md`](./ADVISOR_QUALITY_AUDIT.md) §2.
> Trust/hallucination/provenance are out of scope (already solved). This doc isolates **the question** —
> because the advisor's entire felt experience is a sequence of single questions, the quality of those
> questions IS the product.

## 0. Why questions are the keystone

The advisor has exactly one observable move per turn: it asks **one** question (audit §2, "always exactly ONE
question (good discipline)"). It gives no advice by design. So the user's _entire_ impression of "am I talking
to a trusted advisor or an intake bot?" is decided by the quality of that one question. There is no other lever
in the room. If the questions are intake-grade, the advisor _is_ intake — there is nothing else to feel.

That makes question quality not one dimension among ten — it is the load-bearing one. The audit scored
**Question quality = 5/10** (§3) with the note "one strong question ~half the time; the other half
generic-vision deflection." This document explains what separates the two halves and why the split exists.

---

## 1. The rubric — three tiers

We classify every advisor question into one of three tiers. The defining axis is **who does the thinking.**

| Tier       | Name                              | Defining property                                                                                                                                         | Who does the work                                         |
| ---------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **LOW**    | Form / intake / vision-deflection | Generic, answerable without the advisor having understood anything specific; or a vision prompt that hands the framing back                               | The **user** does the thinking                            |
| **MEDIUM** | Decision-relevant input           | Asks for a real input the decision turns on, but unstructured — a smart intake field                                                                      | **Shared** — advisor knows what matters, user supplies it |
| **HIGH**   | Advisor-grade                     | Sharp, specific, often hypothetical-framed; the advisor has already done the structural thinking and poses the one question that cracks the decision open | The **advisor** does the thinking                         |

### The single discriminator

> **LOW questions outsource the thinking back to the user. HIGH questions do the thinking and hand back a
> sharp, specific question.**

A LOW question says, in effect, _"you tell me what matters."_ A HIGH question says _"here is the exact fork
this decision hinges on — which side are you on?"_ MEDIUM sits between: the advisor knows the relevant variable
but presents it as a flat field to fill in, not as a framed choice.

---

## 2. Classifying the real corpus

These are the **actual observed replies** from audit §2. No invented examples.

### LOW — form / intake / vision-deflection (the dominant failure mode)

| Real observed question                                                             | Trigger                                                                     | Why it is LOW                                                                                              |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| _"what does a truly successful and fulfilling life look like to you?"_             | _"What should I be thinking about?"_                                        | Pure vision-deflection. Hands the entire framing job to the user.                                          |
| _"what's your personal definition of 'on track'?"_                                 | _"Am I on track?"_ (teacher, modest salary, wants to retire comfortably)    | Ignored rich stated context; asked the user to define the term they came to the advisor to have evaluated. |
| _"Understanding what 'it' refers to will help us identify your primary objective"_ | _"Can I afford it?"_ (user had already said "buy a house in the next year") | Ignored stated context; made the user re-explain. Outsources comprehension.                                |
| _"what would need to be true for you to feel truly successful and content?"_       | _"What should I prioritize?"_ (divorce)                                     | Vision-deflection on a painful, concrete moment — reads as tone-deaf.                                      |
| _"Understanding your aspirations is crucial…"_                                     | _"Is the degree worth it?"_                                                 | Deflection; restates that aspirations matter instead of probing the actual ROI fork.                       |

The common shape: when the user asks something concrete, the advisor answers with an abstraction the user must
populate. These are the canonical "you tell me what matters" moves.

### MEDIUM — decision-relevant input (smart intake fields)

| Real observed question                               | Trigger                                | Why it is MEDIUM                                                                                                 |
| ---------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| _"how stable do you feel in your current [income]?"_ | _"How much emergency fund do I need?"_ | Targets the right variable (income stability drives fund size) but as a flat field, not a framed tradeoff.       |
| _"what kind of debt are you considering?"_           | _"Should I invest or pay off debt?"_   | Correct first cut (rate determines the answer) — but it is a clarifier, not yet the structured "this is X vs Y." |

These are _good_ questions. They are decision-relevant. They fall short of HIGH only because the advisor
extracts the input without revealing the decision structure it is feeding — the user supplies a fact and is
left unsure why it matters.

### HIGH — advisor-grade (what "great" looks like; the advisor CAN do this)

| Real observed question                                                                                                       | Trigger                                    | Why it is HIGH                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| _"If you bought a home in the next 12 months, how much cash would you want left afterward before you'd feel uncomfortable?"_ | _"How much should I put down on a house?"_ | Hypothetical-framed, specific, time-bounded; reframes a mechanical "how much" into a values/comfort threshold. The advisor did the thinking. |
| _"with your $120k income and $60k in savings, you're considering a $450k house and wondering about its affordability"_       | (post decision-engagement fix)             | Uses the user's own numbers to mirror the real decision back — the only observed instance of numeric grounding driving the framing.          |

The rubric's north-star example — _"If you lost your job tomorrow, how many months could your family maintain
its lifestyle?"_ — is the same species as the advisor's real home-down-payment best: a sharp hypothetical that
converts an abstract worry into a single concrete, answerable threshold. The advisor has demonstrably reached
this bar at least once on its own (the home question), which is the proof that HIGH is in its range.

---

## 3. What makes HIGH high and LOW low — anatomy

### The four properties of the advisor's real HIGH question

Dissecting _"If you bought a home in the next 12 months, how much cash would you want left afterward before
you'd feel uncomfortable?"_:

1. **It does the thinking first.** The advisor silently reframed "how much down payment" into "post-purchase
   liquidity comfort" — that reframe is the insight. The user never had to supply it.
2. **It is specific and bounded.** "Next 12 months," "how much cash," "afterward" — every word narrows the
   answer space. There is no abstraction to populate.
3. **It is hypothetical-framed.** "If you bought…" lets the user reason inside a concrete scenario rather than
   in the void. (The rubric's job-loss example shares this exact construction.)
4. **It surfaces the real tradeoff.** The hidden tradeoff — aggressive down payment vs. retained liquidity /
   peace of mind — is embedded in the question. Answering it advances the decision.

### The four failures of the advisor's real LOW questions

Dissecting _"what's your personal definition of 'on track'?"_ (against a teacher who gave salary + retirement
goal):

1. **It outsources the thinking.** "You define on-track" is precisely the judgment the user came for.
2. **It is generic.** The identical question fits any user, any domain — a tell that no context was used.
3. **It ignores stated context.** The salary and the "retire comfortably" goal were sitting right there; the
   question pretends they weren't.
4. **It surfaces no tradeoff.** Nothing about it moves the decision forward; it resets the conversation to
   zero.

The two anatomies are mirror images. HIGH = advisor-does-work, specific, context-using, tradeoff-bearing.
LOW = user-does-work, generic, context-ignoring, tradeoff-free.

---

## 4. The tier distribution (grounded estimate)

We ground the split in the audit's measured patterns (§2): **19% of decision turns deflect to a generic vision
question**; **56% ask a decision-relevant input** (post-fix); and **0/10 used a number the user stated a prior
turn** (cross-turn context loss).

**Method (honest):** the 19% vision-deflection rate and the 56% decision-relevant rate are measured. We map
them onto tiers and bound the remainder. Vision-deflections are LOW by definition. The "decision-relevant 56%"
is overwhelmingly MEDIUM with a thin HIGH slice — because reaching HIGH additionally requires _framing_ and
_numeric/cross-turn grounding_, and the audit measured the advisor at **0/10 on cross-turn numeric use** and
scored **Decision framing 5/10 ("does NOT structure the decision")**. So most decision-relevant questions stay
at MEDIUM; only the rare reframe (the home question) clears HIGH. The ~25% balance is the generic-clarifier and
formulaic residue between the two measured bands.

| Tier                                 | Estimated share of decision turns | Grounding                                                                                                                                                               |
| ------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LOW** (form/vision-deflection)     | **~30–35%**                       | 19% measured vision-deflection + the generic-clarifier / formulaic-opening residue ("you're exploring the significant decision of…", 12+/40) that does no decision work |
| **MEDIUM** (decision-relevant input) | **~50–55%**                       | the bulk of the measured 56% decision-relevant questions — right variable, flat field, no framing                                                                       |
| **HIGH** (advisor-grade)             | **~10–15%**                       | the rare reframe/numeric-grounding instances (the home down-payment question; the $120k/$60k/$450k mirror) — capped low by 0/10 cross-turn use and 5/10 framing         |

**Headline:** roughly **a third of questions are LOW (intake/deflection), about half are MEDIUM (smart intake),
and only ~1 in 8 reaches HIGH (advisor-grade).** This is consistent with the audit's 5/10 question-quality
score: a coin-flip between a decent question and a deflection, with true excellence rare.

---

## 5. The pattern — the tell

> **The advisor defaults to a generic-vision question whenever it lacks confident context.**

This is the single most diagnostic pattern in the corpus. Every observed LOW question fires on a moment where
the advisor was _unsure_ — an ambiguous referent ("what 'it' refers to"), a broad opener ("what should I be
thinking about?"), or a turn where the relevant context lived in a _prior_ message it had already lost (0/10
cross-turn). When confident context is present in the _same_ message, the advisor can produce its HIGH work
(the $120k/$60k/$450k mirror). When it isn't, it retreats to a safe abstraction and hands the framing back.

So the vision-deflection is not a stylistic quirk — it is a **fallback under uncertainty.** "What does a truly
successful life look like to you?" is what the advisor says when it does not know what else to say. It is the
verbal equivalent of a shrug dressed as depth. Crucially, it most often misfires exactly when context _was_
available but unused (the teacher's salary, the home-buyer's stated timeline) — meaning the trigger is the
advisor's _confidence_, not the actual availability of context. That is why the audit calls cross-turn context
loss "the biggest drag" (§3): losing context manufactures the uncertainty that triggers the deflection.

The second-order tell: LOW questions cluster on **emotional/high-stakes** turns (divorce → "what would need to
be true for you to feel truly successful?"). These are exactly the moments where the advisor has the _least_
confident structured context and the _most_ at stake — so the deflection reflex fires hardest precisely when it
reads as most tone-deaf.

---

## 6. Question-quality verdict

The advisor asks **one** question per turn, and that question is the whole product. About **a third of those
questions are LOW** (generic vision-deflections that outsource the thinking back to the user), **~half are
MEDIUM** (decision-relevant but unframed smart-intake fields), and **only ~10–15% reach HIGH** (the
advisor-grade reframe, proven possible by the home down-payment question and the numeric-mirror).

The dividing line is unambiguous: **HIGH questions do the thinking and pose a sharp, specific, often
hypothetical-framed fork; LOW questions do the opposite and ask the user to do the advisor's job.** The advisor
already demonstrates it can hit HIGH — so the ceiling is not ability, it is **defaulting to vision-deflection
under uncertainty**, an uncertainty most often manufactured by lost or unused context.

**Verdict: question quality is the single biggest quality issue** — not because the best questions are weak
(they are genuinely elite), but because the floor is low and the advisor lands on the floor a third of the
time, disproportionately on the emotional, high-stakes turns where a great question matters most. The advisor
is one confident-context layer away from converting most of its MEDIUM and LOW questions into HIGH ones; the
ability is already in the corpus.
