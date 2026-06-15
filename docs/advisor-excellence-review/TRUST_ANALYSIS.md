# Trust Analysis — Perceived Credibility & Authority

> **Analysis only — no fixes, no code, no prompt changes.**
> Grounded in `ADVISOR_QUALITY_AUDIT.md` (the keystone). The LifeNavigator evidence is REAL observed
> behavior (the ~40 live replies in audit §2). Persona reactions and any competitor/ideal reference are
> reasoned estimates, labeled as such.

## 0. The reframe (read first)

**Safety-trust is solved and OUT OF SCOPE.** Hallucination, provenance, validation, and fabrication are
already handled — 0% fallback, 0 trust violations live (audit §0). This document does **not** re-evaluate
whether the advisor will lie or invent data. It won't.

This document evaluates a _different_ trust: **perceived credibility / authority**. The question is not
"will it deceive me?" — it's **"does this advisor feel expert enough that I would trust its judgment, act on
its framing, and come back?"** Two distinct constructs run through everything below:

- **Safety-trust** — _"I trust it won't lie to me."_ Status: **HIGH (solved).**
- **Authority-trust** — _"I trust its judgment and expertise."_ Status: **THE GAP.**

A user can fully believe the advisor is honest and _still_ not believe it's good. That second belief is what
drives action and retention, and it is what the corpus shows is unearned today.

## 1. What the corpus says about each trust

Authority-trust is built and destroyed by specific, observable behaviors in the audit corpus. Mapping them:

**Builds perceived authority (the credibility wins):**

- **Honesty / calibration.** Confidence calibration scores **7/10** (audit §3) — "honest about what it
  doesn't know — a real strength." Admitting limits, when it's genuine, reads as the candor of someone
  secure in their expertise. This is the single strongest credibility asset.
- **Accurate reflection.** It "reflects the user's words (good)" and "reflects the surface ask accurately"
  (Understanding 6/10). Being heard is the precondition for trusting a judgment.
- **The elite questions.** _"If you bought a home in the next 12 months, how much cash would you want left
  afterward before you'd feel uncomfortable?"_ (§2). A question like this _is_ expertise on display — it
  reframes from price to comfort. When it lands, it earns authority instantly.

**Erodes perceived authority (the credibility leaks):**

- **Generic-vision deflection.** **19% of decision turns** deflect to a generic vision question (§2/§3).
  _"what does a truly successful and fulfilling life look like to you?"_ in response to _"What should I be
  thinking about?"_, and worse, the same move on a divorce: _"what would need to be true for you to feel
  truly successful and content?"_ (§2). To an expert ear this reads as _not knowing what to do with the
  question_ — the opposite of authority.
- **Cross-turn context loss.** **0/10 used a number the user stated a prior turn** (§2/§3, Context use 4).
  _"Can I afford it?"_ — after the user said they want to buy a house in the next year — answered with
  _"Understanding what 'it' refers to will help us identify your primary objective"_ (§2). Asking a user to
  re-explain what they just said is the fastest way to look like you weren't listening, which directly
  undercuts perceived competence.
- **Artifacts.** Malformed quoting (3/40), repetition (2/40) (§2). A trusted advisor does not stammer. These
  are small but they read as "system," and a glitch makes a user re-rate everything else downward.
- **Hedging.** "over-hedges" (§3). Confidence calibrated honestly builds trust; hedging _as a verbal tic_
  reads as a lack of conviction — and you don't act on the advice of someone who doesn't seem to believe it.

The pattern: the very disciplines that earn safety-trust (one question, no advice, deflect when unsure) are
the ones that, applied without richness, **cost** authority-trust (§5). The two trusts are in tension.

## 2. The five personas — would they trust its judgment?

Persona reactions are reasoned estimates (per the honesty rule), anchored to the real corpus behaviors above.
For each: safety-trust is assumed HIGH (solved); the verdict is about **authority-trust**.

### Fortune 500 executive

- **Trusts it won't lie:** yes.
- **Trusts its judgment:** **No, not yet.** This persona is allergic to filler and rewards people who get to
  the point and frame the decision. The formulaic openers ("You're exploring the significant decision of…",
  12+/40 — §2) and the over-hedging read as junior. Asked _"What should I prioritize?"_ and getting a vision
  question back (§2) would, to an exec, signal the advisor can't run the meeting. The one elite reframe would
  impress — but inconsistency (it happens ~half the time, Question quality 5/10) means they can't rely on it.
- **Would return?** Probably not after a deflection on a real decision.

### Physician

- **Trusts it won't lie:** yes — and calibration (7/10) maps well to clinical humility; admitting uncertainty
  is _credible_ to a doctor, not weak.
- **Trusts its judgment:** **Partially.** Physicians respect a good history-taker, so the careful one-question
  intake is not off-putting to them the way it is to the exec. But they expect a working hypothesis after the
  history — a differential. The advisor never structures the decision ("this is X vs Y", Decision framing
  5/10), so it stalls at intake. Trust is _conditional_ and would erode if it never moves to a frame.

### CFP (financial planner)

- **Trusts it won't lie:** yes.
- **Trusts its judgment:** **Mixed, leaning skeptical on the fundamentals.** A CFP will instantly clock the
  good cuts — _"what kind of debt are you considering?"_ for invest-vs-payoff is exactly the right first
  question (§2), and using the user's own numbers ("$120k income and $60k in savings… $450k house", §2) is
  textbook. That earns real respect. But a CFP will also instantly clock the **cross-turn context loss** as
  unprofessional — a planner who forgets your stated numbers between turns is one you fire. Net: respects the
  technique, distrusts the reliability.

### Veteran

- **Trusts it won't lie:** yes.
- **Trusts its judgment:** **Low-to-mixed.** This persona tends to value directness, competence under
  pressure, and no wasted words. The calm, steady tone is an asset. But vision-deflection and hedging read as
  evasive — "just tell me the play." Being asked _"what's your personal definition of 'on track'?"_ (§2) when
  they gave rich context lands as the advisor dodging rather than leading. Directness is the currency, and the
  advisor doesn't spend it.

### Parent

- **Trusts it won't lie:** yes — and for a parent, knowing it won't fabricate financial/medical claims is a
  genuine, valued reassurance.
- **Trusts its judgment:** **The most jarring fit.** Parents arrive emotional and high-stakes (a divorce, a
  child, an aging parent). The audit calls these moments _"jarringly intake-y"_ and the vision-deflection on
  painful moments _"reads as tone-deaf"_ (§4). Authority for a parent is _being met where they are_. A
  generic vision question on a hard moment doesn't just fail to help — it signals the advisor doesn't
  understand the weight, which collapses authority-trust fastest of all five.

## 3. The two-trust verdict

| Persona        | Safety-trust (solved) | Authority-trust (the gap)       | Driver                                       |
| -------------- | --------------------- | ------------------------------- | -------------------------------------------- |
| F500 executive | High                  | **Low**                         | filler + hedging + deflection read as junior |
| Physician      | High                  | Partial                         | good history-taker, never reaches a frame    |
| CFP            | High                  | Mixed                           | right technique, unreliable context recall   |
| Veteran        | High                  | Low–mixed                       | wants directness; gets evasion               |
| Parent         | High                  | **Lowest in emotional moments** | tone-deaf deflection collapses trust         |

## 4. Conclusion

**The advisor earns safety-trust but not yet authority-trust.** Every persona believes it won't lie — that
construct is solved and not in question. None of them yet _fully_ trust its judgment enough to reliably act
and return, and several would actively lose confidence at the exact moments that matter most.

The asset to protect is calibrated honesty — it is the one credibility win that lands across all five personas
and it is genuinely advisor-like. The liabilities are not safety failures; they are **perception** failures:
generic-vision deflection, cross-turn forgetting, hedging, and artifacts each say "not an expert" to a user
who already believes "not a liar." Authority-trust is built by sounding like you've done this a thousand
times (audit §5) — and right now the corpus shows an advisor that is trusted to be honest before it is
trusted to be good.
