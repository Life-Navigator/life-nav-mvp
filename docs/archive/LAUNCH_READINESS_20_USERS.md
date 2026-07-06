# Wave 0 Execution Status — appended 2026-06-04

The 9-part audit verdict was **READY_WITH_P0_FIXES**. This sprint then _implemented and
verified on production_ the Wave 0 functional P0 blockers + the explicit asks. The
detailed audit + scoring follows below; this header records what is now SHIPPED.

## Shipped & verified live (commits e06c0bc…3ea0539, +footer)

| Area                   | Fix                                                                                                                                                                                                                                           | Verified                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| First Insight          | Rewrote engine to Good/Great bar across all 10 personas: APR debt-vs-invest Rule 0, quantified future-value retirement rule (kills the banned "No retirement account detected"), dollar-drag idle-cash, goal-aware fallback, rendered metric. | ✅ real-engine test (5/5) + live dashboard HTML shows "$284,621…" |
| Activation integrity   | Clear prior persona finance data before re-activating (kills silent persona-merge corruption); checked setup_completed (409 not silent stuck); selected/activation_failed events.                                                             | ✅ live persona switch shows ONLY new data (3 accts, not 8)       |
| Activation reliability | Fixed credit_rebuilding 500 — `loan/personal` is an invalid Plaid sandbox subtype → `consumer`. Validated all 10 personas' subtypes.                                                                                                          | ✅ all 10 activate                                                |
| Dashboard              | summary route now reads finance.financial_accounts; net worth excludes mortgage/loan-without-asset (no more "$242k / No data" contradiction, no −$376k).                                                                                      | ✅ live netWorth=+$28,560, hasData=true                           |
| Hero CTA               | "Ask your advisor about this" opens the governed ChatSidebar (event) instead of dead-ending on /conversation's goals/benefits wall.                                                                                                           | ✅                                                                |
| Chat 502               | Hardened geminiFetch (retry thrown errors + per-attempt timeouts), made embed + NL→Cypher non-fatal, edge + governed-route deterministic fallback.                                                                                            | ✅ 0 bare 502 across repeated chats (budget 429 still enforced)   |
| Observability          | Migration 110 (user_signed_up/session_started/persona_activation_failed/model_call_failed); emit signup, first_chat_message, model_call_failed, selected/failed. Funnel now anchorable.                                                       | ✅ migration applied; events whitelisted                          |
| Trust                  | "not financial advice" disclaimer on First Insight + ChatSidebar; footer Privacy/Terms now resolve (→ /legal/\*), dead /about+/contact removed.                                                                                               | ✅                                                                |

## NOT done this sprint (Wave 1 / trust-copy / retention — see TOP_25)

- #5 /security copy honesty, #12 Sample-data banner, #25 SOC2/SLA claims + fake module vote counts (127/95/203/78 in DashboardClient).
- #15 inject persona into chat context, #22 SSE parse fix, #17 notifications page honesty.
- Retention engine build (daily brief / alerts / goal tracking) — designed, not built.
- Plaid sandbox doesn't honor override credit APR (credit_rebuilding shows 13% not 28%); insight still correct, fidelity follow-up.
- Minor: deleting an auth user with finance data 500s (cascade) until finance rows are cleared first — operational, not user-facing.

## Current readiness call

Wave 0 functional blockers (activation, insight, dashboard, chat, observability, persona-switch) are **cleared and verified on prod**. Remaining to declare READY_FOR_20_USERS: the trust-copy P0s (#5, #12, #25) and Wave 1 quality items above. Recommend: clear trust-copy (≈half a day), then invite the first 10 per the Sprint Sequence GATE 1.

---

## PART 9 — 20-USER LAUNCH READINESS

**Overall Verdict: READY_WITH_P0_FIXES.** The product has a genuinely strong spine — a deterministic, server-rendered First Insight that produces a true, specific, money-relevant fact for all 9 verified personas even when sandbox transactions don't persist (first-insight.ts; verified by the persona test matrix). But for a 20-user, _no-operator-present_ beta, several P0s would strand or actively mislead a non-technical user within the first 90 seconds. None are architecturally hard; all are bounded, code-local fixes. That is the precise definition of READY_WITH_P0_FIXES, not READY and not NOT_READY.

### Infrastructure — 55

Core path is deployed and the activation write path is transactional-by-statement. But there is **zero scheduling infrastructure** (no `crons` key in apps/web/vercel.json — verified absent; no pg_cron/pg_net in migrations) and **no outbound channel** (nodemailer is in devDeps as @types only, every email template is a STUB). For 20 users manual founder email is acceptable, so this isn't a blocker — but it caps any out-of-app return mechanic. The Vercel "main vs mvp" production-branch quirk (known) adds deploy fragility.

### Activation — 62

The verified strength: First Insight always falls through to a true positive-net-worth statement, so activation "succeeds" perceptually for every persona. But two real defects: (1) the best-effort first-recommendation call is **dead-on-arrival for all 10 personas** — activate-persona/route.ts:149 sends `{trigger:...}` with no `query`, the gateway requires `query` min_length=1, so it 422s and is swallowed by `.catch(()=>{})` (verified). (2) **Persona switching merges datasets**: every persona uses ins_109508 (personas.ts:55), persist upserts on plaid_account_id (persist.ts:153), sandbox mints fresh IDs each activation, and the route never deletes prior accounts — a curious user who tries a 2nd persona corrupts their own First Insight. Plus the non-transactional ordering (item persists before accounts/profile) and `profiles.update` (not upsert) on trigger lag can trap a user in an onboarding redirect loop.

### Onboarding — 50

Two contradictory paths: /auth/confirm sends verified signups to the long /onboarding/questionnaire while middleware fast-paths to /onboarding/financial-profile (verified). The persona picker is a bare `<select>` of 10 generically-named profiles with description shown only after selection. Login ignores the `redirect` param middleware sets. dynamic_transactions persona is unverified and should be hidden.

### Trust — 38 (lowest, and decisive)

This is the dimension that pushes the verdict toward "with P0 fixes." Verified, user-visible, trust-destroying defects: (1) Footer Privacy/Terms link to /privacy and /terms which **404** — pages live at /legal/privacy and /legal/terms (Footer.tsx:15-16 verified). (2) The /security page claims **graph + vector-store cascading deletion** that the code never performs — delete path only does Postgres FK cascade, no Neo4j/Qdrant deletion exists. (3) Security page claims export **includes financial records**, but the export route selects only profiles/goals/courses/job*applications/documents/risk_assessments — **no finance.\* at all** (verified at export/route.ts:26-31). On a \_financial* product these are false GDPR/security claims. (4) The Financial Overview card says "No financial data yet" directly beneath a First Insight quoting "$242,200 in savings" — api/dashboard/summary/route.ts:23 hardcodes financial.hasData=false and never overwrites it (verified). (5) No "not financial advice" disclaimer on any advice surface. A non-technical beta is fundamentally a trust pitch; these must ship fixed.

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
