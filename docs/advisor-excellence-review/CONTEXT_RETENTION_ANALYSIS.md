# Context Retention Analysis

> **Analysis only — no fixes, no code, no prompt changes.** This evaluates advisor **quality**, not safety.
> Grounded in `ADVISOR_QUALITY_AUDIT.md` (the keystone). The LifeNavigator findings are from the **real live
> corpus** (the ~40 advisor replies + the decisions probe + measured telemetry). The ChatGPT/Claude/ideal
> columns are **reasoned reference estimates, labeled as such** — not measured here.

## 0. The question

Does a session feel like **continuing a relationship** or **starting over every turn**? A great advisor's
defining property across a conversation is _continuity_: they remember what you told them five minutes ago, they
don't make you re-explain, they build on your last answer, and the session accumulates into understanding. The
opposite — re-asking for context the user just gave — is the signature of _intake_, not _counsel_.

## 1. The headline finding

**On the specifics, it feels like starting over.** The single most damning live measurement: **0/10 decision
turns reused a number the user stated in a prior turn** (audit §2, §3). The audit calls cross-turn context loss
_"the biggest drag"_ on the Context-use dimension (scored **4/10**, §3). The felt experience is that each turn
begins from near-zero on the _details_ the user already supplied.

But the honest picture is a **split**, and the split is the whole point of this document:

> **The deterministic spine remembers the STRUCTURE. The conversational layer forgets the SPECIFICS.**

- **Deterministic layer (retained, reliably):** goals, the user's vision/north-star, and — notably —
  **rejected goals are suppressed deterministically.** These persist across turns because they live in
  durable state the advisor reads each turn, not in the conversational thread.
- **Conversational layer (not retained):** the _specific things the user just said this session_ — "I want to
  buy a house in the next year," "$120k income," "$60k saved," "I'm a teacher," "I'm going through a divorce."
  The advisor builds a **bounded context per turn** and that bounded context does not thread the session's
  stated specifics into the next turn. Same-message specifics work (post-fix); cross-turn specifics do not.

So: the _skeleton_ of who-you-are is remembered; the _flesh of this conversation_ is not. The result is a
session that is structurally coherent but conversationally amnesiac — which reads, to the user, as "starting
over," because users experience continuity through the specifics, not the schema.

## 2. The live evidence (verbatim, grounded)

The corpus contains the two telling exhibits:

- **The marquee failure — re-asking for stated context.** _"Can I afford it?"_ — and the user had **just said
  "buy a house in the next year."** Reply: _"Understanding what 'it' refers to will help us identify your
  primary objective"_ (audit §2). The advisor asked the user to re-explain the thing they had stated one turn
  earlier. This is the purest possible "starting over" moment: not a missed nuance, but a literal request to
  repeat just-given information. Per audit §2 this is filed under _"ignored stated context; asked the user to
  re-explain."_

- **Context unused on a rich setup.** _"Am I on track?"_ (user context: teacher, modest salary, wants to retire
  comfortably) → _"what's your personal definition of 'on track'?"_ (audit §2). The situation was rich and the
  reply was generic — the prior context didn't shape the question.

- **The post-fix contrast (what DOES work).** When the numbers are in the _same message_, the advisor uses
  them: _"with your $120k income and $60k in savings, you're considering a $450k house and wondering about its
  affordability"_ (audit §2). This proves the capability exists **within a turn** — the limitation is
  specifically the **crossing of the turn boundary.** Same-message context works; cross-turn does not.

The measured line that anchors all of this: **"0/10 used a number the user stated a prior turn"** (audit §2).
Ten chances to demonstrate cross-turn memory of a concrete figure; zero taken.

## 3. Retention by category (grounded split)

What gets remembered vs. forgotten, and which layer carries it:

| What                                  | Retained?                             | Layer          | Evidence                                                                   |
| ------------------------------------- | ------------------------------------- | -------------- | -------------------------------------------------------------------------- |
| **Previous goals**                    | Partially — as durable goal state     | Deterministic  | goals persist; but the _just-stated_ "house in a year" was lost (audit §2) |
| **Constraints** (income, savings)     | **No, cross-turn**                    | Conversational | 0/10 prior-turn numbers reused (audit §2)                                  |
| **Family obligations**                | **No**                                | Conversational | divorce context dropped → vision deflection (audit §2, §4)                 |
| **Prior decisions**                   | **No (cross-turn)**                   | Conversational | bounded per-turn context doesn't carry the thread                          |
| **Rejected goals**                    | **Yes — reliably**                    | Deterministic  | rejected-goal **suppression works deterministically**                      |
| **Preferences / tone-relevant facts** | **No** (e.g., "I'm a teacher" unused) | Conversational | "Am I on track?" got a generic reply (audit §2)                            |
| **Vision / north-star**               | **Yes**                               | Deterministic  | persists; in fact _over_-used (vision-deflection, §2)                      |

The pattern is consistent: **anything that lives in durable structured state survives; anything that lives only
in what-the-user-just-typed evaporates at the turn boundary.** The one item worth highlighting on the positive
side is **rejected-goal suppression** — if a user rejected a goal, the advisor does not re-raise it. That is
genuine, deterministic memory, and it is exactly the kind of "I heard you and I'll respect it" continuity that
_should_ make a session feel like a relationship. It just operates on the structural layer, invisibly, rather
than on the conversational specifics the user actually feels.

## 4. Why it feels like "starting over" (mechanism, not blame)

The architecture builds a **bounded context per turn.** Each turn assembles a fresh, size-limited context: the
durable structured state (goals, vision, rejected goals) plus the current message. What it does _not_ reliably
include is the _running transcript of the session's stated specifics_ — so the income the user mentioned two
turns ago, the "house in a year," the "I'm a teacher," are not present to shape the next question.

The consequence is a peculiar asymmetry the user feels but can't name:

- The advisor never re-raises a goal you rejected (deterministic memory working) — so it isn't _obviously_
  goldfish-brained.
- Yet it re-asks what "it" refers to right after you said it (conversational amnesia) — so it _clearly_ isn't
  listening either.

This inconsistency may actually be _worse_ for the felt relationship than uniform forgetting: it remembers
exactly the things you can't see it remembering, and forgets exactly the things you watched yourself say. The
audit's Context-use score of 4 and the verdict that cross-turn loss is _"the biggest drag"_ (§3) capture the net
effect: structurally present, conversationally absent.

## 5. Contrast: ChatGPT / Claude (reasoned estimate — NOT measured)

> Labeled estimate, per the honesty rule. Reflects known characteristics of unconstrained assistants, not
> measurements taken in this audit.

Unconstrained chat assistants carry the full session transcript in-context by default. Tell them your income,
savings, and "house in a year" across three turns, then ask "can I afford it?" — and the likely reply uses all
of it without being reminded, because the whole conversation is in the window. They _feel_ continuous because
they retain the specifics natively. (Their weakness is the inverse of LifeNavigator's strength: they have no
deterministic, durable notion of a _rejected goal_ that persists beyond the window — they'll happily re-raise
something you dismissed once it scrolls out of context. But within a session, on specifics, they feel like a
continuing relationship and LifeNavigator does not.)

So the honest competitive read: **on within-session specific recall, the competitors win clearly today;** on
**durable structural memory (rejected goals, north-star) across sessions,** LifeNavigator's deterministic spine
is arguably _more_ reliable — it just doesn't surface as conversational continuity where the user feels it.

## 6. Verdict

**It feels like starting over on the specifics — even though the deterministic spine remembers the structure.**
The split is real and important: goals, vision, and rejected-goal suppression persist deterministically (genuine
memory, working), but the bounded per-turn context does not thread the session's _stated specifics_ — income,
savings, the just-named goal, family situation — into the next turn. The live proof is unambiguous: **0/10
prior-turn stated numbers reused,** and a "Can I afford it?" that ignored a just-stated "buy a house in the next
year" and asked the user to re-explain.

Because users experience continuity through the specifics they hear themselves say, the structural memory is
_invisible_ and the conversational amnesia is _vivid._ That asymmetry makes the session feel like intake — the
advisor that makes you repeat yourself — even while it is quietly honoring your rejected goals. **This is one of
the top reasons the advisor feels like intake, not counsel** (audit §1). No fixes here; the remedy belongs to
the gap report and roadmap.
