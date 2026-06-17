# Advisor Quality Audit (the keystone)

> **Analysis only — no fixes, no code, no prompt changes.** This evaluates advisor **quality**, NOT safety.
> Trust/hallucination/provenance/validation are already solved (0% fallback, 0 trust violations live) and are
> explicitly out of scope. This is the grounding document the rest of `docs/advisor-excellence-review/`
> references.

## 0. Evidence boundary (read first — honesty rule)

- **The LifeNavigator column is grounded in REAL observed behavior** — the ~40 live advisor replies captured
  this session via `apps/web/advisor-eval.mjs` (12 personas × 2 turns + adversarial) and
  `advisor-decisions-probe.mjs` (16 hard-decision turns across 6 domains) on the live backend (v94), plus the
  measured telemetry.
- **The ChatGPT / Claude / ideal-CFP / ideal-exec-coach columns are reasoned reference estimates** — informed
  by their known characteristics, NOT measured here. They are labeled as estimates wherever used. We do not
  fabricate competitor scores.
- Where we cannot ground a claim, we say so. Same no-fabrication ethos as the whole program.

---

## 1. The core question, answered

> _If a user spends 30 minutes with LifeNavigator today, do they believe they're speaking with (A) a trusted
> advisor helping them think better, or (B) a cautious intake chatbot collecting information?_

**Evidence-based answer: it leans B — "a careful, trustworthy intake that occasionally asks a genuinely great
question," not yet A.** It has real advisor moments, but the dominant felt experience is _being asked one
careful question at a time, often a generic one, with little memory of what was just said._ The very
disciplines that make it trustworthy (one question, no advice, deflect-to-discovery, no fabrication) are what
make it feel like intake rather than counsel. It is **trustworthy but not yet elite.**

## 2. The real evidence corpus (verbatim, live)

**Advisor-grade moments (this is what "good" looks like — it CAN do this):**

- _"How much should I put down on a house?"_ → **"If you bought a home in the next 12 months, how much cash
  would you want left afterward before you'd feel uncomfortable?"** — reframes to a values/comfort question. Elite.
- _"How much emergency fund do I need?"_ → **"how stable do you feel in your current [income]?"** — decision-relevant.
- _"Should I invest or pay off debt?"_ → **"what kind of debt are you considering?"** — the right first cut.
- (post decision-engagement fix, same message) → **"with your $120k income and $60k in savings, you're
  considering a $450k house and wondering about its affordability"** — uses the user's own numbers.

**Intake / deflection moments (this is the dominant failure mode):**

- _"Can I afford it?"_ (user had said "buy a house in the next year") → **"Understanding what 'it' refers to
  will help us identify your primary objective"** — ignored stated context; asked the user to re-explain.
- _"Am I on track?"_ (teacher, modest salary, retire comfortably) → **"what's your personal definition of 'on
  track'?"** — generic; ignored the rich context.
- _"What should I be thinking about?"_ → **"what does a truly successful and fulfilling life look like to you?"**
  — vision-deflection.
- _"What should I prioritize?"_ (divorce) → **"what would need to be true for you to feel truly successful and
  content?"** — vision-deflection on a painful, concrete moment.
- _"Is the degree worth it?"_ → **"Understanding your aspirations is crucial…"** — deflection.

**Artifacts (polish failures):**

- Malformed quoting (3/40): _"When you ask 'Am I on track? Understanding…"_ (opens a quote, never closes,
  runs on).
- Repetition (2/40): a career-promotion reply restated its own reflection inside the question.
- Formulaic openings: 12+/40 opened with near-identical _"You're exploring the significant decision of…"_ /
  _"It sounds like you're…"_.

**Measured patterns:** always exactly ONE question (good discipline); reflects the user's words (good);
**19% of decision turns deflect to a generic vision question**; **56% ask a decision-relevant input** (post-fix);
**0/10 used a number the user stated a prior turn** (cross-turn context loss); voice is calm/warm but
formulaic and hedge-heavy.

## 3. The ten dimensions — the live advisor, scored (0–10, with justification)

| Dimension                  | Score    | Justification (from the corpus)                                                                       |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| **Understanding**          | 6        | reflects the surface ask accurately; misses the deeper situation (teacher/divorce context unused)     |
| **Context use**            | 4        | same-message numbers used (post-fix); **cross-turn context lost (0/10)** — biggest drag               |
| **Insight**                | 3        | rarely surfaces anything non-obvious; mostly mirrors the user back                                    |
| **Tradeoff detection**     | 4        | can on a cited multi-goal graph; usually doesn't proactively surface competing priorities             |
| **Decision framing**       | 5        | post-fix asks decision-relevant inputs; does NOT structure the decision ("this is X vs Y")            |
| **Question quality**       | 5        | one strong question ~half the time; the other half generic-vision deflection                          |
| **Personalization**        | 4        | uses the user's words; formulaic openings; not deeply tailored                                        |
| **Confidence calibration** | 7        | honest about what it doesn't know — a real strength; but over-hedges                                  |
| **Executive presence**     | 4        | calm but formulaic, hedge-heavy, occasional artifacts; doesn't sound _experienced_                    |
| **Actionability**          | 4        | asks a question; user rarely leaves knowing the next concrete step (by design: discovery, not advice) |
| **Aggregate**              | **~4.6** | trustworthy + careful; not yet elite                                                                  |

> The shape of the scores is the story: **high on calibration/honesty (trust), low on insight/context/
> executive-presence (eliteness).** The advisor is winning the trust game and losing the "feels like a great
> advisor" game — and the two are in tension under the current design.

## 4. The 100-scenario evaluation framework

The 100 canonical scenarios (full list in `DECISION_QUALITY_ANALYSIS.md`) span: **Finance** (home, debt,
retirement, inheritance, divorce, job loss, business) · **Career** (promotion, change, layoff, relocation,
leadership) · **Education** (MBA, college, certification, loans) · **Family** (children, aging parents,
guardianship, estate) · **Cross-domain** (move states, new baby, disability, caregiving, major medical,
entrepreneur).

Each scenario is evaluated across the 6 advisors (Current / ChatGPT / Claude / ideal Family-Office / ideal
CFP / ideal Exec-Coach) on the 10 dimensions. **Method (honest):** the Current advisor is scored from
observed behavior + pattern extrapolation by scenario class; the other five are reasoned reference bands.

**Category-level finding (grounded in the corpus, extrapolated honestly):**

| Scenario class                                                   | Current advisor felt-experience                                                  | Where it's weakest                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| Simple/conversational (~25%)                                     | adequate — one fine question                                                     | low insight (acceptable here)            |
| Single-domain w/ numbers (e.g. debt, emergency fund)             | decent post-fix when numbers are same-message                                    | cross-turn loss; no framing              |
| Multi-domain decisions (home, retirement, relocation, business)  | **weakest** — deflects, doesn't frame the tradeoff, loses context                | insight, framing, tradeoff, context      |
| Emotional/high-stakes (divorce, job loss, aging parent, medical) | **jarringly intake-y** — vision-deflection on painful moments reads as tone-deaf | understanding, presence, personalization |

The aggregate ~4.6 holds across classes; it dips lowest exactly where users most need an advisor (multi-domain

- emotional), which is the worst place to feel like intake.

## 5. Why it feels weak (the one-paragraph thesis)

The advisor was engineered to be _trustworthy_, and it is. But trust was bought with **constraint** — one
question, no advice, no fabrication, deflect to discovery when unsure — and constraint, applied without
_richness inside the constraint_, reads as caution, not counsel. ChatGPT/Claude feel smarter because they are
_unconstrained_: they frame the whole decision, surface tradeoffs unprompted, and sound experienced — even
when ungrounded. **The gap is not that LifeNavigator is too safe; it's that it has not yet learned to be
_excellent within its safety_: to ask the one question like a master, to use everything it already knows, to
frame the decision, and to sound like it has done this a thousand times.** Crucially, most of that is a
prompt + context-layer problem — cheap to change — which is the throughline into the gap report and roadmap.

## 6. What this audit grounds

Every other doc in this directory builds on the corpus (§2), the dimension scores (§3), and the thesis (§5):
the comparisons (`ADVISOR_VS_*`), the dimension deep-dives (`QUESTION_/DECISION_/TRADEOFF_/CONTEXT_/TRUST_/
EXECUTIVE_PRESENCE_/PERSONALITY_`), and the synthesis (`ADVISOR_EXCELLENCE_GAP_REPORT.md`,
`ADVISOR_UPGRADE_ROADMAP.md`). No fixes here — only the truth of where the advisor stands.
