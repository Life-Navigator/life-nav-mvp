# Executive Demo Audit — LifeNavigator

**Date:** 2026-06-16
**Scope:** Live 15–30 min demo to a skeptical VC / family-office principal during the pilot.
**Method:** Code-level read of `apps/web/src` (entry points, persona seeding, advisor, dashboard, life-graph, recommendations, reports) + live probe of the Fly Core API. No mock data tolerated.

---

## 1-line verdict + score

**Verdict:** A genuinely impressive product hides behind one fragile, slow surface (the advisor LLM chat that gates the whole flow). If you demo the _deterministic_ surfaces and treat the advisor as a scripted side-trip — not the on-ramp — this is a strong demo. Walk in cold through the advisor and it will stall on the first screen.

**Demo-readiness score: 6.5 / 10** (8.5 if you follow the recommended script + the two pre-demo fixes; ~4 if you improvise through advisor onboarding live).

---

## What's actually here (ground truth)

- **Instant, safe seeding exists.** A presenter picks a "sample financial profile" and the full system comes alive on Plaid _sandbox_ data — no real bank creds, no mock data. Entry page: `app/onboarding/financial-profile/page.tsx` → renders `components/onboarding/SampleFinancialProfile.tsx`. Activation: `app/api/integrations/plaid/activate-persona/route.ts`. **10 personas** exist (`lib/integrations/plaid/personas.ts`: young_professional, small_business_owner, married_family, salary_plus_bonus, high_income_executive, credit_rebuilding, gig_worker, earned_wage_access, bank_income, dynamic_transactions).
- **The dashboard is deterministic — no model call, no 502 surface.** `app/dashboard/page.tsx:13-18` server-computes recommendations from persisted finance data: _"Deterministic — no model call, no 502 surface."_ This is your safe ground.
- **Fly Core API is UP and warm.** Live probe: `/healthz` → 200 in 0.12s; `/docs` → 200; `/v1/recommendations/roadmap` → 401 in 0.12s (auth working). Cold-start is **not** the live risk today; the wrong health path (`/health` 404 vs `/healthz` 200) is only a monitoring footgun.
- **No-mock-data rule is honored in code.** Life-graph route is explicit: _"No mock/fabricated data — if the user has nothing yet, this returns an honest empty graph"_ (`app/api/life-graph/route.ts:1-9`). Recommendations, my-life, and life-graph all degrade to honest empty states.

---

## Recommended demo script (click-by-click, cited)

Pre-stage **before the call**: log in, activate the **`high_income_executive`** or **`married_family`** persona (richest finance + multi-domain), and _complete the advisor onboarding once_ so the dashboard, roadmap, and graph are fully populated. Then for the live demo you re-enter on a populated account and only re-run the advisor as a controlled showcase. **Have a second pre-staged account already past onboarding as a hot spare.**

1. **Open on the Dashboard (populated).** `app/dashboard/page.tsx`. Lead with the Executive Summary + "Today's brief" — the top recommendation rendered server-side from real persisted data (`page.tsx:32-43`). Wow line: _"This loaded with zero model calls — it's reading a canonical life model, not guessing."_ Cite the deterministic comment if asked. **Safe, instant.**
2. **My Life** — `app/dashboard/my-life/page.tsx`. Show Vision → What Matters Most → Life Readiness → Next Best Action, every section **source-labeled** (`Src` component, line 55-57; e.g. `a.source` at 142). Wow line: _"Every number on this page cites where it came from."_ This is the trust spine made visible. **Safe.**
3. **Recommendations / Roadmap** — `app/dashboard/recommendations/page.tsx`. Now / Next / Later with a _visible priority formula_ (`Formula` interface line 18-25; impact·confidence·urgency·evidence·effort → priority_score) and per-card evidence/assumptions (line 45-56). Wow line: _"It doesn't just list advice — it shows the math behind the ranking and the evidence behind each item."_ Loads via `/api/recommendations` with honest empty + "Building your roadmap…" states (line 373-378). **Safe if pre-populated.**
4. **Life Knowledge Graph** — `/life-graph/explainable` (`app/life-graph/explainable/page.tsx`). 3D graph with node/edge counts in the header (line 118-121), drill-down, search-to-highlight. Wow line: _"This is your life as a graph — your house is a dependency of family stability — and every edge is real, with provenance."_ **Visually the strongest beat — but verify it renders for your persona first (see landmine #2).**
5. **Advisor (scripted, optional close)** — `/dashboard/advisor`. Type ONE pre-rehearsed answer and let the ✨ "Here's what I just learned" reveal fire (`app/dashboard/advisor/page.tsx:454-488`: you_said → we_discovered → dependencies → "N actions unlocked" → confidence%). Wow line: _"It's extracting structured life-model updates from natural language in real time."_ **Do this last, with a known-good input, knowing it takes several seconds per turn.**
6. **Report** — `app/dashboard/reports/page.tsx`. Click "Generate & download PDF" on the Financial or Full report. Closer line: _"Everything you saw, as a branded, cited, reproducible document."_ **Test the exact report you'll click beforehand — it hits the Core API (landmine #4).**

**The narrative spine:** canonical model → cited everywhere → ranked with visible math → visualized as a graph → explained by an advisor → exported as a report. That arc is real and defensible.

---

## Ranked landmines (likelihood × visibility)

### 🔴 #1 — Advisor onboarding is the on-ramp AND the slowest/most fragile surface (HIGH × HIGH)

The persona picker routes straight into the advisor: `SampleFinancialProfile.tsx:75` → `router.push('/dashboard/advisor?onboarding=1')`. The advisor's first action is an LLM round-trip: `advisor/page.tsx:300-302` fires `send('', null)` on mount, hitting `/api/life/discovery-chat-stream` → Core API `/v1/life/discovery/chat/stream` (`app/api/life/discovery-chat-stream/route.ts:11`). The stream proxy has **no timeout** and the whole turn is gated on a Gemini call (memory: ~9s/turn, intermittent 502s). On a live cold demo the principal stares at "Your Advisor / Getting to know you…" for many seconds on the very first screen.
**Mitigation:** Never enter the demo through fresh persona activation. Pre-complete onboarding; demo on a populated account. If you must show the advisor, do it as step 5 with one rehearsed input and a hot-spare account.

### 🔴 #2 — Life-graph page calls a _different_ endpoint than the documented one; empty graph reads as broken (MED × HIGH)

`/life-graph/explainable` fetches `/api/life-graph/workspace` (`features/life-graph/lifeGraphApi.ts:4`), **not** `/api/life-graph`. Both route dirs exist (`workspace/`, `query-focus/`, `route.ts`), but they are separate code paths feeding the same UI — confirm `workspace` returns nodes for your chosen persona. If it returns an empty graph you get the full-screen _"No life graph built yet"_ card (`explainable/page.tsx:161-171`) — on a 3D "wow" page that's a visible faceplant. Also Node/three (drei) version sensitivity is a known fragility (memory: drei pinned for Node 20).
**Mitigation:** Open `/life-graph/explainable` on your exact demo persona the morning of and confirm node/edge counts > 0 and the canvas renders. Pick the persona that produces the densest graph.

### 🟠 #3 — Advisor 502 / stream cut-off (MED × HIGH)

There is a real fallback: if the SSE stream isn't OK or cuts off, it retries the blocking route (`advisor/page.tsx:243-246, 293`). But the blocking route also has no timeout and surfaces a 502 as a silently-empty turn (`discovery-chat/route.ts` returns `{}` on parse failure). Visible symptom: you send a message and nothing comes back.
**Mitigation:** Same as #1 — keep the advisor scripted and brief. Have a screenshot/recording of a good advisor turn as ultimate fallback.

### 🟠 #4 — Report PDF generation is an un-timed Core API call (MED × MED)

`reports/page.tsx:55` links to `/api/reports/{type}/pdf`. PDF build hits the Core API and depends on the user actually having documents/readiness ("Built from your documents and readiness"). A persona that activated finance but skipped doc upload may produce a thin or failing report.
**Mitigation:** Pre-generate and open the exact report you'll demo. Prefer Financial/Full on a fully-onboarded persona. Have the PDF already downloaded as backup.

### 🟠 #5 — Persona switch mid-demo wipes finance data, then re-runs onboarding (MED × MED)

Activation calls `clearPriorFinanceData` first (`activate-persona/route.ts:84`) and on trigger lag can 409 with _"Your profile is still being set up. Please try again in a moment."_ (line 209-212). Switching personas live = blank dashboard + another advisor gauntlet.
**Mitigation:** Lock one persona. Do not switch personas in front of the audience.

### 🟡 #6 — Empty-state copy assumes a self-serve user, not a demo (LOW × MED)

Empty states say things like _"upload a document (offer letter, 401k, benefits) and your roadmap appears here"_ (recommendations line 446-448) and _"Add goals, documents, accounts…"_ (life-graph 165-168). Fine for a real user; on stage an empty surface reads as "the product has nothing." Only a risk if a surface is unexpectedly empty — pre-population removes it.

### 🟡 #7 — Generic onboarding path still exists and is long (LOW × MED)

`/onboarding/interactive` (`app/onboarding/interactive/page.tsx`) is an 11-step questionnaire (WELCOME→…→COMPLETE, line 26-37). If a presenter lands here instead of `/onboarding/financial-profile`, the demo dies in a form. Make sure your entry link is the financial-profile fast path.

---

## Latency / empty-state / error realities a presenter WILL hit

- **Advisor first paint:** several seconds, every turn, because each turn is an LLM call (no infra fix changes this). The SSE `ack` event is designed to paint ~1s (`discovery-chat-stream/route.ts` comment), but the _first_ turn on mount still feels slow.
- **502 on advisor:** plausible per memory; fallback exists but degrades to an empty turn, not a friendly error.
- **Dashboard / My Life / Recommendations:** fast and deterministic; the only "latency" is the client fetch + spinner copy ("Loading your life…", "Building your roadmap…").
- **Fly cold start:** NOT a live risk today (verified warm at 0.12s). Keep it warm with a ping before the call regardless.
- **Plaid sandbox transactions lag:** activation treats missing transactions as non-fatal (`activate-persona/route.ts:176-179`) — a freshly activated persona may briefly show fewer transactions. Another reason to pre-stage.

---

## Top 3 genuine WOW beats that exist today

1. **Source labels on every figure** (`my-life/page.tsx:55-57,142`; recommendations evidence `468-...`). For a skeptical investor, "every number cites its source" is the credibility kill-shot — and it's real in the code, not a slide.
2. **Visible priority formula + evidence on recommendations** (`recommendations/page.tsx:18-25, 45-56`). Most "AI advisor" demos show a list; this shows the ranking math and the evidence. Defensible differentiation.
3. **The 3D explainable Life Graph** (`/life-graph/explainable`) with real node/edge counts, drill-down, and provenance. The single most visually arresting beat — gated only on it being populated (#2).

## Top 3 WEAK moments to avoid or fix

1. **Live advisor onboarding as the opener** — slow, LLM-gated, possible 502. Avoid as on-ramp.
2. **An empty surface** (graph/roadmap/report) reading as "nothing here." Pre-populate to eliminate.
3. **Switching personas on stage** — clears data and re-triggers onboarding. Never do it.

---

## Fixes THIS WEEK (ranked, concrete)

1. **Add a "demo mode" / pre-warmed seeded account, documented in a runbook.** One account per richest persona (high_income_executive, married_family), already past advisor onboarding, with graph + roadmap + a generated report verified. This single step moves the score from ~6.5 to ~8.5. (No code required — operational.)
2. **Put a timeout + visible graceful error on the advisor calls.** Add `AbortSignal.timeout(...)` to `discovery-chat-stream/route.ts:11` and `discovery-chat/route.ts:7`, and render a real "the advisor is taking a moment, retrying…" state instead of an empty turn (`advisor/page.tsx` send()). Turns a stall into a controlled moment.
3. **Verify `/api/life-graph/workspace` returns a dense graph for the demo persona** and fix it if it diverges from `/api/life-graph`. The "wow" page must not show the empty-state card. (Investigate the workspace vs route.ts split — confirm they read the same Core API graph.)
4. **Pre-generate and smoke-test the exact report** you'll click; add a loading/timeout state to the PDF action (`reports/page.tsx:55` is a bare `<a href>` — a slow Core API build looks like a dead click).
5. **Fix the health-check path mismatch** (`/health` 404 vs `/healthz` 200) so your own uptime monitoring doesn't lie to you before a demo.
6. **Optional polish:** seed the advisor's first turn from the persona so the opening message isn't a cold LLM round-trip — pass persona context so turn 1 can render a fast deterministic greeting.

---

## 10-line summary

1. Real product, real seeded data (10 Plaid-sandbox personas), no mock data — the trust story is genuine in code.
2. Strongest, safest surfaces are deterministic: Dashboard, My Life, Recommendations all server-compute from a canonical model with NO model call.
3. The advisor LLM chat is the on-ramp AND the slowest/most fragile thing (~9s/turn, possible 502, no timeout) — that's the central demo risk.
4. Fly Core API is UP and warm today (healthz 200 @0.12s); cold-start is not the live threat, the advisor's LLM latency is.
5. Three real wow-beats: source-labeled figures, visible priority-formula + evidence, and the 3D explainable Life Graph.
6. Biggest landmine: entering the demo through fresh persona activation drops you straight into the slow advisor (SampleFinancialProfile → /dashboard/advisor).
7. Second landmine: the graph page calls /api/life-graph/workspace (not /api/life-graph) — verify it's populated or you get a "No life graph yet" faceplant on your best visual.
8. Empty-state copy is self-serve-user oriented; any unexpectedly-empty surface reads as "the product is hollow" on stage.
9. Fix this week: a pre-warmed seeded demo account + advisor timeouts/graceful errors + verify the graph workspace + pre-gen the report.
10. Demo-readiness 6.5/10 today; ~8.5/10 if you demo on a pre-onboarded account and ship the two top fixes. Never run the advisor cold or switch personas live.
