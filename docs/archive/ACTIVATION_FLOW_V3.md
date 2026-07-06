# ACTIVATION FLOW V3

**Date:** 2026-06-04
**Target:** Time-to-First-Value **< 5 minutes** (from landing → first money-relevant insight).
**Spine:** Visitor → Learn → Register → Select Life Scenario → Activate Financial Profile → Dashboard → First Insight → First Recommendation → First Conversation → Return.
**We already built** the persona activation that powers steps 4–8 (sample profile → finance data → graph → recommendation). The flow's job is to make it feel inevitable and fast.

> Design rule: **defer the heavy 10-section onboarding.** The current "Set up LifeNavigator" intake is a TTFV killer. Replace the first run with _pick a sample life → see value_, and collect deeper data progressively, after the wow.

---

### Step 1 — Visitor (landing)

- **Purpose:** establish category + desire in 15s; route to the lowest-risk next step.
- **Emotion:** curious, slightly skeptical ("another AI app?").
- **Confusion risk:** "what is this / is it for me / will it want my bank?"
- **Success:** clicks `Request access` or `Explore a sample profile`.
- **Failure:** bounce. Mitigate with the hero "brief" proof + the sample-profile path (look without committing).
- **UI:** V3 hero (LANDING_PAGE_V3) + trust ribbon + one CTA.

### Step 2 — Learn (optional, fast)

- **Purpose:** for the deliberate visitor — show _how it thinks_ + that beta uses **sample** data.
- **Emotion:** evaluating, building trust.
- **Confusion risk:** over-explaining → leaving. Keep it skimmable.
- **Success:** reaches a CTA with trust intact.
- **Failure:** rabbit-holes in docs. Mitigate: every section ends in the same CTA.
- **UI:** AI Architecture diagram + Trust/Security band; sticky CTA.

### Step 3 — Register

- **Purpose:** create an account with **minimum friction**.
- **Emotion:** mild commitment anxiety.
- **Confusion risk:** long forms, email verification dead-ends, "why do you need this?"
- **Success:** account in < 30s (email + password or OAuth), landed on Step 4 immediately.
- **Failure:** form errors, unverified-email limbo, redirect loops. Mitigate: 1-screen form, OAuth, optimistic redirect, resend-verify inline.
- **UI:** single calm card, name optional, "2 minutes to your first brief" reassurance, no marketing.

### Step 4 — Select Life Scenario (the persona dropdown)

- **Purpose:** let the user pick the life closest to theirs → instant relevance, zero data entry.
- **Emotion:** "oh, this is about _me_"; playful.
- **Confusion risk:** "is this real? am I lying about my finances?" → reframe as _sample/explore_.
- **Success:** picks a profile (Young Professional, Married Family, Executive…) and clicks **Activate**.
- **Failure:** decision paralysis (too many), or "none fit me." Mitigate: a recommended default highlighted, short descriptions + goals + a one-line "what you'll see."
- **UI:** the existing `/onboarding/financial-profile` step — dropdown + description + goals + complexity + the beta & safety copy ("explore without connecting real accounts").

### Step 5 — Activate Financial Profile

- **Purpose:** stand up real (sandbox) financial data + persona metadata + graph promotion behind a single tap.
- **Emotion:** anticipation; "is it working?"
- **Confusion risk:** a blank wait → doubt. The activation does a lot (token, accounts, transactions, metadata, graph enqueue).
- **Success:** ~3–5s → redirect to a populated dashboard; toast: "Your office is set up."
- **Failure:** Plaid/Supabase hiccup → friendly retry, never a stack trace. (We added graceful 503/error copy.)
- **UI:** a _designed_ "Setting up your office…" state with 3 reassuring micro-steps ("Reading your accounts… Building your financial picture… Preparing your first brief"), each ticking to done — NOT a spinner.

### Step 6 — Dashboard (first paint)

- **Purpose:** deliver the "calm command surface" — one headline insight + supporting cards + one next action.
- **Emotion:** "whoa, it already knows my situation."
- **Confusion risk:** widget overload / empty panels. Avoid a metrics wall.
- **Success:** within seconds the user reads a true sentence about _their_ (sample) finances.
- **Failure:** empty/loading dashboard, or data that looks generic. Mitigate: server-render the first insight; never show a bare grid.
- **UI:** DESIGN_SYSTEM dashboard — hero insight card, 3 cards (cash-flow, balance sheet, a flag), one CTA ("See your first recommendation").

### Step 7 — First Insight ⟵ **this is the < 5-min value moment**

- **Purpose:** a single, specific, true observation about the user's money ("You're holding 4 months of runway and carrying a 22% APR balance — paying it down beats your savings rate").
- **Emotion:** _"Wow, I need this."_
- **Confusion risk:** generic tip → "meh." It must reference _their numbers_.
- **Success:** the user nods / screenshots / clicks "tell me more."
- **Failure:** vague advice. Mitigate: insight templates bound to real figures (we have the data + persona metadata).
- **UI:** the hero "brief" card, with a quiet "why →" (why-chain).

### Step 8 — First Recommendation

- **Purpose:** turn the insight into an action with a trade-off + confidence.
- **Emotion:** trust deepening ("it reasons, it's not just describing").
- **Confusion risk:** feels like financial advice/liability. Mitigate with governed/educational framing + "what would change this."
- **Success:** user accepts/saves a recommendation or asks a follow-up.
- **Failure:** model 429/503 → retry (we added Gemini retry). Never a dead end.
- **UI:** recommendation card: action · trade-off · confidence range · `why` · `ask about this`.

### Step 9 — First Conversation

- **Purpose:** let the user _talk to their office_ and feel it remembers everything.
- **Emotion:** delight + ownership.
- **Confusion risk:** blank chat box (what do I ask?). Mitigate with seeded prompts tied to their data ("Should I refinance?", "Can I afford a $30k car?").
- **Success:** one governed round-trip returns a grounded, persona-aware answer (verdict APPROVE, audited).
- **Failure:** slow/empty answer. Mitigate: streaming, retries, seeded prompts.
- **UI:** the governed chat with 3 suggested, data-specific starters.

### Step 10 — Return Visit

- **Purpose:** create a reason to come back tomorrow → habit.
- **Emotion:** "what does my office have for me today?"
- **Confusion risk:** nothing new → churn.
- **Success:** a fresh daily brief / a changed number / a nudged decision; optional email/push "Today's brief."
- **Failure:** static dashboard. Mitigate: a daily-brief generator + 1 change-detector ("your runway moved").
- **UI:** "Today's brief" at top on return; a lightweight notification with one insight.

---

## Time budget (must total < 5 min)

| Step                      | Target        |
| ------------------------- | ------------- |
| Land → decide             | < 30s         |
| Register                  | < 45s         |
| Select scenario           | < 45s         |
| Activate                  | < 10s         |
| Dashboard + first insight | < 60s         |
| First recommendation      | < 30s         |
| **Total to value**        | **≈ 3.5 min** |

## The single biggest activation change

**Cut the 10-section intake out of the critical path.** Today, registration → "Set up LifeNavigator" (10 sections) buries value behind ~30+ minutes of data entry. V3: registration → _pick a sample life_ → value in minutes; collect real data **progressively** (one prompt at a time, after the user is hooked).
