# Advisor Failure Modes

> **Design only — no code, no runtime, no prompt change, no beta change.** This document catalogs _how_ the
> advisor fails to feel elite — the recurring degradations that make it read as **(B) careful intake** rather
> than **(A) trusted counsel** (`docs/advisor-excellence-review/ADVISOR_QUALITY_AUDIT.md` §1). For each: the
> **root cause** (tied to the gap report's `[P]`/`[C]`/`[A]` legend), the **tell** (a verbatim example from
> the real corpus where one exists), **why it happens** (the mechanism), and a **design-level mitigation**
> tying to the AOS frameworks. **Every mitigation stays inside `ADVISOR_OPERATING_SYSTEM.md` §3 guardrails.**

**Root-cause legend (`ADVISOR_EXCELLENCE_GAP_REPORT.md`):** `[P]` = prompt layer · `[C]` = context/memory
layer · `[A]` = architecture/guardrail · `[D]` = data/coverage. **~20 of 25 gaps are `[P]`/`[C]`** — cheap,
low-risk, no new infrastructure. The failure modes below are the _experiential_ groupings of those gaps.

**Sources:** the verbatim corpus in `ADVISOR_QUALITY_AUDIT.md` §2; the dimension deep-dives
(`QUESTION_QUALITY_ANALYSIS.md`, `EXECUTIVE_PRESENCE_ANALYSIS.md`, `CONTEXT_RETENTION_ANALYSIS.md`,
`TRADEOFF_DISCOVERY_ANALYSIS.md`, `TRUST_ANALYSIS.md`); the gap report top 25.

---

## The unifying diagnosis

> **The very disciplines that make the advisor trustworthy — one question, no advice, deflect-to-discovery
> when unsure — become failure modes when applied _without richness inside the constraint_.**
> (`ADVISOR_QUALITY_AUDIT.md` §5)

So these are not safety failures. Safety-trust is solved (0% fallback, 0 trust violations live —
`TRUST_ANALYSIS.md` §0). These are **quality / authority-trust** failures: the advisor is trusted to be
honest before it is trusted to be good. Two mechanisms recur across almost every mode and are worth naming up
front:

1. **Caution expressed as tentativeness.** Appropriate epistemic humility (good, calibration 7/10) leaks into
   reflexive hedging and deflection (bad). The fix is never "be more confident than the evidence" — it is
   "express the same calibrated honesty with earned, declarative voice" (`EXECUTIVE_PRESENCE_ANALYSIS.md`
   Tell #3).
2. **Lost context manufacturing uncertainty.** Cross-turn context loss makes the advisor _feel_ unsure, which
   triggers the generic-question reflex — so the deflection's true root is often `[C]`, not `[P]`
   (`QUESTION_QUALITY_ANALYSIS.md` §5; `CONTEXT_RETENTION_ANALYSIS.md` §4).

---

## 1. Robotic / templated

- **Tell (real):** _"You're exploring the significant decision of…"_ / _"It sounds like you're…"_ —
  **12+/40 replies opened near-identically** (`ADVISOR_QUALITY_AUDIT.md` §2;
  `EXECUTIVE_PRESENCE_ANALYSIS.md` Tell #1). When a third of replies start the same way, the user's
  pattern-recognition fires: _template, not a thought._
- **Root cause:** `[P]` no variation guidance (gap #9); `[P]` reflect-then-ask template (gap #5).
- **Why it happens:** a single fixed opener shape is the path of least resistance for a prompt that lacks an
  entry-variation instruction; the formulaic opener announces "generated, not considered" _before any content_.
- **Mitigation:** **enter from this situation's specifics, not a fixed frame** (`ADVISOR_VOICE_GUIDE`;
  `ADVISOR_CONVERSATION_FRAMEWORK.md` §2 Part 1 reflect-in-their-numbers). The eight-step reasoning pass
  produces a _grounded_ frame unique to the turn, which structurally cannot be a stock opener
  (`ADVISOR_REASONING_FRAMEWORK.md` §4). Voice rule: vary the entry; lead with their numbers/words.

## 2. Repetitive

- **Tell (real):** a career-promotion reply **restated its own reflection inside the question** (2/40); plus
  malformed-quote run-ons _"When you ask 'Am I on track? Understanding…"_ (3/40)
  (`ADVISOR_QUALITY_AUDIT.md` §2; gaps #19, #20).
- **Root cause:** `[P]`/compose-layer quoting + reflection echo (gaps #16, #19, #20).
- **Why it happens:** reflection used as a default opener becomes an _echo_ — the advisor restates the user's
  question instead of advancing it (`EXECUTIVE_PRESENCE_ANALYSIS.md` Tell #2); compose-layer quoting artifacts
  compound it.
- **Mitigation:** **reflect in one tight beat, then advance** (`ADVISOR_CONVERSATION_FRAMEWORK.md` §2:
  reflect → name the real thing → one question; never re-state the question as the question). The "name the
  real thing" step (Part 2) guarantees the second clause adds _new_ framing, not an echo.

## 3. Generic

- **Tell (real):** _"what does a truly successful and fulfilling life look like to you?"_ (to _"What should I
  be thinking about?"_) and _"what's your personal definition of 'on track'?"_ (to a teacher who gave salary +
  retirement goal) (`ADVISOR_QUALITY_AUDIT.md` §2). Content-empty: pasteable onto any user, any domain
  (`EXECUTIVE_PRESENCE_ANALYSIS.md` Tell #4). **~30–35% of questions are LOW** (`QUESTION_QUALITY_ANALYSIS.md`
  §4).
- **Root cause:** `[P]` defaults to "what's your vision" when context-confidence is low (gap #3); `[C]`
  cross-turn context loss manufactures the low confidence (gaps #2, #13).
- **Why it happens:** **the vision question is the fallback under uncertainty** — "what the advisor says when
  it does not know what else to say… a shrug dressed as depth" (`QUESTION_QUALITY_ANALYSIS.md` §5). It misfires
  most when context _was_ available but lost/unused.
- **Mitigation:** **reason before asking** so a specific, value-of-information question always exists
  (`ADVISOR_REASONING_FRAMEWORK.md` §2 step 6 missing-info ranking) + **carry context forward** so the
  uncertainty that triggers the deflection rarely arises (`ADVISOR_CONTEXT_FRAMEWORK` / `ADVISOR_MEMORY_FRAMEWORK`).
  Replace the generic-vision default with the _most decisive missing input_ (`ADVISOR_DECISION_FRAMEWORK.md`
  §6). Vision questions become rare and deliberate, never a fallback.

## 4. Passive / reactive (no point of view)

- **Tell (real):** the advisor **discovers but never FRAMES the decision** — _"<5% of 100 scenarios framed"_
  (`ADVISOR_EXCELLENCE_GAP_REPORT.md` #1); it "waits + reflects; never leads with a framing"
  (gap #11). On _"Can I afford it?"_ it asks _"what 'it' refers to"_ rather than naming the decision
  (`ADVISOR_QUALITY_AUDIT.md` §2).
- **Root cause:** `[P]` discovery-only prompt; no "structure the tradeoff" instruction (gaps #1, #6, #11); it
  "imitates a coach's form without the edge" (gap #7).
- **Why it happens:** the prompt instructs discovery and withholds advice — and, lacking a framing
  instruction, withholds _structure_ too, so it never asserts a point of view about _how to think_ about the
  decision (which is allowed) for fear of crossing into _what to do_ (which is not).
- **Mitigation:** **frame every decision before asking** — name the real decision + central tradeoff + what
  decides it, all of which are _framing, not advice_ (`ADVISOR_DECISION_FRAMEWORK.md` §3, §4 advice-boundary
  table). The advisor leads with a POV about the _structure_ of the decision while never delivering "the
  answer." Framing is the edge the coach-form was missing (gap #7).

## 5. Overly cautious

- **Tell (real):** vision-deflection on a **divorce** — _"what would need to be true for you to feel truly
  successful and content?"_ — and on **job loss**; the audit calls these _"jarringly intake-y… reads as
  tone-deaf"_ (`ADVISOR_QUALITY_AUDIT.md` §4; gap #14). Caution at the exact moments users most need a stance.
- **Root cause:** `[P]` same discovery template on hard moments (gap #14); `[A]`+`[P]` no proactive tradeoff
  discovery, bounded by the citation contract + empty graphs + one-question discipline (gaps #4, #15).
- **Why it happens:** **caution is the right instinct, but it is expressed as withdrawal** (deflect, hedge,
  defer) rather than as _framing within the limits_. The advisor conflates "I must not advise" with "I must not
  take a position on how to think about this" — and on cited tradeoffs, the empty-graph reality genuinely
  forbids asserting a conflict, so it goes silent instead of being _honestly_ silent
  (`TRADEOFF_DISCOVERY_ANALYSIS.md` §5).
- **Mitigation:** **be excellent within the safety, not withdrawn behind it.** (a) On hard moments: meet the
  emotional register, then frame the _structure_ of the decision (`ADVISOR_EXAMPLES.md` Scenarios 7–8). (b) On
  tradeoffs: surface the tension when a cited edge exists; when none exists, **say so honestly** — "I won't
  assume a conflict I can't see" — which is _active_ caution, not deflection
  (`ADVISOR_DECISION_FRAMEWORK.md` §8.3; `ADVISOR_OPERATING_SYSTEM.md` §3 honest empty states). The advice line
  stays held throughout.

## 6. Overly verbose

- **Tell:** the inverse risk the AOS must avoid — a rich reasoning pass spilling into a wall of text. Today's
  corpus errs _long-ish and generic_ (`EXECUTIVE_PRESENCE_ANALYSIS.md` §2 "long-ish"); the failure mode to
  guard against once framing is added is over-explaining the frame.
- **Root cause:** `[P]` — richness misread as length; presence built on _concision + specificity_, not volume
  (`EXECUTIVE_PRESENCE_ANALYSIS.md` §0, §4).
- **Why it happens:** adding the framing step can tempt a transcript of the eight reasoning steps rather than
  their _collapse_ into a compact turn.
- **Mitigation:** **the reasoning is rich; the output stays disciplined** (`ADVISOR_REASONING_FRAMEWORK.md`
  §4, Invariant 5: "exposed as insight, not as a transcript of the eight steps";
  `ADVISOR_CONVERSATION_FRAMEWORK.md` §3 "one or two moves plus the one question, never a wall of text"). The
  precision of the frame and question carries the richness, not their length.

## 7. Authority-trust gap (sounds capable, not expert) — the felt sum

- **Tell (real):** personas "trust it won't lie, not its judgment" (`TRUST_ANALYSIS.md` §1, §3); the F500 exec
  reads the formulaic openers + over-hedging as _junior_; the parent finds vision-deflection on a hard moment
  _collapses trust fastest of all_.
- **Root cause:** `[P]` presence + insight (gap #12); the compounding of modes 1–6.
- **Why it happens:** authority-trust is built by sounding like you've "done this a thousand times"
  (`ADVISOR_QUALITY_AUDIT.md` §5) — and each individual tell (template, echo, hedge, deflection, artifact) says
  "not an expert" to a user who already believes "not a liar."
- **Mitigation:** there is no single fix — it is the **sum of the mitigations above**, anchored by the asset
  to protect: **calibrated honesty** (the one credibility win that lands across all five personas —
  `TRUST_ANALYSIS.md` §4). Earned confidence: declarative where the evidence allows, honest where it doesn't,
  never hedging as a tic (`EXECUTIVE_PRESENCE_ANALYSIS.md` Tell #3; `ADVISOR_VOICE_GUIDE`).

---

## The meta-failure: "trustworthy but intake-y"

> **"Trustworthy but intake-y" is the _sum_ of all the modes above.** No single tell is fatal; together they
> produce the audit's core verdict — a user feels they are _"being asked one careful question at a time, often
> a generic one, with little memory of what was just said"_ rather than counseled
> (`ADVISOR_QUALITY_AUDIT.md` §1).

The meta-failure decomposes cleanly onto the gap report's three S1 themes
(`ADVISOR_EXCELLENCE_GAP_REPORT.md` §"The pattern"):

| Theme                                          | Failure modes it produces                   | Gaps                |
| ---------------------------------------------- | ------------------------------------------- | ------------------- |
| **Framing** (discovers, never structures)      | #4 passive, #5 cautious                     | #1, #6, #7, #8, #18 |
| **Context / continuity** (starts over)         | #3 generic (the trigger), #7 authority leak | #2, #13             |
| **Question craft** (generic under uncertainty) | #1 robotic, #3 generic                      | #3, #5, #24         |

**The single root behavioral move that resolves the meta-failure:** _reason fully before asking, then expose a
grounded frame + one sharp question_ (`ADVISOR_OPERATING_SYSTEM.md` §7; `ADVISOR_REASONING_FRAMEWORK.md` §1).
It directly attacks all three themes — it forces framing (theme 1), requires carried context to reason (theme
2), and produces a specific question instead of a generic fallback (theme 3) — **without touching a single
guardrail.** Every mitigation in this document is a facet of that one move.

## Mitigation invariants (compliance-preserving)

1. No mitigation adds advice, a fabricated number, an uncited relationship, or a second question.
2. "Less cautious" never means "more confident than the evidence" — it means _calibrated honesty in a
   declarative voice_ and _framing instead of withdrawal_.
3. Honest empty states are the _correct_ output when a cited edge / number is absent — never invent to seem
   more authoritative (`ADVISOR_OPERATING_SYSTEM.md` §3; `TRADEOFF_DISCOVERY_ANALYSIS.md` §2).
4. Richness lives in precision and insight, never in length.
5. The asset to protect above all is calibrated honesty — the credibility win that lands across every persona.
