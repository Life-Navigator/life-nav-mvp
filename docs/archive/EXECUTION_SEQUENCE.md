# EXECUTION SEQUENCE — LifeNavigator → 9/10 Beta-Ready

**Date:** 2026-06-06
**Repo:** `main` @ `12ac619`
**Reads with:** `APPLICATION_READINESS_AUDIT.md` and `BETA_PRODUCT_GAP_TREE.md`

This document gives the exact order. Each step is independently shippable. Where a step has an operator dependency (env vars, password rotation, dashboard click), that is called out.

**Total wall-clock to 9/10:** ~14 hours of focused engineering work + ~30 minutes of operator action, spread across whatever number of days the operator allocates.

---

## The sequence

```
Step 1   Re-hide 5 domains                                    ~5 min     me
Step 2   Rename migration 107 (collision)                     ~5 min     me
Step 3   Add empty-state fallbacks on broken finance pages    ~3 h       me
Step 4   Operator actions (passwords + Plaid env vars)        ~30 min    operator
Step 5   Push to origin/main + verify Vercel deploy           ~15 min    operator
Step 6   Push migration 107 to lifenavigator-production       ~5 min     operator
Step 7   /dashboard/finance/connections → Plaid Link launcher ~2 h       me
Step 8   Smoke test: Cypher → Neo4j → personal context        ~30 min    me+operator
Step 9   Discovery conversation wired into /onboarding/converse ~4-6 h   me
Step 10  Open the 20-user cohort                              ~0 min     operator
```

---

## Step 1 — Re-hide 5 domains (5 min)

**Why first:** the highest-ROI fix in the audit; removes the single biggest "looks pathetic" risk before anything else lands.

**File:**

```
apps/web/src/components/layout/Sidebar.tsx
```

**Action:** Restore `comingSoon: true` on the 5 items I un-hid in commit `a047492`: Career, Education, Healthcare, Calendar, Roadmap. Keep Dashboard / Chat / Goals & Assessment / Scenario Lab / Finance / Settings visible.

**Verification:**

```bash
pnpm build
pnpm run verify:governance   # should remain OK
```

**Commit message:**

```
fix(nav): re-hide Career/Education/Healthcare/Calendar/Roadmap until each has an
honest landing (revert over-reach from a047492)
```

---

## Step 2 — Rename migration `107` (collision)

**Why now:** Push order is alphabetical. Two files at 107 won't both apply cleanly; the rename de-conflicts before the push happens.

**Files:**

```
supabase/migrations/107_advisor_chat_history.sql
  → rename to →
supabase/migrations/111_advisor_chat_history.sql
```

(Team's existing 107_analytics_grants_and_persona_event.sql, 108, 109, 110 are already on remote; 111 is the next free slot.)

**Action:** `git mv`. Commit. No SQL changes needed.

**Verification:**

```bash
ls supabase/migrations/ | grep -E "^10[5-9]|^11"
# expect: 105, 106, 107_analytics_*, 108, 109, 110, 111_advisor_*
```

**Commit message:**

```
fix(migrations): rename 107_advisor_chat_history → 111 (collision with
107_analytics_grants_and_persona_event)
```

---

## Step 3 — Empty-state fallbacks on 6 broken finance sub-pages (3 h)

**Why now:** They're reachable from the Finance landing sidebar. Without guards they 404 silently and feel pathetic. With honest empty states, they communicate intent.

**Pages:**

```
/dashboard/finance/budget        → calls missing /api/finance/budgets
/dashboard/finance/investments   → calls 3 missing endpoints
/dashboard/finance/risk          → calls missing /api/financial/risk
/dashboard/finance/tax           → calls 7 missing endpoints
/dashboard/finance/retirement    → calls 8 missing endpoints
/dashboard/finance/assets        → calls missing /api/assets
```

**Pattern per page:** wrap the existing fetch in try/catch. If 404 / non-200 / empty response, render an honest empty state card:

> _"We don't have <domain> data on file yet. Activate a sample persona on the dashboard to see how this works, or connect your real accounts in **Finance → Connections** to populate it."_

…with a button that routes to `/dashboard` (for persona activation) or `/dashboard/finance/connections` (for real Plaid). DO NOT render the existing chart/table components when there's no data — render the empty state instead.

**Verification:**

```bash
pnpm build
# Visit each page in dev; confirm empty state, no 404 toast.
```

**Commit message:**

```
fix(finance): honest empty states on 6 sub-pages with missing endpoints
(budget/investments/risk/tax/retirement/assets)
```

---

## Step 4 — Operator actions (~30 min, no code)

These do not block code work — the operator can do them in parallel with Steps 5-9.

| Task                                                            | Where                                                                | Why                                                                                                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rotate Supabase account password                                | https://supabase.com/dashboard/account/security                      | Hygiene; the value `Techgenius!$#1` is in conversation transcripts                                                                                  |
| Rotate Supabase DB password                                     | Project Settings → Database → Reset                                  | Same; `LifeNav!$#007` exposure                                                                                                                      |
| Re-stage any downstream secrets that referenced the DB password | Fly secrets list, Vercel env vars, Supabase Edge Function secrets    | Anywhere the old DB password is wired                                                                                                               |
| Mint a fresh Supabase access token                              | https://supabase.com/dashboard/account/tokens                        | day-scoped; revoke the prior                                                                                                                        |
| Verify Plaid env vars on Vercel                                 | Vercel project Settings → Environment Variables                      | Confirm `PLAID_CLIENT_ID` + `PLAID_CLIENT_SECRET` + `PLAID_ENV=sandbox` are set on Production. Without them, sample-persona activation returns 503. |
| Update DeviceMockup chrome label                                | `.ai` → `.tech` in `components/brand/DeviceMockup.tsx` (or wherever) | P2-2 — visible on marketing site to every visitor                                                                                                   |

Operator can mark each done when complete. None of this is destructive; all are reversible.

---

## Step 5 — `git push origin main` + verify Vercel deploy (~15 min)

**Why now:** Steps 1-3 are committed locally. Without push, none of the work is live. Steps 6-9 also need to be deployed when they land.

**Action:**

```bash
cd /home/riffe007/Documents/projects/life-nav-mvp
git rev-parse HEAD                  # should be the latest commit from Step 3
git push origin main
```

Vercel auto-deploys from main. Watch the build log: should see `pnpm install` succeed (we know the rogue duplicate project was the prior issue; the real `life-nav-mvp-web` project works), `pnpm verify:governance OK`, `next build` completes.

**Verification after deploy:**

```bash
curl -fsS https://lifenavigator.tech/                        # 200
curl -fsS https://app.lifenavigator.tech/api/health          # 200 or 307 (auth-gated)
```

In a browser:

- Sign in. Top-right shows real name + initials (not "User" / "U").
- Sidebar shows: Dashboard, Chat, Goals & Assessment, Scenario Lab, Finance, Settings. **Not** Career, Education, Healthcare, Calendar, Roadmap.
- /dashboard/chat renders. Empty state copy: "No conversations yet. Start one…"
- /dashboard/finance shows real Plaid data (assuming persona activated).

If Vercel build fails: capture the log, fix the root cause, redeploy. Do NOT revert past this point.

---

## Step 6 — Apply migration 111 (chat history) to lifenavigator-production (~5 min)

**Why now:** The chat page is reachable post-deploy but persistence still silently fails until the schema exists.

**Action (operator runs from a terminal with their DB password):**

```bash
export SUPABASE_ACCESS_TOKEN='<fresh token from Step 4>'
export SUPABASE_DB_PASSWORD='<rotated DB password from Step 4>'

supabase migration list --linked        # confirm 111_advisor_chat_history queued
supabase db push --linked --include-all --dry-run -p "$SUPABASE_DB_PASSWORD"
# review output; should list ONLY 111_advisor_chat_history.sql (assuming team's
# 107-110 are already applied)

supabase db push --linked --include-all -p "$SUPABASE_DB_PASSWORD"
# real push
```

**Verification:**

```bash
# Direct DB query:
psql 'postgres://postgres.diwkyyahglnqmyledsey:<PW>@aws-1-us-east-1.pooler.supabase.com:6543/postgres' \
  -c "SELECT count(*) FROM chat.conversations;"
# expect: 0 (empty but the table exists)

# Visit app.lifenavigator.tech/dashboard/chat:
# Send "test" → reply renders → refresh → conversation in left rail → click → messages replay.
```

If the dry-run shows OTHER migrations queued unexpectedly, **stop** and investigate before pushing for real.

---

## Step 7 — `/dashboard/finance/connections` launches real Plaid Link (2 h)

**Why now:** Path B (real Plaid user) is currently impossible because the Plaid Link button isn't user-reachable anywhere.

**File:**

```
apps/web/src/app/dashboard/finance/connections/page.tsx
```

**Current behavior:** Renders `<FinancialIntegrations />`, which is a "platform catalogue" component listing dozens of "Coming Soon" entries.

**New behavior:** Show the existing `PlaidLinkButton` (already built at `components/integrations/PlaidLinkButton.tsx`), the list of currently connected accounts (read from `/api/financial`), and a "manual account entry" fallback that POSTs to `/api/integrations/plaid/exchange` (or a manual-add equivalent).

**Action:**

1. Replace the page body:
   - Section A: "Connect a bank" with `<PlaidLinkButton onSuccess={…}/>`.
   - Section B: "Your connected accounts" — list institutions from `/api/financial?timeframe=month`.
   - Section C: "Or add an account manually" — small form.
2. The `onSuccess` callback receives a `public_token`; POST to `/api/integrations/plaid/exchange/route.ts` (verify it exists; if not, the persona-activation pattern shows how to call exchange + persist).
3. After exchange success, the existing graph-promotion trigger fires and the user sees their accounts on the next dashboard load.

**Verification:**

- New user signs up → finishes Discovery (Step 9 once it's built) → routes to `/dashboard/finance/connections` → Plaid Link opens → user selects Chase + Citi → tokens exchanged → accounts appear → /dashboard shows real recs.

**Commit message:**

```
feat(finance): /dashboard/finance/connections launches Plaid Link + lists
connected accounts (was the platform catalogue; not user-reachable Link)
```

---

## Step 8 — Smoke test the Cypher → Neo4j → Personal context path (~30 min)

**Why now:** Before opening cohort, verify the advisor actually grounds in personal data. The architecture is built but not verified end-to-end in this audit.

**Action:**

1. Activate a sample persona (e.g. "high-income executive").
2. Open the chat. Ask: "What's my checking balance?"
3. Expect a response that cites the actual checking balance from the persona's accounts.
4. Ask: "Tell me about my career trajectory."
5. Expect either (a) a response that cites the persona's career data, or (b) an explicit refusal: "I don't have your career data on file."

**If grounded responses with REAL numbers come back:** ✓ end-to-end works. Proceed.

**If responses are vague or hallucinated:** the personal-graph path is broken between persona activation → `graphrag.sync_queue` → ingestion-worker → Neo4j personal database. Investigation needed; promote to P0.

**If chat returns "no personal context" but the persona is activated:** the Cypher query is returning empty rows. Inspect the ingestion-worker logs to confirm sync_queue is being drained.

---

## Step 9 — Discovery conversation wired into `/onboarding/converse` (4-6 h)

**Why now:** the brand-defining moment of the product. Everything else above is fixing pre-existing breakage; this is the one item that makes LifeNavigator memorably distinct.

**Files:**

```
apps/web/src/app/onboarding/converse/page.tsx            (rewrite)
apps/web/src/lib/conversation/conversation-engine.ts     (use)
apps/web/src/lib/conversation/need-behind-need-engine.ts (use)
apps/web/src/lib/conversation/driver-inference-engine.ts (use)
apps/web/src/components/conversation/DiscoveryChat.tsx   (use)
apps/web/src/proxy.ts                                    (update redirect)
```

**Action plan:**

### 9a · Rewrite `/onboarding/converse/page.tsx`

```typescript
// Pseudo-shape; not actual code:
'use client';
export default function ConversePage() {
  const [stage, setStage] = useState<'pick-persona' | 'chat' | 'finalize'>('pick-persona');
  const [persona, setPersona] = useState<AgentPersona | null>(null);
  const [engine, setEngine] = useState<ConversationEngine | null>(null);

  function onPersonaPick(p: AgentPersona) {
    setPersona(p);
    setEngine(new ConversationEngine(userId, [], []));
    setStage('chat');
  }

  function onDiscoveryComplete(analysis: InsightDiscovery & {
    goalRefinements: GoalRefinement[];
    riskInference: RiskInference;
  }) {
    // Persist all three artifacts in parallel
    Promise.allSettled([
      // 1. Conversation analysis blob (existing route)
      fetch('/api/conversation/analysis', { method: 'POST', body: JSON.stringify({ analysis }) }),
      // 2. Goals — iterate refinements
      ...analysis.goalRefinements.map((g) =>
        fetch('/api/goals', { method: 'POST', body: JSON.stringify({
          title: g.refined,
          description: `Originally: ${g.original}\nWhy: ${g.reason}`,
          category: persona!.goalCategory,
          status: 'discovered',
        }) })
      ),
      // 3. Risk profile
      fetch('/api/onboarding/risk-profile', { method: 'POST', body: JSON.stringify({
        risk_tolerance: analysis.riskInference.tolerance,
        time_horizon: analysis.riskInference.horizon,
        source: 'discovery_conversation',
      }) }),
    ]).then(() => setStage('finalize'));
  }

  function onFinalize(choice: 'connect_plaid' | 'sample_persona') {
    // mark profiles.setup_completed = true
    fetch('/api/onboarding/complete', { method: 'POST' });
    // route to either /dashboard/finance/connections (Plaid) or
    // /onboarding/financial-profile (sample persona picker)
    router.push(choice === 'connect_plaid'
      ? '/dashboard/finance/connections'
      : '/onboarding/financial-profile');
  }

  if (stage === 'pick-persona') return <PersonaPicker onPick={onPersonaPick} />;
  if (stage === 'chat') return <DiscoveryChat
      userGoals={[]}
      benefitSelections={[]}
      userId={userId}
      onComplete={onDiscoveryComplete}
    />;
  if (stage === 'finalize') return <FinalizeChoice onChoose={onFinalize} />;
}
```

### 9b · Update `proxy.ts` redirect

Change the redirect target from `/onboarding/financial-profile` to `/onboarding/converse`:

```typescript
// Beta path: Discovery conversation first; sample persona OR real Plaid AFTER.
return NextResponse.redirect(new URL('/onboarding/converse', request.url));
```

### 9c · Edge cases

- **User closes tab mid-conversation:** on next sign-in, proxy still sees `setup_completed=false` → routes to `/onboarding/converse`. The discovery page should detect existing partial `user_preferences.conversation_analysis` and offer "Continue where you left off" vs "Start over".
- **Conversation never reaches drill-down:** cap turns; force `summarizeDrillDown()` after N turns if engine hasn't finalized.
- **Gemini quota burn:** the DiscoveryChat fires generation per assistant turn. The economic gate (Sprint O.0.2) already enforces budgets — verify the per-user daily cap is set sane.

### 9d · Tests

Existing 1371-test suite covers the engine. Add a small integration test for the new orchestrator page (mount, persona pick, mocked engine.complete → POST mocked).

**Commit message:**

```
feat(onboarding): Discovery conversation wires into /onboarding/converse —
new users surface need-behind-need + goals + risk before choosing
real-Plaid or sample-persona paths
```

---

## Step 10 — Open the cohort (~0 min)

**Pre-cohort smoke checklist** (operator runs each manually with a real test account):

```
□ Sign up at app.lifenavigator.tech → magic-link email arrives in inbox (not spam)
□ Confirm email → land on /onboarding/converse
□ Pick a persona → conversation surfaces 3+ goal refinements + risk profile
□ Choose "Sample Persona" → activate "high-income executive"
□ Land on /dashboard with FirstInsightCard rendering a real top rec
□ Top-right dropdown shows real name + initials (NOT "User" / "U")
□ Sidebar shows: Dashboard, Chat, Goals & Assessment, Scenario Lab, Finance, Settings (NOT 5 hidden)
□ Click Chat → send a message → reply arrives → refresh page → conversation persists in left rail
□ Click Goals → see the 3+ goals created during Discovery
□ Click Finance → see accounts + transactions + recommendations
□ Visit /dashboard/finance/connections → see "Connect a bank" button (NOT the platform catalogue)
□ Sign out → land on /auth?mode=signin (not /auth/login)
□ Sign back in → land directly on /dashboard (NOT looped back to onboarding)
```

If all 12 pass → open cohort.

If any fails → log + fix + re-run that single check. Don't open until all pass.

**Cohort opening:** send personal invite emails (10-20). Monitor:

- New rows in `chat.conversations` and `chat.messages`
- New rows in `governance.decision_governance_audit`
- New rows in `economic.usage_events`
- `economic.user_budgets.current_daily_micros` per user (should grow but stay under daily cap)
- `governance.character_findings` count (should remain 0 — anything > 0 is a flag)
- `security.injection_findings` count (anomalies investigated)

---

## ROI summary at each step

```
After Step 1:    Sidebar honest         → first impression no longer pathetic     +1.0 / 10
After Step 2:    Migration clean         → chat history will land cleanly         +0.0  (prep)
After Step 3:    Finance pages honest    → no silent 404s on user-reachable subs  +0.5
After Step 4:    Secrets rotated         → security hygiene                        +0.0  (defensive)
After Step 5:    Origin deployed         → all prior work live                     +0.5
After Step 6:    Chat persists           → repeat-visit value restored             +1.0
After Step 7:    Plaid Link reachable    → real Path B unblocked                   +0.5
After Step 8:    Cypher verified         → confidence in advisor grounding         +0.0  (test)
After Step 9:    Discovery wired         → brand-defining moment delivered         +1.5
After Step 10:   Cohort opens                                                       9/10
```

---

## Verdict

```
After this sequence (~14 h engineering + ~30 min operator):

  WORKING_APP_READY_FOR_20_USER_BETA
```

Not 10/10. 9/10. The remaining 1.0 is six weeks of per-domain rebuild work (Education → Career → Healthcare → Calendar → Roadmap, in that order of effort/value) that should happen _during the 20-user beta_, not before it.

Premium, intelligent, personal, defensible, and honest about what's coming. That's the bar. The sequence above gets you there.

---

End of `EXECUTION_SEQUENCE.md`.
