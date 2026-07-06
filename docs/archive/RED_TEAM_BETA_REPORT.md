# RED_TEAM_BETA_REPORT — LifeNavigator MVP Internal Beta (20 non-technical users)

Branch `mvp`. Every claim below is grounded in the current code. I traced the actual code paths a non-technical user hits with no operator beside them: register → verify → login → onboarding gate → activate persona → first dashboard paint → "ask your advisor" → persona switching → refresh/logout.

## Verdict

Two **P0** defects make the dashboard's most prominent next-step actions dead-end or self-contradict on the very first session. These are not edge cases — they fire for _every_ user on _every_ first visit. Recommend fixing P0-1 and P0-2 before onboarding 20 users.

---

## P0 — Breaks the core flow for a real user, no operator present

### P0-1 — The dashboard's #1 CTA ("Ask your advisor about this") dead-ends on a prerequisite wall

The First Insight card is the hero of the dashboard. Its primary button links to `/conversation`:

- `apps/web/src/components/dashboard/FirstInsightCard.tsx:36` `const chatHref = '/conversation';` → rendered at line 82-87 as "Ask your advisor about this".
- The "Discovery" quick action also points there: `apps/web/src/components/dashboard/DashboardClient.tsx:99` `{ name: 'Discovery', icon: '💭', href: '/conversation' }`.

But `/conversation` is **not** the governed advisor. It renders `DiscoveryChat` and hard-gates:

```
// apps/web/src/app/conversation/page.tsx:93-96
const hasGoals = userGoals.length > 0;
const hasBenefits = benefitSelections.some((s) => s.topPriorities.length > 0);
if (!hasGoals || !hasBenefits) {  // → "Complete Prerequisites First" wall
```

A user who just activated a sample persona has **zero goals and zero benefits** (activation only writes `finance.*` and `user_persona_profile` — `activate-persona/route.ts:82-108` — it never creates goals or benefit selections). So clicking the hero CTA lands them on a "Complete Benefits Discovery / Create at least one goal" screen (`conversation/page.tsx:96-140`). Dead end.

The real governed advisor is `ChatSidebar`, mounted globally in `apps/web/src/app/layout.tsx` and the only caller of the governed `POST /api/agent/chat` (`grep`: `ChatSidebar.tsx` is the sole UI caller of `api/agent/chat`). The First Insight CTA is simply pointed at the wrong surface.

**Fix:** Point `chatHref` at the governed advisor surface (open the `ChatSidebar`, e.g. via a query param `/dashboard?advisor=open&prefill=...`, or a dedicated `/dashboard/advisor` route that mounts the governed chat), not `/conversation`. Either remove the goals/benefits gate from `/conversation` for persona users, or stop linking to it. Same fix for the "Discovery" quick action.

### P0-2 — Dashboard "Financial Overview" card says "No financial data" directly beneath an insight quoting the user's balances

`api/dashboard/summary` is what populates the four dashboard cards. It **never queries `finance.financial_accounts`**:

```
// apps/web/src/app/api/dashboard/summary/route.ts:15-23 — financial block is the EMPTY constant…
financial: { netWorth: 0, ... hasData: false },
// …and the return at :73-88 only overwrites career + education. `financial` is left at hasData:false.
```

Meanwhile the server-rendered First Insight reads the same finance schema and correctly shows real money (`first-insight.ts:46-63`, `dashboard/page.tsx:25`). Result on first paint for e.g. `salary_plus_bonus`:

- Top card (First Insight): **"$242,200 in savings & investments across 3 accounts."**
- Directly below (Financial Overview, `DashboardClient.tsx:508-519`): **"No financial data yet. Add your accounts to get started."** with an "Add Financial Data" button.

For a non-technical user this reads as "the app is broken / it lost my money." It also pushes them toward `AddDataModal` to re-enter data that already exists.

**Fix:** In `summary/route.ts`, query `finance.financial_accounts` (sum checking/savings/investments, compute net worth as First Insight does) and set `financial.hasData` accordingly. Reuse the asset/debt classification from `first-insight.ts:43-44` so the two surfaces agree.

---

## P1 — Corrupts data or strands users in a subset of realistic flows

### P1-1 — Persona switching MERGES finance data (no cleanup of the prior persona)

Many beta users will "try another profile." Activation never removes the previous persona's rows:

- `activate-persona/route.ts:90-91` calls `persistAccounts`, which **upserts on `plaid_account_id`** (`persist.ts:153 onConflict: 'plaid_account_id'`).
- All personas use the same sandbox institution `ins_109508` (`personas.ts:55`), and the override configs in `plaid-custom-configs.ts` do **not** pin `account_id`s — Plaid sandbox mints fresh random `account_id`s per item. So the second persona's accounts get **new** IDs that never collide with the first persona's; the old rows survive.
- No deletion/deactivation happens on activation. The only delete path is the separate `api/integrations/plaid/disconnect/route.ts:36`, which is never invoked here.

Consequence: after switching, `getFirstInsight` (`first-insight.ts:47-52`, filters only `user_id`) and the accounts read route (`accounts/route.ts:22-30`, filters `user_id` + `is_active=true`) both return the **union** of both personas' accounts — doubled cash, wrong utilization, wrong net worth, a confused First Insight. The user's persona metadata is overwritten (`persistPersonaProfile` upserts `onConflict: 'user_id'`, `persist.ts:95`) but their _accounts_ are not, so the displayed persona name no longer matches the displayed money.

**Fix:** Before persisting a new persona, deactivate/delete the user's existing Plaid items, `finance.financial_accounts`, and `finance.transactions` (service role), or scope rows to the active `plaid_item_id` and filter reads by the current item. At minimum, set `is_active=false` on all prior accounts in the activation transaction.

### P1-2 — Activation is not transactional; a mid-flight failure orphans state

`activate-persona/route.ts:67-163` runs as a sequence with no rollback:

1. `persistPlaidItem` (line 82) — writes `finance.plaid_items` first.
2. `persistAccounts` (line 91) — if this throws (RLS/grant gap, network), the `plaid_items` row is already committed → **orphaned plaid_item with no accounts**.
3. `persistPersonaProfile` (line 108) and `profiles.update setup_completed` (line 112) come even later.

If the request fails at step 2 the user sees "Activation failed. Please try again." (`SampleFinancialProfile.tsx:63`). A retry runs the **whole** flow again, creating a _second_ plaid_item and (because of P1-1) potentially a second set of accounts. There is no idempotency key and no double-submit guard beyond the `activating` boolean (which resets on error, `SampleFinancialProfile.tsx:67`).

**Fix:** Wrap the persistence in a single transactional RPC (Postgres function called via `svc.rpc`) so item/accounts/profile/setup_completed commit atomically, or make the route idempotent per `(user_id, persona_id)` and clean up partials on failure.

### P1-3 — `profiles.update` (not upsert) → permanent onboarding redirect loop on trigger lag

Activation marks setup done with an **update**, then only warns on failure:

```
// activate-persona/route.ts:112-116
const { error: profileErr } = await (svc).from('profiles')
  .update({ setup_completed: true, ... }).eq('id', user.id);
if (profileErr) console.warn(...);   // route still returns success:true
```

Middleware explicitly anticipates a missing profile row ("trigger lag/failure") and redirects such users to onboarding (`middleware.ts:96-110`). But if the `handle_new_user` trigger (`003_cleanup_and_reset.sql:431-452`) hasn't created the row yet when activation runs, the `.update()` matches **0 rows**, `setup_completed` is never set, the route still returns `success:true`, and `SampleFinancialProfile.tsx:64` pushes to `/dashboard`. Middleware then finds `!profile || !setup_completed` and bounces back to `/onboarding/financial-profile` (`middleware.ts:106-109`) — an **infinite loop after a "successful" activation**, with finance data already written.

**Fix:** Use `.upsert({ id: user.id, setup_completed: true }, { onConflict: 'id' })` and **fail the activation** (return non-200) if it errors, so the client can retry rather than silently looping.

### P1-4 — Email-confirmation path contradicts the beta fast-path

- Register tells users: "Check your email to verify your account, then log in." (`RegisterForm.tsx:100`) and routes to `/auth/login?registered=true` (line 104).
- If Supabase email confirmation is ON, the email link hits `/auth/confirm`, which on signup sends the user to **`/onboarding/questionnaire`** (the long form) — `auth/confirm/route.ts:47-49` — gated on `user_metadata.onboarding_completed`, a flag this app never sets.
- But `middleware.ts:106-109` sends everyone to **`/onboarding/financial-profile`** (the short fast-path).

So a verified user is first dropped into the long questionnaire (confirm route) and, on any subsequent `/dashboard` hit, redirected to a _different_ onboarding page. Inconsistent, confusing, and the questionnaire is the experience the beta explicitly tried to skip. If confirmation is OFF, the success toast ("Check your email") is misleading because no verification email arrives.

**Fix:** Make `/auth/confirm` redirect to `/onboarding/financial-profile` (match middleware). Align the register toast with the actual confirmation setting.

---

## P2 — Confusing or degraded, but not blocking

### P2-1 — Login ignores the `redirect` param middleware sets

Middleware preserves the intended destination: `loginUrl.searchParams.set('redirect', path)` (`middleware.ts:88`). `LoginForm.tsx:50` hard-codes `router.push('/dashboard')` and never reads `redirect`. A user deep-linked to e.g. `/dashboard/finance` after session expiry is bounced to the generic dashboard. Minor, but loses context.
**Fix:** Read `redirect` from the URL in `LoginForm` and push to it (validate it's a same-origin path).

### P2-2 — The activation "first recommendation" kickoff always 422s (dead code)

`activate-persona/route.ts:143-151` POSTs `{ trigger: 'financial_profile_activation' }` to the gateway. But `GenerateBody` extends `QueryRequest`, which **requires** `query: str = Field(min_length=1)` (`apps/api-gateway/app/schemas/common.py:9-10`). The body has no `query`, so FastAPI returns 422 and the recommendation is never generated. It's wrapped in `.catch(() => {})` so it's non-fatal — but the intended "user has a recommendation waiting" outcome never happens.
**Fix:** Send a real `query` (e.g. a templated "Give me a first recommendation based on my finances") or call a dedicated trigger endpoint that doesn't require `query`.

### P2-3 — Ten generically-named sample profiles in a bare `<select>` with no guidance

`SampleFinancialProfile.tsx:86-98` renders all personas in a plain dropdown showing only `display_name`. A non-technical user ("which one is me?") gets a description only after selecting (lines 101-128). With 10 options and no recommended default beyond "first in list" (line 38), this is a friction point and will produce inconsistent persona choices across the cohort.
**Fix:** Show description/complexity inline as selectable cards; consider a "Not sure? Start here" default.

### P2-4 — Dashboard summary failures are swallowed into a silent "empty" state

`DashboardClient.tsx:206-237` turns any non-OK `/api/dashboard/summary` response into a fully-empty dashboard with no error indication. Combined with P0-2, a user can never tell "I have no data" from "the API failed." Acceptable for resilience, but masks outages during a beta where you need signal.
**Fix:** Surface a subtle "couldn't load latest data — retry" affordance instead of rendering confident zeros.

---

## P3 — Minor / cleanup

- **P3-1** `signOut()` uses the local client and soft `router.push` (`Header.tsx:206-208`). Middleware re-guards protected routes so a stale tab self-corrects on next nav, but consider `signOut({ scope: 'global' })` + `router.refresh()` (already present) to kill other sessions on shared machines.
- **P3-2** `accounts/route.ts:29` filters `is_active=true` but activation never sets `is_active=false` anywhere, so the filter is currently a no-op that would only start mattering once P1-1 is fixed — fix them together.
- **P3-3** Numerous `*.tsx.backup` files under `dashboard/` (e.g. `finance/assets/page.tsx.backup`) ship in the tree; harmless but noise.

---

## Cross-cutting note on the known chat 502

The intermittent governed-chat 502 (`graphrag-query` upstream) is real and orthogonal to the above, but it **compounds P0-1**: even if a user found the correct advisor surface, ~1/3–1/2 of first messages fail. For a no-operator beta, ensure the `ChatSidebar` degraded-state copy is reassuring ("the advisor is briefly unavailable, try again") rather than a raw error.
