# Personalization Audit — LifeNavigator (20-person elite PILOT)

**Verdict:** The _substance_ engine is genuinely personalized and trustworthy (data-grounded advisor, persona-aware recommendations, cross-domain "My Life" aggregation) — but the _surface_ is anonymous: no name in conversation, no time-of-day, no "we noticed X" proactive moments. **Score: 6.5/10** — strong inference, weak theater. The "I didn't expect it to know that" moments exist in the data but are never _said out loud_.

Sprint north star reminder: manufacture repeated moments where the user says "I didn't expect it to know that." Today the product _knows_ a lot and _surfaces_ almost none of it unprompted.

---

## 1. Where the product demonstrably "knows" the user (strongest 3, cited)

### A. The advisor reasons from the user's _own numbers and prior turns_ — and a calculator enforces it

`apps/lifenavigator-core-api/app/services/advisor_context.py:344-348` builds `allowed_numbers` from THIS message **plus** the last 6 turns' user messages, so a figure stated two turns ago is still "theirs":

```python
hist = list(history or [])[-6:]
prior_user_msgs = [str(h.get("user") or "") for h in hist]
allowed_numbers = numbers_in(message, *prior_user_msgs, *cands, *risks, *opps, *cons, panel.get("life_vision"))
```

The system prompt then forces the model to _prove it listened_ — Section 3 "WHAT WE KNOW" must restate the user's facts in their own words (`advisor_llm.py:52-53`), and a deterministic validator discards any reply containing a number the user never gave (`advisor_llm.py:73-79`). This is real, defensible "it knows my situation."

### B. Persona + real-account recommendation engine (genuinely tailored, no model call)

`apps/web/src/lib/finance/recommendations.ts:135-249` (`computeMetrics`) derives `isFragile`, `isSelfEmployed`, `bonusEligible`, `isVariableIncome`, `runwayMonths`, `worstApr` from the user's **persisted** `financial_accounts` + `transactions` + `user_persona_profile`. The assembly logic (`:530-643`) then branches hard: a fragile persona gets `stabilizeRec` (never "invest the surplus"); a self-employed user gets a tax set-aside _range_ (`taxSetAsideRec :295-313`); a bonus-eligible W-2 user with a detected lump deposit gets `bonusAllocationRec :315-332`. The detail strings interpolate the user's actual cash, APR, and runway. This is the single most personalized surface in the product.

### C. Cross-domain "My Life" aggregation with provenance and honest gating

`apps/lifenavigator-core-api/app/services/my_life.py:81-207` composes one life-OS view: vision, what-matters-most, readiness across domains, next-best-action — each tagged with its source. Critically it _refuses_ to present generic archetype risks as personalized: `:102-108` keeps only recommendation-engine-grounded risks/opps and drops `GENERIC_RISK_OPP_LABELS`. The provenance ladder (`:118-141`: `user_confirmed > user_stated > advisor_inferred > assumption`) means the UI can show "inferred from your onboarding" rather than faking a confirmed north star. `ExecutiveSummary.tsx:180-206, 241-269` honors this with honest empty states.

---

## 2. Where it falls back to generic template content (5 worst offenders, cited)

### Offender #1 — The dashboard greeting is fully anonymous and time-blind

`apps/web/src/components/dashboard/DashboardClient.tsx:530-535`:

```tsx
<h1 ...>Welcome back, {userName}!</h1>
<p ...>Here's your life overview for today</p>
```

`userName` is `user_metadata?.name || user.email || 'User'` (`:247`). No time-of-day, no reference to anything that changed since last visit, no hook. Worst case shows **"Welcome back, user@email.com!"** A grep confirms `getHours`/`morning`/`afternoon` appear **nowhere** in `components/dashboard` or `app/dashboard` except `calendar/page.tsx`. This is the first thing every pilot user sees and it says nothing.

### Offender #2 — The advisor literally cannot say the user's name

`apps/lifenavigator-core-api/app/models/common.py:20-24`: `UserContext` carries only `user_id`, `email`, `role`. The name is never plumbed to the advisor, and `ADVISOR_SYSTEM` (`advisor_llm.py:34-160`) never mentions a name, greeting, or salutation. An "elite family-office partner" (its own self-description, `:34-37`) that never once addresses you by name reads as a form, not a person.

### Offender #3 — Persona onboarding is a static 5-card menu disconnected from the data engine

`apps/web/src/components/onboarding/PersonaSelection.tsx:27-60` hardcodes five archetypes ("Career Professional", "Lifelong Learner", "Balance Seeker", "Financial Optimizer", "Wellness Enthusiast") with fixed descriptions any user sees identically. Meanwhile the _real_ persona system (`user_persona_profile` consumed at `recommendations.ts:657-661`) uses `persona_id`, `income_type`, `life_stage`. The onboarding picker and the engine speak different languages — the user self-selects a label that the recommendation engine never reads.

### Offender #4 — Domain sub-pages show identical boilerplate "unlocks" lists to everyone

`apps/web/src/app/dashboard/education/page.tsx:22-28` (`EDUCATION_UNLOCKS`) and `career/page.tsx:39-46` (`CAREER_UNLOCKS`) are static arrays rendered for every user regardless of state. The "Related recommendations" / "Related documents" panels (`education/page.tsx:130-153`) are pure placeholder copy ("appear once your goal and records are in place"). The shared `DomainOverview`/`CoverageModel` framework is honest (no fake data — good), but it's a _uniform shell_ with the same missing-input prompts for every user.

### Offender #5 — "Recent Intelligence" feed exists in the API but isn't surfaced as a "we noticed" moment

`my_life.py:209-227` builds a real, timestamped feed (objectives discovered, recommendations, tool runs) — exactly the raw material for "I didn't expect it to know that." But `ExecutiveSummary.tsx` (the my-life consumer) never renders `recent_intelligence`; it's computed and dropped. The platform assembles its memory and then hides it.

---

## 3. Cross-domain awareness — does finance advice reflect family/health, etc.?

**Partially, and only inside two systems.**

- **Recommendations engine (strong, but finance-only):** `recommendations.ts` does cross-_situation_ reasoning — `insuranceRec :421-434` fires only when `isFamily` + a mortgage exists ("with dependents and a $X mortgage... term life before extra payments"); `retirementStartRec :365-368` reframes for families ("saving for the family, but nothing to your own retirement"). But this is all derived from the _finance_ persona/accounts; it does not read the health or career domains.
- **My Life / readiness (genuinely cross-domain):** `my_life.py:158-166` pulls a cross-domain readiness assessment, and constraints aggregate from readiness gaps + discovery health across domains (`:190-197`).
- **Advisor (gated to the persisted graph):** the advisor CAN connect goals across domains, but ONLY if a real `life_graph_edge` exists (`advisor_context.py:151-193`, `advisor_llm.py:115-124`). With no edges it is explicitly forbidden from claiming connections. Correct for trust, but means most pilot users (sparse graphs) get **siloed** advice.

**Net:** finance↔family is wired; health↔finance, career↔finance, education↔finance are **siloed** unless the user's life graph happens to have the edge. The single most valuable cross-domain line — "you have a kid and a mortgage but no term life" — only fires because finance persona encodes `isFamily`, not because health/family domains talk to finance.

---

## 4. Memory / continuity across sessions — the mechanism

**Within a conversation: yes, real.** `advisor_orchestrator.py:204-221` (`_fetch_history`) reads the last 6 turns from `analytics.advisor_turns` scoped by `user_id` AND `conversation_id`, feeds them into context (`advisor_context.py:328-372`), and the prompt forbids restarting (`advisor_llm.py:68-71`: "NEVER start over. NEVER ask for something already given"). Every turn is persisted (`advisor_orchestrator.py:414-418`).

**Across sessions / across days: weak.** History is keyed to `conversation_id`, and the advisor page **mints a fresh `conversationId` on every page load** (`apps/web/src/app/dashboard/advisor/page.tsx:59-63`). So a returning user starts a brand-new thread — the cross-turn memory resets between visits. The canonical _facts_ persist (life graph, objectives, accounts), so the advisor re-derives context, but it never says "last week you told me…". There is no surfaced episodic memory ("when you were here on Tuesday you were weighing X").

---

## 5. Top 5 "I didn't expect it to know that" opportunities (cheap, buildable from existing data)

> Ranked by impact/effort. Every one is grounded in data already persisted — no new pipeline, no model call.

### Opportunity #1 — Time-aware, fact-aware greeting (½ day)

Replace `DashboardClient.tsx:531-535` with a greeting that pulls one _true, specific_ fact already loaded on the dashboard: the top recommendation's metric or the `next_best_action`. e.g. _"Good evening, Tim — your $14k idle cash is still the biggest lever on your plan."_ Data is already in `getFirstInsight` (`first-insight.ts:42-51`) and `/api/life/my-life` `next_best_action`. Add `getHours()` + interpolate the existing metric.

### Opportunity #2 — Surface the "Recent Intelligence" feed as a "Since you were last here" strip (½ day)

`my_life.py:209-227` already returns timestamped objectives/recs/tool-runs. Render it in `ExecutiveSummary.tsx` (currently dropped) as _"Since your last visit: we discovered your objective 'fund the kids' college', and 2 new recommendations unlocked."_ Pure UI work on an existing payload — this is the cheapest direct hit on the north star.

### Opportunity #3 — Persist + reference cross-session episodic memory (1 day)

Stop minting a fresh `conversationId` on every load (`advisor/page.tsx:59-63`); persist the last `conversation_id` per user (localStorage or a `user_persona_profile` column) so `_fetch_history` (`advisor_orchestrator.py:204-221`) threads across visits. Then the advisor can open with _"Last time we were weighing renting vs buying — did you decide?"_ The retrieval mechanism already exists; only the id lifecycle blocks it.

### Opportunity #4 — Say the family↔finance connection out loud, proactively (½ day)

`recommendations.ts` already _computes_ `isFamily` + `mortgageBalance` and fires `insuranceRec`. Promote that one line to a dashboard "we noticed" callout: _"You have dependents and a $420k mortgage but no term-life coverage on file — that's the biggest unhedged risk in your plan."_ The detection (`recommendations.ts:421-434`) is done; it's currently buried in slot 2 of a list instead of being a headline surprise.

### Opportunity #5 — Echo a number the user gave the advisor back on a _different_ surface (1 day)

The advisor captures user figures into `allowed_numbers` and persists turns (`advisor_orchestrator.py:414`). Read the most recent stated figure and reflect it where the user wouldn't expect it — e.g. the finance page or greeting: _"You mentioned wanting ~$2M to retire by 55 — at your current savings rate you're tracking to ~$1.4M."_ The hard part (capturing the number with provenance) is already built; the surprise is showing it somewhere other than the chat it was said in.

---

## What's genuinely excellent (don't touch)

- **The trust spine.** The validator + `allowed_numbers` + provenance gating (`advisor_context.py`, `my_life.py:102-141`) means the product is _honestly_ personalized — it never fabricates a fact to feel smart. This is the foundation the "uncanny" moments must sit on; the NO-MOCK-DATA rule is upheld everywhere I read.
- **The persona-aware recommendation engine** (`recommendations.ts`) is best-in-class deterministic personalization: debt-before-invest gating, fragile-persona stabilization, self-employed tax set-asides, compliance-clean language enforced by tests. This is real "it knows me."
- **`my_life.py` cross-domain composition with provenance** — organizing around the user's life, not the architecture, with honest "still forming" states.
- **The advisor reveal cards** (`advisor/page.tsx:454-488`, "✨ Here's what I just learned" + confidence %) and the live "What I know so far" panel (`:684-721`) — these are the _one place_ the product currently performs its knowing, and they're well done. The pattern just needs to escape the advisor page.

---

## Bottom line for the pilot

The data and inference are pilot-ready and trustworthy. The _experience of being known_ is not — it whispers its intelligence inside the advisor chat and goes silent everywhere else. For 20 elite users, the cheapest, highest-impact sprint is **surfacing what the system already knows, proactively, on the surfaces users actually land on** (greeting, executive summary, returning-visit strip) — Opportunities #1, #2, #4 alone are ~1.5 days and would manufacture the north-star moment on every login.
