# Tradeoff Discovery Analysis

> **Analysis only — no fixes, no code, no prompt changes.** This evaluates advisor **quality**, not safety.
> Grounded in `ADVISOR_QUALITY_AUDIT.md` (the keystone). The LifeNavigator findings are from the **real live
> corpus** (the ~40 advisor replies + the decisions probe). The ChatGPT/Claude/ideal columns are **reasoned
> reference estimates, labeled as such** — not measured here.

## 0. The question

Can the advisor _uncover competing priorities_ — the tensions that actually make a life decision hard?
Specifically:

- **Time vs money** (work more to earn vs. reclaim hours)
- **Family vs career** (relocate/promote vs. stay near aging parents/kids)
- **Risk vs opportunity** (safe job vs. the startup; bonds vs. equities)
- **Short-term vs long-term** (buy the house now vs. fund retirement)
- **Certainty vs upside** (the guaranteed offer vs. the bigger maybe)

A great advisor's signature move is to _name the tradeoff the user is living inside but hasn't articulated._
That is the single most "I'm talking to someone wise" moment a counsel session produces. It is precisely the
move LifeNavigator almost never makes.

## 1. The headline finding

**Tradeoff discovery is a major gap.** In the live corpus the advisor **rarely surfaces a tradeoff
proactively.** Its design is to ask exactly ONE discovery question per turn (good discipline, per audit §2),
and that one question is almost always a _single-axis_ probe — it deepens one variable rather than naming the
_tension between two_. The audit scores **Tradeoff detection at 4/10** (§3), with the justification: _"can on a
cited multi-goal graph; usually doesn't proactively surface competing priorities."_ That justification is the
whole story of this document.

The advisor _can_ frame a tradeoff — but only under a narrow structural condition: **a real, cited graph edge
must already connect two of the user's goals/constraints.** This is the citation contract. The advisor will
not assert "your house goal competes with your retirement goal" unless a graph edge says so, because the trust
spine forbids inventing the conflict. And here is the structural trap:

> **Fresh users have an empty (or near-empty) graph.** No edges → no cited tradeoffs → the advisor has nothing
> it is _permitted_ to surface. So in practice, for exactly the users who most need help mapping their first
> hard decision, proactive tradeoff discovery is effectively **off**.

So the honest answer is a layered "mostly no":

- **No** proactively, for fresh users (the common case) — empty graph, citation contract blocks assertion.
- **Sometimes**, only when the _user themselves states both sides in one message_ (same-message context works
  post-fix per audit §2) — then the advisor can reflect the tension back.
- **Yes, and well**, in the rare case where a cited multi-goal edge exists — but this is the exception, and it
  arrives late in a relationship the advisor mostly doesn't sustain (see `CONTEXT_RETENTION_ANALYSIS.md`).

## 2. The one real strength — do not lose it

When the advisor _does_ frame a tradeoff, **it is grounded.** It will not fabricate a conflict that isn't
there. The citation contract that blocks it on fresh users is the same contract that guarantees: if it says
"these two priorities pull against each other," a real edge backs that claim. The audit's trust findings (0
trust violations, 0% fallback, §0) extend here — there is **no observed case of an invented tradeoff.**

This matters because the failure mode of unconstrained assistants is the opposite: they will confidently
narrate a tradeoff that may not apply to this user at all (see §4). LifeNavigator's tradeoffs, when they
appear, are _true_. The gap is purely one of **coverage and proactivity**, not correctness. That is a far
better problem to have — it means the work is "surface more of what's real," not "stop making things up."

## 3. Per-tradeoff-type assessment (grounded)

For each axis: can the live advisor find it? Evidence from the corpus, then the honest verdict.

### Time vs money — **mostly NO**

Nothing in the corpus surfaces an hours-vs-earnings tension. The closest decision-relevant probes ("how stable
do you feel in your current income?" for emergency fund, §2) deepen the _money_ axis alone; _time_ never enters
as a competing good. There is no graph concept that natively represents "hours of life" as a goal to weigh
against income, so even the cited-edge path can't reach this one. **Verdict: structurally absent.**

### Family vs career — **mostly NO (the most painful miss)**

This is where the gap reads worst. On _"What should I prioritize?"_ (user context: divorce) the advisor
deflected to vision: _"what would need to be true for you to feel truly successful and content?"_ (audit §2).
A divorce is _the_ family-vs-everything moment, and the advisor did not name family, career, or any tension —
it asked an abstract life-vision question on a concrete, painful one (audit §4 calls this _"jarringly
intake-y… reads as tone-deaf"_). It could only frame family-vs-career if a cited edge linked a family
constraint to a career goal — which a fresh/low-data user does not have. **Verdict: the highest-stakes axis,
and the advisor is weakest exactly here.**

### Risk vs opportunity — **NO, unless user states both sides**

_"Should I invest or pay off debt?"_ → _"what kind of debt are you considering?"_ (audit §2). That is a genuinely
good first cut (it gates on a real decision input), but it is **not a tradeoff frame** — it doesn't say "this is
a guaranteed return vs. an uncertain one." The risk/opportunity tension is implicit in the domain and the
advisor declines to name it. **Verdict: probes the input, doesn't frame the tension.**

### Short-term vs long-term — **NO proactively; the marquee miss is here**

The clearest evidence: _"Can I afford it?"_ (user had said "buy a house in the next year") → _"Understanding
what 'it' refers to will help us identify your primary objective"_ (audit §2). A house-in-12-months sitting
beside any retirement/savings goal is the textbook short-vs-long tradeoff — and the advisor not only failed to
frame it, it failed to even _retain the stated goal_ (cross-turn context loss, 0/10 prior-turn numbers reused,
audit §2). When the same numbers are same-message it can reflect them (_"with your $120k income and $60k in
savings… a $450k house"_, §2) — but reflecting figures is not framing a time-horizon tradeoff. **Verdict: the
single best opportunity in the corpus to surface a tradeoff, missed.**

### Certainty vs upside — **NO**

No corpus instance frames a guaranteed-vs-bigger-maybe choice (e.g., safe offer vs. startup equity). The
decision probe spans promotion/change/layoff/relocation (audit §4) — fertile ground for this axis — yet the
replies probe one variable at a time. **Verdict: absent.**

**Summary table (grounded LifeNavigator; estimates labeled):**

| Tradeoff axis           | LifeNavigator (live)   | Why                                      | ChatGPT/Claude (est.)     | Ideal CFP/coach (est.)           |
| ----------------------- | ---------------------- | ---------------------------------------- | ------------------------- | -------------------------------- |
| Time vs money           | Mostly no              | no graph concept for "time as a good"    | Yes — names it unprompted | Yes, with structure              |
| Family vs career        | Mostly no (worst miss) | needs cited family↔career edge; deflects | Yes, richly               | Yes — the core of the craft      |
| Risk vs opportunity     | No (probes input only) | asks the input, won't frame the tension  | Yes                       | Yes, quantified                  |
| Short-term vs long-term | No (marquee miss)      | loses the stated goal cross-turn         | Yes                       | Yes — horizon framing is routine |
| Certainty vs upside     | No                     | not in corpus; one-axis probes           | Yes                       | Yes                              |

## 4. Contrast: ChatGPT / Claude (reasoned estimate — NOT measured)

> Labeled estimate, per the honesty rule. These reflect known characteristics of unconstrained assistants, not
> measurements taken in this audit.

Unconstrained assistants surface tradeoffs _unprompted and richly._ Ask ChatGPT/Claude "can I afford a house?"
and the likely reply lays out the whole tension lattice: liquidity vs. down-payment size, monthly payment vs.
retirement contributions, the opportunity cost of the cash, rate risk, the "house-poor" failure mode — often
as a structured list, in one turn. They will name family-vs-career on a relocation question without being asked.

The audit's thesis (§5) explains _why_ this looks smarter and _why it is also riskier:_ these tools are
**unconstrained — they frame the whole decision and surface tradeoffs even when ungrounded.** That is their
edge and their flaw. They may narrate a tradeoff that doesn't apply to _this_ user (they don't know the user's
real goals/edges), trading correctness for vividness. LifeNavigator made the opposite bet: only true
tradeoffs, but far fewer of them. The felt result — per audit §1 — is that the competitor "feels like an
advisor" while LifeNavigator "feels like intake," even though LifeNavigator's claims are the trustworthy ones.

The honest competitive read: **LifeNavigator is correct-but-quiet; the competitors are vivid-but-unverified.**
On _proactive tradeoff discovery as an experience_, the competitors win decisively today; on _trustworthiness
of any tradeoff stated_, LifeNavigator wins.

## 5. Root causes (structural, not incidental)

Three reinforcing constraints make this a _structural_ limit, not a bug:

1. **The citation contract.** A tradeoff is an assertion about a relationship between two of the user's
   priorities. The trust spine requires a real cited graph edge before any such relational claim. No edge → the
   advisor is _not permitted_ to name the tension. (This is why tradeoff detection scored only 4 _despite_ the
   "can on a cited multi-goal graph" capability — the capability is gated.)
2. **Empty graphs for fresh users.** The graph is often empty for new users (program reality). The exact users
   facing their first hard decision have the fewest edges, so the cited-edge path that _would_ enable tradeoff
   framing is closed for them. The capability exists where it's least needed and is absent where it's most needed.
3. **The one-question discipline.** Each turn asks exactly one question (audit §2/§3, a deliberate, trust-
   positive choice). A single question naturally deepens a single axis; _naming a tension_ wants to hold two
   axes in view at once. The discipline that earns trust structurally discourages the two-sided frame.

Add the cross-turn context loss (0/10 prior-turn numbers reused, audit §2) and even the user-states-both-sides
escape hatch is fragile: if the two sides are stated across two turns, the advisor won't have both in view.

## 6. Verdict

**Tradeoff discovery is a major gap — and it is structurally limited, not accidental.** The advisor almost
never surfaces competing priorities proactively, because the three constraints compound: the citation contract
forbids un-edged relational claims, fresh users have no edges, and the one-question discipline favors single-
axis probes. Per-axis, the honest answer is "mostly no" everywhere, with the most painful misses on
**family-vs-career** (divorce → vision deflection) and **short-term-vs-long-term** (house-in-12-months → "what
does 'it' refer to?").

The one genuine strength is the flip side of the gap: **every tradeoff it does name is grounded** — it will
not invent the conflict. The work this analysis points to (no fixes here — see the gap report and roadmap) is
therefore "surface more of what's real," the better of the two possible problems. But as experienced today,
on the move that most makes a session feel like wise counsel, the advisor is near-silent — a primary reason the
audit's core verdict (§1) lands on **"intake, not counsel."**
