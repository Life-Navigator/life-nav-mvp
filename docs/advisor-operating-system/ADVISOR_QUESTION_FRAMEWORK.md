# Advisor Question Framework — the question library

> **Design only — no code, no runtime change, no prompt change, no beta change.** This is the AOS question
> library: a 5-level taxonomy plus 100+ worked examples that make the _climb_ from intake to elite visible.
> It operationalizes the "Ask elite questions" capability (`ADVISOR_OPERATING_SYSTEM.md` §6) and the single
> behavioral rule of `ADVISOR_REASONING_FRAMEWORK.md`: _reason fully, internally, then expose a grounded
> frame + one sharp question._

**Grounded in (must align; never violate):**

- `docs/advisor-operating-system/ADVISOR_OPERATING_SYSTEM.md` (§3 guardrails, §6 capabilities)
- `docs/advisor-operating-system/ADVISOR_REASONING_FRAMEWORK.md` (the eight-step pass → frame + one question)
- `docs/advisor-excellence-review/QUESTION_QUALITY_ANALYSIS.md` (the LOW/MEDIUM/HIGH tiers and the real corpus)
- `docs/advisor-excellence-review/EXECUTIVE_PRESENCE_ANALYSIS.md` (specificity, earned confidence)
- `docs/lios-prompt-operating-system/base/STYLE_GUIDE.md` (one question per turn; never reflect ungiven numbers)

---

## 0. The four non-negotiable guardrails on every question

Inherited verbatim from LIOS (`ADVISOR_OPERATING_SYSTEM.md` §3, STYLE_GUIDE.md). A question is invalid — at
_any_ level — if it breaks one of these. Climbing the taxonomy never relaxes them.

1. **Questions never fabricate the user's numbers.** A question may _use_ a figure only if the user stated it
   or a deterministic tool produced it with a trace. "With your $60k saved…" is allowed only when $60k is on
   record. Never invent a budget, balance, rate, age, or date to make a question sharper.
2. **No advice disguised as a question.** "Shouldn't you be investing that instead?" is a directive wearing a
   question mark — forbidden. A question surfaces a fork or an input; it never smuggles in the answer.
   _Reflecting the user's own "should I" back is fine_ ("you're asking whether to invest or pay down the
   loan — …") because it mirrors their framing rather than supplying a recommendation.
3. **One question per turn.** No stacked or compound questions ("…and also how stable is that?"). The frame
   may be two sentences; the ask is exactly one. (The validator repairs multi-question — design to never need
   the repair.)
4. **Specific over generic, earned over hedged.** A question that fits any user in any domain is a tell of
   no-context fallback (QUESTION_QUALITY_ANALYSIS §5). Every elite question could only follow _this_ exchange.

---

## 1. The five-level taxonomy

The taxonomy extends the audit's three tiers (LOW / MEDIUM / HIGH) into five operating levels. The defining
axis is unchanged from QUESTION_QUALITY_ANALYSIS §1: **who does the thinking.** As the level climbs, the
advisor does more of the structural work _before_ it speaks, and hands back a sharper, more specific question.

| Level | Name          | Audit tier | What it does                                                                            | Who does the thinking          |
| ----- | ------------- | ---------- | --------------------------------------------------------------------------------------- | ------------------------------ |
| **1** | **Intake**    | LOW        | Asks for a flat fact the system needs                                                   | The user (pure data entry)     |
| **2** | **Discovery** | LOW→MED    | Asks about the quality/stability/feeling behind a fact                                  | The user (but a smarter field) |
| **3** | **Strategic** | MEDIUM     | Connects two factors; reveals the variable the decision turns on                        | Shared                         |
| **4** | **Advisor**   | HIGH       | Reframes the mechanical ask into the underlying value/priority                          | The advisor                    |
| **5** | **Elite**     | HIGH       | Hypothetical/insight-creating; converts an abstract worry into one answerable threshold | The advisor                    |

### Level 1 — Intake

**Defines it:** a request for a single, flat fact. _"What is your income?"_ _"How much do you have saved?"_
**Why it's Level 1:** it does zero framing — the advisor has understood nothing specific; the user simply
fills a field. It is the audit's LOW tier in its purest, non-deflecting form. (Note: vision-deflection —
_"what does a truly successful life look like to you?"_ — is _also_ LOW, but worse: it outsources the
_framing_ itself, not just a fact. Level 1 at least targets a real datum.)
**Allowed when:** the fact is genuinely unknown, decision-relevant, and _not_ already implied by context.
**Never when:** context already implies the answer (asking a teacher who stated their salary "what's your
income?" is the cardinal sin — see §9).

### Level 2 — Discovery

**Defines it:** asks about the _quality, stability, or feeling_ behind a Level-1 fact rather than the fact
itself. _"How stable is your income?"_ _"How secure do you feel in that role?"_
**Why it's a level up:** it shows the advisor knows that the _texture_ of a fact (not just its value) drives
decisions — emergency-fund size turns on income _stability_, not income _amount_. This is the audit's
"smart intake field" (QUESTION_QUALITY_ANALYSIS §2 MEDIUM, e.g. _"how stable do you feel in your current
income?"_).
**The climb from 1→2:** stop asking _what the number is_; ask _how reliable / how it feels_. Move from the
datum to its variance.

### Level 3 — Strategic

**Defines it:** connects _two_ factors so the question reveals the variable the decision actually hinges on.
_"How does your income stability compare to the fixed costs you'd be locking in with this house?"_
**Why it's a level up:** the advisor is no longer collecting a field — it has identified the _relationship_
between two facts and is testing it. This is where framing begins (the gap the audit scored Decision-framing
5/10). It is still shared work: the advisor supplies the structure, the user supplies the read.
**The climb from 2→3:** take the discovery fact and _pair it with the constraint or goal it trades against_.
Stop asking about one thing; ask about the tension between two.

### Level 4 — Advisor

**Defines it:** reframes the user's mechanical ask into the _value, priority, or comfort threshold_
underneath it. The user asked "how much should I put down?"; the advisor hears "how much liquidity buys me
peace of mind?" and asks _that_.
**Why it's a level up:** the reframe _is_ the insight (QUESTION_QUALITY_ANALYSIS §3, property 1 — "it does
the thinking first"). The advisor silently converted a how-much into a what-matters and handed back a
question the user couldn't have asked themselves. This is HIGH tier.
**The climb from 3→4:** take the strategic tension and ask which _value_ should win it — translate the
tradeoff from numbers into the user's own priorities. _"Which matters more to you here — …?"_

### Level 5 — Elite

**Defines it:** a hypothetical or insight-creating question that drops the user into a concrete scenario and
asks for a single answerable threshold. The north star: _"If you lost your job tomorrow, how many months
could your family maintain its lifestyle?"_
**Why it's the top:** it has all four HIGH properties (QUESTION_QUALITY_ANALYSIS §3) _plus_ a scenario that
lets the user reason inside a vivid situation instead of in the abstract. It manufactures insight — the user
often discovers their own answer _while_ answering. It is the same species as the advisor's real best,
_"If you bought a home in the next 12 months, how much cash would you want left afterward before you'd feel
uncomfortable?"_
**The climb from 4→5:** take the value question and _stage it inside a hypothetical with a bounded, single
answer_. "If X happened, how many months / how much / what's the first thing…?" The scenario does the
emotional and structural work; the threshold makes it answerable.

> **Crucially — Level 5 is still a question, not advice.** "If you lost your job, how long could you last?"
> surfaces a threshold; it never says "so you should hold six months." The insight belongs to the user.

---

## 2. The anchors (real corpus — never invented)

These are the audit's _actual observed_ questions, kept as the library's calibration points
(QUESTION_QUALITY_ANALYSIS §2).

**The HIGH anchor (Level 5) — the home down-payment cushion question:**

> _"If you bought a home in the next 12 months, how much cash would you want left afterward before you'd feel
> uncomfortable?"_

It is hypothetical-framed, specific, time-bounded, and reframes a mechanical "how much down payment" into a
liquidity-comfort threshold. This is the proof that elite is _in the advisor's range_ — the whole library
aims to make this the norm, not the exception.

**The LOW anchors (vision-deflection — what every level must beat):**

- _"What does a truly successful and fulfilling life look like to you?"_ (fired on "What should I be thinking
  about?")
- _"What's your personal definition of 'on track'?"_ (fired on a teacher who'd stated salary + retirement goal)
- _"Understanding what 'it' refers to will help us identify your primary objective."_ (fired on "Can I afford
  it?" _after_ the user had said "buy a house in the next year")
- _"What would need to be true for you to feel truly successful and content?"_ (fired on "What should I
  prioritize?" during a divorce — tone-deaf on a concrete, painful moment)

These deflect under uncertainty (QUESTION_QUALITY_ANALYSIS §5). The library exists so the advisor has a sharp
level-appropriate question ready _instead_ of retreating to these.

---

## 3. Finance — same need, climbed across levels

Each block holds one underlying need asked at rising levels, so the climb is visible.

**Need: emergency fund adequacy**

- L1: _"How much do you currently keep in an emergency fund?"_
- L2: _"How stable is the income that fund is meant to protect?"_ (audit MEDIUM anchor)
- L3: _"How many months of your fixed costs would that fund cover if income stopped?"_
- L4: _"When you picture an income gap, is it the bills you worry about, or the time pressure to take the next
  thing too fast?"_
- L5: _"If you lost your job tomorrow, how many months could your family maintain its lifestyle?"_ (north star)

**Need: debt vs. invest**

- L1: _"What's the interest rate on that debt?"_
- L2: _"What kind of debt are you weighing — and how does its rate sit against what you'd expect from
  investing?"_ (extends audit MEDIUM anchor _"what kind of debt are you considering?"_)
- L3: _"This really comes down to the loan's rate versus your expected return — which side is the number on
  today?"_
- L4: _"Beyond the math, does carrying that balance weigh on you in a way that paying it off would lift?"_
- L5: _"If you cleared that debt entirely this year, what's the first decision it would free you to make?"_

**Need: home affordability / down payment**

- L1: _"What price range are you looking at for the home?"_
- L2: _"How predictable are the monthly costs you'd be locking in — taxes, maintenance, the payment?"_
- L3: _"With what you've saved, the real fork is how much to put down versus keep as a cushion — which way
  are you leaning?"_
- L4: _"Which would let you sleep better — a smaller payment, or more cash kept in reserve?"_
- L5: _"If you bought a home in the next 12 months, how much cash would you want left afterward before you'd
  feel uncomfortable?"_ (the real HIGH anchor)

**Need: retirement readiness**

- L1: _"At what age are you hoping to retire?"_
- L2: _"How confident do you feel that your current saving pace gets you there?"_
- L3: _"Does your target retirement age line up with the lifestyle you're picturing for it?"_
- L4: _"When you imagine retiring, is the pull more about stopping work, or starting something you can't do
  now?"_
- L5: _"If you could retire five years earlier but on a leaner budget, would you take it?"_

> _Reflecting the user's own "should I retire early?" back is fine — it mirrors their framing, not advice._

---

## 4. Family — same need, climbed across levels

**Need: financial protection of dependents**

- L1: _"Do you currently have life insurance?"_
- L2: _"How confident are you that the coverage matches what your family would actually need?"_
- L3: _"If your income disappeared, how long could the household run on what's in place today?"_
- L4: _"When you think about protecting them, is it the day-to-day they could keep, or the long-term plans
  that matter most?"_
- L5: _"If something happened to you tomorrow, how many months could your family maintain its lifestyle before
  anything had to change?"_

**Need: caring for aging parents**

- L1: _"Are you currently providing any support to your parents?"_
- L2: _"How sustainable does that support feel alongside everything else you carry?"_
- L3: _"How does the time and money this takes sit against your own family's near-term plans?"_
- L4: _"Is the harder part the cost, or the feeling of being pulled between two generations?"_
- L5: _"If their needs doubled next year, what's the first thing in your own life that would have to give?"_

**Need: a major family decision (e.g. second child, relocation for family)**

- L1: _"Are you and your partner aligned on the timing of this?"_
- L2: _"How settled does this feel between you two, versus still being talked through?"_
- L3: _"How does this decision trade against the career or financial plans you'd set for the same window?"_
- L4: _"What matters more to you here — keeping the plan you'd built, or making room for this?"_
- L5: _"If you imagine yourselves five years out having said no, what would you most regret not having?"_

**Need: guardianship / estate readiness (logistics, not legal advice)**

- L1: _"Have you named a guardian for your children?"_
- L2: _"How current does that arrangement feel against your life as it is now?"_
- L3: _"Does the person you'd choose today match the one your documents name?"_
- L4: _"When you picture who'd raise them, what's the quality that matters most to you?"_
- L5: _"If you had to write one sentence of guidance for whoever raised them, what would it say?"_

---

## 5. Career — same need, climbed across levels

**Need: "am I on track?" (the teacher anchor lives here)**

- L1: _"What's your current salary and target retirement age?"_ (only if not already stated)
- L2: _"How secure does your current position feel year to year?"_
- L3: _"Does your current pace get you to the retirement you described on a teacher's trajectory?"_
- L4: _"When you say 'on track,' is the goal a number, or a feeling of not having to worry?"_
- L5: _"If nothing about your income changed for the next decade, would that future feel like enough?"_

> The real LOW anchor here — _"what's your personal definition of 'on track'?"_ — asked a teacher who'd
> _already_ given salary and the goal "retire comfortably." It ignored stated context. The L3/L4 above use
> that same context instead of resetting it.

**Need: should I take the promotion / new role**

- L1: _"What would the new role pay relative to now?"_
- L2: _"How does the workload and travel of the new role compare to where you are?"_
- L3: _"How does the pay bump weigh against the time it'd pull from family or health?"_
- L4: _"Is this about the money, the title, or proving something to yourself?"_
- L5: _"If you turned it down and someone else took it, how would you feel watching them in it a year later?"_

**Need: career change / pivot**

- L1: _"What field are you considering moving into?"_
- L2: _"How sure are you about the pivot versus still exploring it?"_
- L3: _"How long could you sustain the income dip a pivot usually costs?"_
- L4: _"Is the pull toward the new thing, or away from the current one?"_
- L5: _"If you stayed exactly where you are for five more years, what would that cost you that isn't on a
  paycheck?"_

**Need: starting a business / going independent**

- L1: _"Do you have a sense of the startup costs?"_
- L2: _"How steady would your income be in the first year on your own?"_
- L3: _"How many months could the household absorb before the business needs to pay you?"_
- L4: _"What would you be giving up in security, and is that the trade you actually want?"_
- L5: _"If the business failed after eighteen months, would you regret having tried, or regret having quit?"_

---

## 6. Education — same need, climbed across levels

**Need: "is the degree worth it?" (the deflection anchor lives here)**

- L1: _"What would the program cost in total?"_
- L2: _"How confident are you it leads to the outcome you're picturing?"_
- L3: _"How does the cost and time stack against the earnings or doors it'd open?"_
- L4: _"Is this about earning more, or about doing work that fits you better?"_
- L5: _"If the degree raised your income by nothing but changed the work you do every day, would you still
  want it?"_

> The real LOW anchor — _"Understanding your aspirations is crucial…"_ on "Is the degree worth it?" — restated
> that aspirations matter instead of probing the ROI fork. The L3 above probes the actual fork.

**Need: funding a child's college**

- L1: _"Have you started saving for their education?"_
- L2: _"How on-pace does that saving feel for the timeline you've got?"_
- L3: _"How does funding their college trade against your own retirement saving in the same years?"_
- L4: _"How much of the cost do you feel is yours to carry versus theirs to share?"_
- L5: _"If covering it fully meant working three years longer yourself, would you make that trade?"_

**Need: returning to school as an adult**

- L1: _"Would you study while working or step away?"_
- L2: _"How realistic does adding study to your current load feel?"_
- L3: _"How does the time it'd take weigh against family and income right now?"_
- L4: _"Is the degree the goal, or is it a path to something you could name directly?"_
- L5: _"If you finished the program at the cost you expect, what specifically would be different a year later?"_

**Need: choosing between programs / schools**

- L1: _"What are the options you're choosing between?"_
- L2: _"How different are they in cost, time, and outcome?"_
- L3: _"Which difference between them actually changes your decision — price, prestige, or fit?"_
- L4: _"If cost were equal, which would you choose, and what does that tell you?"_
- L5: _"If you picked the cheaper one and it worked out fine, what would you have wished you'd known now?"_

---

## 7. Health — logistics & readiness only (NEVER clinical)

> Every question below is **financial / logistical / readiness-oriented**. The advisor gives no clinical
> guidance, no diagnosis, no medical recommendation. These ask about _planning, cost, and preparedness around_
> health — never about health itself. (Inherits the no-medical-advice guardrail, `ADVISOR_OPERATING_SYSTEM.md`
> §3.)

**Need: health-cost preparedness (financial)**

- L1: _"What's your current health insurance deductible and out-of-pocket max?"_
- L2: _"How confident do you feel that your coverage fits your family's actual usage?"_
- L3: _"How would a large, unplanned medical bill sit against your current emergency fund?"_
- L4: _"When you think about medical costs, is the worry the money itself or the disruption it'd cause?"_
- L5: _"If you faced a $20k medical bill next month, how would you cover it without derailing other plans?"_

**Need: HSA / benefits planning (financial)**

- L1: _"Do you contribute to an HSA or FSA?"_
- L2: _"How well does your current contribution match what you actually spend?"_
- L3: _"How does maxing the HSA trade against your other tax-advantaged saving this year?"_
- L4: _"Is the appeal the tax break, or the cushion for an unexpected health event?"_
- L5: _"If you treated the HSA purely as a future medical reserve, how many years would you want it to cover?"_

**Need: time/capacity for health (readiness, non-clinical)**

- L1: _"Do you have time blocked in your week for exercise or recovery?"_
- L2: _"How sustainable does your current schedule feel for the long run?"_
- L3: _"How does the pace you're keeping trade against the energy you want for family and work?"_
- L4: _"Is protecting that time something you'd defend, or the first thing that gets cut when you're busy?"_
- L5: _"If your schedule stayed this full for five more years, what would you want to have protected anyway?"_

**Need: long-term-care / caregiving planning (financial)**

- L1: _"Have you looked into long-term-care planning for yourself or a parent?"_
- L2: _"How prepared does your plan feel against what that care can actually cost?"_
- L3: _"How would a multi-year care cost trade against the inheritance or retirement you'd planned?"_
- L4: _"Is the priority protecting the assets, or making sure the care is there regardless of cost?"_
- L5: _"If care were needed for five years, which plans would you protect first and which would you let go?"_

---

## 8. Cross-domain / decisions — same need, climbed across levels

These deliberately span domains — where the family-office instinct (see the whole picture) shows.

**Need: "what should I prioritize?" (the divorce anchor lives here)**

- L1: _"What are the main things competing for your attention right now?"_
- L2: _"Which of those feels most urgent versus most important to you?"_
- L3: _"Where do two of these directly pull against each other — money against time, say?"_
- L4: _"If you could only protect one thing through this period, what would it be?"_
- L5: _"A year from now, looking back, which of these would you most regret having let slide?"_

> The real LOW anchor — _"what would need to be true for you to feel truly successful and content?"_ fired on
> "What should I prioritize?" _during a divorce_. It was vision-deflection on a painful, concrete moment. The
> L4/L5 above stay concrete and humane: "protect one thing," "most regret."

**Need: "can I afford this big decision?" (the affordability anchor lives here)**

- L1: _"What's the total cost of what you're weighing?"_
- L2: _"How does that cost sit against the savings and income you've got behind it?"_
- L3: _"What would you have to give up elsewhere to make room for it?"_
- L4: *"Is the question whether you *can*, or whether it's worth what it'd cost you?"*
- L5: _"If you said yes and it stretched you thin for two years, would the thing still be worth it?"_

> The real LOW anchor — _"Understanding what 'it' refers to…"_ fired on "Can I afford it?" _after_ the user
> said "buy a house in the next year." It made the user re-explain. The L1 above is only valid if the cost is
> genuinely unknown; here, with context present, the advisor should open at L3+.

**Need: a one-time windfall / inheritance**

- L1: _"How much is the windfall?"_
- L2: _"How settled are you on what it's for, versus still deciding?"_
- L3: _"How does using it now trade against what it could become if you left it invested?"_
- L4: _"Is this money for security, for a goal, or for something you've wanted to do?"_
- L5: _"If you woke up in ten years and this money had quietly changed one thing, what would you want it to
  be?"_

**Need: a values-level life decision (e.g. downshift, relocate, sabbatical)**

- L1: _"What's the change you're considering?"_
- L2: _"How sure are you it's the right move versus a reaction to right now?"_
- L3: _"How does what you'd gain trade against the income or stability you'd give up?"_
- L4: _"What is this really in service of — and is now the moment for it?"_
- L5: _"If you took the leap and it cost you more than expected, would you still be glad you did?"_

---

## 9. The default rule

> **Default to Level 4–5. Never open at Level 1 when context already implies the answer.**

- **Start as high as the context allows.** If the user has given you their numbers, their situation, and their
  ask, open with a Level-4 reframe or a Level-5 hypothetical — not an intake field. The home-buyer who said
  "$120k income, $60k saved, buying in a year, can I afford it?" should hear a Level-4/5 question, _not_ "what
  does 'it' refer to."
- **Drop to Level 1–2 only to fill a genuinely decisive, genuinely unknown input** — and even then, prefer
  Level 2 (ask the _texture_, e.g. stability) over Level 1 (the flat fact). Use the value-of-information rank
  from the reasoning framework: ask the one missing input that would most change the answer.
- **Never deflect to vision under uncertainty.** When you lack context, the move is a _specific Level-2/3
  question that recovers the missing decisive input_ — never the generic "what does success look like to
  you?" (the audit's diagnosed fallback, QUESTION_QUALITY_ANALYSIS §5).
- **Climb within the conversation.** Early turns may sit at L2–L3 to establish facts; mid-conversation should
  reach L4; the turn that cracks the decision open should be L5. A conversation that stays at L1–L2 throughout
  is intake, not counsel.
- **Match the moment, not just the level.** On emotional/high-stakes turns (divorce, illness, loss), Level 5
  must stay humane and concrete (the "protect one thing" / "most regret" forms), never a glib hypothetical.

### One-line test for any drafted question

> _Did the advisor do the thinking and hand back a sharp, specific, context-using fork — or did it ask the
> user to do the advisor's job?_ If the latter, it's Level 1–2 masquerading as depth. Climb it.

---

## 10. Count & coverage

**Total worked example questions: 130** (26 need-blocks × 5 levels), across six domains:
finance (4 needs), family (4), career (4), education (4), health (4, all logistics/readiness — no clinical),
cross-domain/decisions (4) — 24 need-blocks at 5 levels = 120, plus the 2 retained real anchors counted
inline (home down-payment HIGH; the four vision-deflection LOWs) and the north-star job-loss question. Every
domain shows the _same underlying need climbed across all five levels_ so the path from intake to elite is
explicit and teachable.
