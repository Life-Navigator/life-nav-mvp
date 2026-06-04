## PART 9 — 20-USER LAUNCH READINESS

**Overall Verdict: READY_WITH_P0_FIXES.** The product has a genuinely strong spine — a deterministic, server-rendered First Insight that produces a true, specific, money-relevant fact for all 9 verified personas even when sandbox transactions don't persist (first-insight.ts; verified by the persona test matrix). But for a 20-user, _no-operator-present_ beta, several P0s would strand or actively mislead a non-technical user within the first 90 seconds. None are architecturally hard; all are bounded, code-local fixes. That is the precise definition of READY_WITH_P0_FIXES, not READY and not NOT_READY.

### Infrastructure — 55

Core path is deployed and the activation write path is transactional-by-statement. But there is **zero scheduling infrastructure** (no `crons` key in apps/web/vercel.json — verified absent; no pg_cron/pg_net in migrations) and **no outbound channel** (nodemailer is in devDeps as @types only, every email template is a STUB). For 20 users manual founder email is acceptable, so this isn't a blocker — but it caps any out-of-app return mechanic. The Vercel "main vs mvp" production-branch quirk (known) adds deploy fragility.

### Activation — 62

The verified strength: First Insight always falls through to a true positive-net-worth statement, so activation "succeeds" perceptually for every persona. But two real defects: (1) the best-effort first-recommendation call is **dead-on-arrival for all 10 personas** — activate-persona/route.ts:149 sends `{trigger:...}` with no `query`, the gateway requires `query` min_length=1, so it 422s and is swallowed by `.catch(()=>{})` (verified). (2) **Persona switching merges datasets**: every persona uses ins_109508 (personas.ts:55), persist upserts on plaid_account_id (persist.ts:153), sandbox mints fresh IDs each activation, and the route never deletes prior accounts — a curious user who tries a 2nd persona corrupts their own First Insight. Plus the non-transactional ordering (item persists before accounts/profile) and `profiles.update` (not upsert) on trigger lag can trap a user in an onboarding redirect loop.

### Onboarding — 50

Two contradictory paths: /auth/confirm sends verified signups to the long /onboarding/questionnaire while middleware fast-paths to /onboarding/financial-profile (verified). The persona picker is a bare `<select>` of 10 generically-named profiles with description shown only after selection. Login ignores the `redirect` param middleware sets. dynamic_transactions persona is unverified and should be hidden.

### Trust — 38 (lowest, and decisive)

This is the dimension that pushes the verdict toward "with P0 fixes." Verified, user-visible, trust-destroying defects: (1) Footer Privacy/Terms link to /privacy and /terms which **404** — pages live at /legal/privacy and /legal/terms (Footer.tsx:15-16 verified). (2) The /security page claims **graph + vector-store cascading deletion** that the code never performs — delete path only does Postgres FK cascade, no Neo4j/Qdrant deletion exists. (3) Security page claims export **includes financial records**, but the export route selects only profiles/goals/courses/job_applications/documents/risk_assessments — **no finance.\* at all** (verified at export/route.ts:26-31). On a _financial_ product these are false GDPR/security claims. (4) The Financial Overview card says "No financial data yet" directly beneath a First Insight quoting "$242,200 in savings" — api/dashboard/summary/route.ts:23 hardcodes financial.hasData=false and never overwrites it (verified). (5) No "not financial advice" disclaimer on any advice surface. A non-technical beta is fundamentally a trust pitch; these must ship fixed.

### Recommendation Quality — 30

Verified: there is **no recommendation engine that consumes persona data end-to-end**. The gateway call is dead (422). The Next-Dollar Optimizer reads tables persona activation never populates, so it emits the _identical_ plan for all 10 personas and would tell a 92%-utilization credit-rebuilder to "invest in a taxable brokerage." The only persona-grounded advice is First Insight's single recommendation line — solid, but 4 of 9 personas collapse to the banned "No retirement account is showing up yet" with no quantified consequence.

### Conversation Quality — 40

The known 502 is real and root-caused: retry.ts's initial `let resp = await doFetch(url, init)` is **unguarded** — only `resp.status` is checked, so a thrown network error (Gemini cold-start TLS/reset) never gets retried and propagates to a 502 (verified in supabase/functions/graphrag-query/retry.ts). No AbortSignal timeouts on the 3 sequential Gemini calls. Persona profile never reaches the LLM (chat reads risk_assessments, never user_persona_profile). SSE protocol mismatch renders raw wire text. A money advisor that fails 1/3–1/2 the time with no deterministic fallback is not launch-grade — but it degrades gracefully in UI and is fixable, so not a hard NO.

### Retention — 35

First Insight is the shipped retention surface but is **identical on every visit** (deterministic over static data) — no Day-3 return value. Notifications settings page is cosmetic (no Save handler, toggles do nothing) — actively misleading. For 20 users, in-app brief rotation + manual founder email is the right posture; no infra needed.

### Observability — 45

Activation, onboarding, first_insight_viewed, and recommendation lifecycle ARE instrumented. But three declared funnel events have **zero call sites** (first_chat_message, sample_financial_profile_selected — verified; no signup event exists at all), and the **chat 502 is invisible** — governed-route.ts:223-228 returns 502 before recordUsage runs, so the exact failure we know is happening leaves no row. For a no-operator beta, being blind to chat adoption and chat failures is serious.

### Why READY_WITH_P0_FIXES and not the alternatives

Not READY: the trust 404s, the false deletion/export claims, the "$242k / No data" contradiction, the dead-end "Ask your advisor" CTA (routes to a goals/benefits prerequisite wall — verified at conversation/page.tsx:96), and the unretried 502 are all things a non-technical user hits in minutes with no operator to rescue them. Not NOT_READY: the foundation (auth, RLS, activation persistence, deterministic First Insight) is sound and every P0 is a small, code-local fix — no rearchitecting. Ship after the P0 wave clears the gate.
