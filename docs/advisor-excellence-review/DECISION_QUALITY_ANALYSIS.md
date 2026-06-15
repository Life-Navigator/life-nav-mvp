# Decision Quality Analysis (the 100 canonical scenarios)

> **Analysis only — no fixes, no code, no prompt changes.** This evaluates advisor **quality**, NOT safety.
> Grounded in [`ADVISOR_QUALITY_AUDIT.md`](./ADVISOR_QUALITY_AUDIT.md). Trust/hallucination/provenance are out
> of scope (solved). This doc holds the full 100-scenario list the audit (§4) references, and assesses
> **decision quality** specifically: does the advisor _frame_ the decision, or does it ask one question and stop?

## 0. What "decision quality" means here

A trusted advisor does four things on a real decision, in order:

1. **Frames** it — structures the mess into the actual decision ("this is fundamentally A vs. B").
2. **Surfaces the deciding tradeoff** — names the one variable the choice hinges on.
3. **Leaves the user knowing the next step** — they walk away with a concrete move, not a vaguer fog.
4. (does all this without fabricating — already guaranteed; out of scope.)

An intake bot does none of the above: it asks one clarifying question and stops. The audit's central finding
(§1) is that LifeNavigator "leans B — a careful, trustworthy intake." This document tests that claim against
100 canonical scenarios and isolates _where_ decision quality is elite vs. intake.

**Grading scale (felt-experience):**

- **A — trusted advisor:** frames the decision, surfaces the tradeoff, user knows the next step.
- **B — intake:** asks one decision-relevant question and stops; no structure.
- **C — deflection:** generic vision question; user does the advisor's job (the §2 LOW pattern).

---

## 1. Method (honest)

The Current advisor is graded from **observed behavior + pattern extrapolation by scenario class**, exactly per
audit §4. We have ~40 real replies spanning home/debt/retirement/emergency-fund/divorce/degree/promotion. For
scenario classes the corpus directly covers, the grade is grounded. For classes it does not (e.g.
guardianship, disability onset), we extrapolate from the _measured_ invariants the corpus established and label
it as extrapolation:

- **Always exactly ONE question, no advice** (§2) → caps almost everything at B; the advisor structurally
  cannot reach A by _giving_ a framing, only by _embedding_ a frame in its single question (which it did once,
  on the home down-payment).
- **0/10 cross-turn numeric use** (§2) → multi-turn / multi-input decisions lose the very data framing needs.
- **19% vision-deflection, rising on emotional turns** (§2, §4) → emotional/high-stakes classes get C more often.
- **Decision framing scored 5/10, "does NOT structure the decision"** (§3) → framing is the rare exception.

So the extrapolation is not a guess about _temperament_ — it is the mechanical consequence of measured
invariants applied to each scenario class. Where a class triggers the deflection reflex (broad opener,
emotional, context-in-prior-turn), it trends C; where it presents a clean single-message numeric ask, it can
reach the advisor's best (B+, occasionally A).

---

## 2. The 100 canonical scenarios

### Finance (20)

1. How much should I put down on a house? _(corpus: reached A — the down-payment reframe)_
2. Can I afford this $450k house on $120k income? _(corpus: "what 'it' refers to" deflection — C)_
3. Should I pay off debt or invest? _(corpus: "what kind of debt" — B)_
4. How much emergency fund do I need? _(corpus: "how stable is your income" — B)_
5. Should I refinance my mortgage now?
6. How do I handle a $200k inheritance?
7. Am I saving enough for retirement? _(corpus: "define on track" — C)_
8. Should I take Social Security at 62 or 70?
9. How do I split assets fairly in a divorce? _(corpus: "what would make you content" — C)_
10. Can I retire at 55?
11. Should I buy or rent in this market?
12. How much risk should my portfolio carry?
13. Should I cash out my 401k to clear credit-card debt?
14. How do I build credit from scratch?
15. Should I lease or buy my next car?
16. How do I plan for a lump-sum severance?
17. Should I prioritize my kid's college fund or my retirement?
18. How do I prepare financially for a recession?
19. Should I sell my rental property?
20. How do I structure finances after a divorce settlement?

### Career (18)

21. Should I take the promotion that adds travel?
22. Should I change careers at 40? _(corpus-adjacent: career-change reflection — B/intake)_
23. How do I negotiate a higher salary?
24. Should I stay or leave after being passed over for promotion?
25. I was just laid off — what now?
26. Should I relocate for this job?
27. Should I move from IC to management? _(corpus: promotion reply, repetition artifact — B)_
28. Should I quit to freelance?
29. How do I handle a toxic manager — stay or go?
30. Should I take a pay cut for better work-life balance?
31. Should I accept a counteroffer?
32. How do I pivot into tech without a CS degree?
33. Should I take an internal lateral move?
34. Should I go back to a former employer?
35. How do I decide between two job offers?
36. Should I step back from leadership to be an IC again?
37. Should I take a startup role with equity over salary?
38. How do I plan a phased retirement from my career?

### Education (15)

39. Is the degree worth it? _(corpus: "understanding your aspirations" — C)_
40. Should I get an MBA?
41. Full-time MBA vs. part-time vs. executive?
42. Should I take out loans for grad school?
43. Should my kid take on student debt or pick the cheaper school?
44. Is a coding bootcamp worth it vs. a CS degree?
45. Should I pursue a professional certification?
46. Should I go back to school mid-career?
47. In-state public vs. private with aid for my child?
48. Should I pay for a private high school?
49. Is a PhD worth the opportunity cost?
50. Should I refinance my student loans?
51. Should I pursue PSLF / income-driven repayment?
52. Should I fund a 529 vs. pay tuition out of pocket?
53. Should I take a gap year before college?

### Family (17)

54. Should we have a (another) child? _(emotional/high-stakes)_
55. How do I plan for a child with special needs?
56. Should I become a stay-at-home parent?
57. How do I care for an aging parent? _(emotional/high-stakes)_
58. Should mom/dad move in with us or go to assisted living?
59. How do I choose a guardian for my kids?
60. Do I need a will / estate plan?
61. How do I talk to my parents about their estate?
62. Should I set up a trust for my children?
63. How do I plan for my own long-term care?
64. Should we adopt?
65. How do I financially prepare for a new baby?
66. How do I handle inheritance fairness among siblings?
67. Should I cosign my child's loan / mortgage?
68. How do I support an adult child who moved back home?
69. How do I plan for a blended-family estate?
70. How do I divide caregiving among siblings?

### Cross-domain (30)

71. Should we move to another state? _(multi-domain: tax/career/family — audit's "weakest" class)_
72. We're having a baby — what should we be thinking about? _(corpus-adjacent: "what should I think about" → vision-deflection C)_
73. I was just diagnosed — how do I plan for disability?
74. A parent needs full-time care — how do we restructure our lives?
75. We're facing a major medical event — how do we prepare?
76. Should I leave my job to start a business? _(finance + career + risk)_
77. Should we relocate internationally?
78. How do we plan for a sabbatical year?
79. One spouse wants to retire early — how do we decide?
80. We're merging finances after marriage — how?
81. How do we plan around a spouse's job loss + a mortgage? _(rubric's job-loss example lives here)_
82. Should we downsize the house as empty-nesters?
83. How do we balance eldercare costs against retirement?
84. We're starting a family business — how do we structure it?
85. How do we plan for a child's special-needs lifetime care?
86. Should we buy a vacation/second home?
87. How do we prepare for a known layoff round at my company?
88. We inherited a family business — keep or sell?
89. How do we plan finances through a gray divorce?
90. Should one of us go part-time to care for kids/parents?
91. How do we plan for immigration / visa-tied employment?
92. We're caregiving for two generations at once — how?
93. How do we recover financially after bankruptcy?
94. Should we self-fund or insure against long-term care?
95. How do we plan for a chronic-illness diagnosis in the family?
96. We're considering surrogacy/IVF — how do we plan?
97. How do we coordinate retirement timing as a couple?
98. Should we move closer to aging parents (career + housing tradeoff)?
99. How do we plan an exit from a business we co-own?
100.  We're navigating job loss + a new baby at the same time. _(multi-domain + emotional — the hardest)_

---

## 3. Decision-quality by scenario class (the assessment)

Per audit §4, decision quality is uniform-ish in _aggregate_ (~4.6) but **dips exactly where users most need
an advisor.** The table below maps each class to the four decision-quality tests. "Frames?" and "Surfaces
tradeoff?" are the elite tests; "Next step?" is the actionability test; "Felt-grade" is the dominant
experience.

| Scenario class                                                                                                   | Frames the decision?                                | Surfaces deciding tradeoff?             | Leaves user knowing next step?     | Felt-grade              | Grounding                                                                 |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------- | ---------------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| **Finance — single-input, same-message numbers** (down payment, debt-vs-invest, emergency fund)                  | Rarely (embedded once, in the down-payment reframe) | Sometimes (the right variable is asked) | Sometimes                          | **B**, occasional **A** | corpus: items 1,3,4 observed                                              |
| **Finance — affordability / "am I on track"** (can I afford, retire at 55, on track)                             | No                                                  | No                                      | No — resets to "define your terms" | **C**                   | corpus: items 2,7 = deflection                                            |
| **Finance — emotional** (divorce split, post-divorce restructure)                                                | No                                                  | No                                      | No                                 | **C**                   | corpus: item 9 = vision-deflection                                        |
| **Career — concrete single decision** (negotiate salary, two offers, counteroffer)                               | No (asks one input)                                 | Partly                                  | Rarely                             | **B**                   | extrapolation: clean single ask → best-B band                             |
| **Career — identity/transition** (change at 40, IC→mgmt, quit to freelance)                                      | No                                                  | No (mirrors user back)                  | No                                 | **B/C**                 | corpus: item 27 promotion (repetition artifact); broad → deflection risk  |
| **Career — layoff (in-the-moment)** (just laid off)                                                              | No                                                  | No                                      | No                                 | **C**                   | extrapolation: emotional + broad opener → deflection reflex               |
| **Education — ROI decisions** (MBA, degree worth it, bootcamp)                                                   | No                                                  | No (asks aspirations, not the ROI fork) | No                                 | **C**                   | corpus: item 39 "understanding your aspirations"                          |
| **Education — financing** (loans, refinance, 529 vs cash)                                                        | No (asks one input)                                 | Partly                                  | Rarely                             | **B**                   | extrapolation: numeric single-input                                       |
| **Family — logistics/financial** (529, new-baby prep, cosign)                                                    | No                                                  | Partly                                  | Rarely                             | **B**                   | extrapolation                                                             |
| **Family — emotional/relational** (aging parent, guardian choice, have another child)                            | No                                                  | No                                      | No                                 | **C**                   | extrapolation: emotional + §4 "jarringly intake-y"                        |
| **Cross-domain — multi-input financial** (state move tax/housing, downsize)                                      | No — does not connect the domains                   | No                                      | No                                 | **C**                   | audit §4: "weakest — deflects, doesn't frame the tradeoff, loses context" |
| **Cross-domain — multi-domain + emotional** (job-loss+baby, disability onset, two-gen caregiving, major medical) | No                                                  | No                                      | No                                 | **C**                   | audit §4: deflection reads as tone-deaf; 0/10 cross-turn context          |

### The core finding

> **The advisor almost never FRAMES a decision. It discovers; it does not structure.** Across all 100
> scenarios, there is exactly one observed instance of a frame _embedded_ in a question (the home down-payment
> reframe), and zero instances of the advisor stating the decision as "this is fundamentally A vs. B."

This follows mechanically from the measured invariants (§1): one question + no advice + 5/10 framing + 0/10
cross-turn context. Framing requires either _telling_ the user the structure (forbidden by the one-question/
no-advice discipline) or _embedding_ it in the single question (which demands confident, synthesized context —
exactly what the advisor lacks cross-turn). So framing only happens in the narrow window where all the data is
in one message AND the advisor produces a reframe. That window opened once in ~40 turns.

### Worst where it matters most

The C grades cluster on **multi-domain** and **emotional** classes — the precise scenarios (items 71–100, plus
divorce, aging parent, layoff) where a real advisor earns their keep by _holding the whole picture_ and naming
the hard tradeoff. Here the advisor's deflection reflex (audit §5: fallback under uncertainty) fires hardest,
because these scenarios carry the most context across turns (which is lost, 0/10) and the broadest framing
demand. The audit's verdict (§4): "it dips lowest exactly where users most need an advisor — the worst place to
feel like intake."

### The deciding tradeoff is almost always left buried

Every scenario above has a _deciding tradeoff_ a master advisor would name unprompted:

- **#81 job-loss + mortgage:** liquidity runway vs. fixed-obligation burn — _"how many months could your family
  maintain its lifestyle?"_ (the rubric's elite example). The advisor would ask one input, not name the fork.
- **#71 state move:** lower taxes vs. severed career network + family proximity — three domains in tension.
- **#100 job-loss + new baby:** runway shrinking while fixed costs jump — the two events _compound_, and the
  decision is about sequencing, not either event alone.

The advisor surfaces a tradeoff only when its _single asked input happens to be the tradeoff variable_ (the
debt-rate question, the income-stability question). It does not proactively name competing priorities (audit
§3: tradeoff detection 4/10, "usually doesn't proactively surface competing priorities").

---

## 4. The fraction that is elite vs. intake

Counting the 100 scenarios by their grounded/extrapolated felt-grade:

| Grade                    | Definition                                             | Approx. count / 100 | Where                                                                                                            |
| ------------------------ | ------------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **A — elite (framed)**   | frames OR embeds frame + surfaces tradeoff + next step | **~3–5**            | the rare clean single-input financial ask where a reframe fires (down payment, occasionally debt/emergency-fund) |
| **B — competent intake** | one decision-relevant question, no framing             | **~45–50**          | most concrete single-input finance/career/education/family-logistics decisions                                   |
| **C — deflection**       | generic vision question; user does the work            | **~45–50**          | affordability/"on track", all emotional, all multi-domain, ROI-education                                         |

**Headline:** **fewer than ~5% of decisions get FRAMED to an elite (A) standard.** Roughly half land at
competent intake (B), and roughly half deflect (C) — and the C half is concentrated on exactly the
multi-domain and emotional scenarios where decision quality matters most. By scenario _count_, the advisor is
an intake bot on ~95% of canonical decisions and a trusted advisor on a handful of clean financial ones.

> Note the asymmetry with question quality: the advisor's _best questions_ are genuinely elite (~10–15% reach
> HIGH per the question analysis), but _framing_ — the act of structuring the decision around its tradeoff — is
> rarer still (~5%), because a single HIGH question is necessary but not sufficient for a framed decision. You
> can ask a sharp question and still never name the A-vs-B fork. That gap — sharp questions, unframed decisions
> — is the core decision-quality finding.

## 5. Decision-quality verdict

The advisor **discovers but does not structure.** It almost never frames a decision into its real tradeoff, it
surfaces the deciding tradeoff only by accident (when its one input happens to be the pivot variable), and it
rarely leaves the user knowing the next concrete step (by design — discovery, not advice). **Under ~5% of the
100 canonical decisions reach elite framing; ~half are competent intake; ~half deflect** — with the deflections
piled exactly on the multi-domain and emotional decisions that most demand an advisor who can hold the whole
picture.

This is the audit's "leans B" finding made quantitative: **decision quality is the gap between the advisor's
already-elite question-asking and the un-built act of framing the decision around the one tradeoff that
decides it.** The ability exists in fragments (the down-payment reframe, the numeric mirror); the missing
layer is confident cross-turn context plus permission to _name the fork_ — the two ingredients framing
requires and the corpus shows the advisor lacks.
