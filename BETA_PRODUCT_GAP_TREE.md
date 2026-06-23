# BETA PRODUCT GAP TREE — LifeNavigator

**Date:** 2026-06-06
**Repo:** `main` @ `12ac619`
**Companion to:** `APPLICATION_READINESS_AUDIT.md` (full reasoning + journey traces) and `EXECUTION_SEQUENCE.md` (ordered work plan)

This document is the prioritized backlog. It overwrites the prior gap tree (which mis-classified two onboarding flows and missed the migration `107` collision). Read the main audit if you want the why behind any item.

**Bias honored throughout:** do not expose empty domains · do not expose crashing pages · do not expose placeholder features · prefer one exceptional onboarding experience over multiple incomplete domains · make the application actually intelligent before adding additional pages.

---

## Triage summary

```
P0 — Blocks application value          7 items   implement now
P1 — Blocks domain visibility           7 items   hide first, build later
P2 — Polish                             8 items   defer
```

---

# P0 — Blocks application value

## P0-1 · Migration `107` collision — rename + apply

```
Route/component:    supabase/migrations/107_advisor_chat_history.sql
Current behavior:   Two files exist at 107 (mine for chat history; team's for analytics
                    grants + persona_activated event). Push order is alphabetical →
                    "advisor" < "analytics" so mine would apply first, but it's NOT
                    applied to the live DB yet. The chat page silently fails to
                    persist; conversations are amnesiac.
Expected behavior:  Chat history persists; conversation list + resume works.
Data dependency:    none new
Schema dependency:  mine creates `chat.conversations` + `chat.messages` + 2 public views
Risk:               LOW — collision just needs a rename; the SQL is idempotent
Estimated effort:   5 min (rename file to 111_advisor_chat_history.sql)
Recommended fix:    Rename to 111_advisor_chat_history.sql; commit; `supabase db push
                    --linked --include-all --dry-run -p $DB_PW` then real push.
Implement now / defer / hide:   IMPLEMENT NOW
```

## P0-2 · Re-hide 5 domains in sidebar

```
Route/component:    apps/web/src/components/layout/Sidebar.tsx
Current behavior:   After my un-hide commit (a047492), Career, Education, Healthcare,
                    Calendar, Roadmap are visible. Each lands on missing endpoints or
                    `<ComingSoon />`. This is the single biggest "looks pathetic" risk.
Expected behavior:  Hidden until each has a non-crashing landing + working data path.
Data dependency:    n/a (rollback)
Schema dependency:  n/a
Risk:               LOW — flag flip, fully reversible
Estimated effort:   5 min
Recommended fix:    Restore `comingSoon: true` on those 5. Keep Finance, Chat, Goals,
                    Scenario Lab, Settings visible.
Implement now / defer / hide:   IMPLEMENT NOW
```

## P0-3 · Discovery conversation wired into `/onboarding/converse`

```
Route/component:    apps/web/src/app/onboarding/converse/page.tsx,
                    components/conversation/DiscoveryChat.tsx,
                    lib/conversation/{conversation-engine, need-behind-need-engine,
                                    driver-inference-engine}.ts
Current behavior:   Engines + DiscoveryChat exist but are not imported outside their
                    files. `/onboarding/converse` uses `ConversationalShell` with
                    persona presets — the rich engine is dormant. The current beta
                    onboarding is "pick a synthetic Plaid persona" (defensible but
                    not differentiated).
Expected behavior:  New users land on Discovery → real conversation surfaces hidden
                    motivations + need-behind-need + GoalRefinements + risk profile
                    → outputs persist as rows in public.goals, public.risk_assessments,
                    and public.user_preferences.conversation_analysis (JSONB) → user
                    chooses Connect-Real-Plaid OR Pick-Sample-Persona → dashboard.
Data dependency:    public.goals (✓ exists), public.risk_assessments (✓),
                    public.user_preferences (✓), public.profiles.setup_completed (✓).
                    Engine is in-memory; no Gemini call required for the engine,
                    only for the LLM-narrated reflection turns.
Schema dependency:  NONE — flagged as optional: migration 084 would give richer audit
                    via decision_intelligence.conversation_traces; not needed for v1.
Risk:               MEDIUM — UX needs care. Must handle resume after page close, must
                    cap conversation length to avoid Gemini quota burn.
Estimated effort:   4-6 h
Recommended fix:    Rewrite /onboarding/converse/page.tsx to:
                      1. Render persona picker.
                      2. On choice → instantiate ConversationEngine + render
                         DiscoveryChat with persona opening.
                      3. Iterate ConversationStages until insight + drill-down +
                         GoalRefinements complete.
                      4. onComplete → POST /api/conversation/analysis (JSONB),
                         iterate analysis.goalRefinements → POST each to /api/goals,
                         POST analysis.riskProfile to /api/onboarding/risk-profile.
                      5. After persistence → user chooses Connect Plaid (live) OR
                         pick a sample persona (current Path A).
                      6. Set profiles.setup_completed = true on completion.
                    Update proxy.ts to redirect new users to /onboarding/converse
                    (not /onboarding/financial-profile).
Implement now / defer / hide:   IMPLEMENT NOW
```

## P0-4 · `/dashboard/finance/connections` launches REAL Plaid Link

```
Route/component:    apps/web/src/app/dashboard/finance/connections/page.tsx (currently
                    renders FinancialIntegrations catalogue, NOT the Link launcher)
Current behavior:   Renders a platform catalogue listing dozens of "platforms with
                    Coming Soon" rather than offering "Connect your bank now."
                    PlaidLinkButton.tsx exists at components/integrations/ but is
                    not mounted anywhere user-reachable.
Expected behavior:  Page shows: connected accounts list + a prominent "Connect a Bank"
                    button that opens Plaid Link → on token return → exchange → sync.
Data dependency:    finance.financial_accounts (✓ for listing)
Schema dependency:  none new
Risk:               LOW — Plaid Link is a battle-tested component
Estimated effort:   2 h
Recommended fix:    Replace the page content with: <PlaidLinkButton onSuccess={...}>,
                    + connected accounts list, + manual entry fallback.
Implement now / defer / hide:   IMPLEMENT NOW (after Plaid env vars confirmed)
```

## P0-5 · Verify Plaid env vars live on Vercel

```
Route/component:    Vercel project settings (operational)
Current behavior:   /api/integrations/plaid/activate-persona returns 503 if
                    PLAID_CLIENT_ID or PLAID_CLIENT_SECRET are unset.
Expected behavior:  Sample persona activation works for the first beta user.
Data dependency:    n/a
Schema dependency:  n/a
Risk:               LOW
Estimated effort:   5 min
Recommended fix:    Operator confirms both env vars are set on Vercel for production.
                    If sandbox is intended, also confirm PLAID_ENV=sandbox.
Implement now / defer / hide:   OPERATOR NOW
```

## P0-6 · `git push origin main` + verify Vercel deploys

```
Route/component:    operational
Current behavior:   The last 8 commits (Sprint T + audit reports + chat + finance +
                    Header identity) are local-only. Nothing recent is live for
                    the operator at app.lifenavigator.tech.
Expected behavior:  Push → Vercel auto-deploys → operator sees real name + chat link
                    + real finance data after persona activation.
Data dependency:    n/a
Schema dependency:  P0-1 ideally already pushed
Risk:               LOW for push; depends on build success
Estimated effort:   10 min
Recommended fix:    git push origin main; watch Vercel deploy log; smoke
                    /healthz + /dashboard.
Implement now / defer / hide:   IMPLEMENT NOW
```

## P0-7 · Rotate 2 leaked Supabase passwords from prior sessions

```
Route/component:    operational
Current behavior:   `Techgenius!$#1` (Supabase account) and `LifeNav!$#007` (Supabase
                    DB password) are in conversation transcript logs.
Expected behavior:  Both rotated; downstream Edge Function secrets re-staged where
                    they reference the old DB password.
Data dependency:    n/a
Schema dependency:  n/a
Risk:               security hygiene
Estimated effort:   15 min (operator-only)
Recommended fix:    1. supabase.com/dashboard/account/security → new account password.
                    2. Project Settings → Database → reset DB password.
                    3. Update Edge Function secrets that reference the DB password.
                    4. New supabase access token; revoke old.
Implement now / defer / hide:   OPERATOR NOW
```

---

# P1 — Blocks domain visibility

For each: hide for v1, build later per-domain as time allows. The bias is _do not show pages that crash or 404 silently_; one or two of these can be promoted to "build now" if the operator wants a specific narrative.

## P1-1 · Career landing

```
Route:              /dashboard/career/page.tsx (369 lines real UI)
Current behavior:   Calls /api/career → 404. Empty.
Expected behavior:  Career profile + jobs + skills surfaced.
Data dependency:    LinkedIn integration (lib/integrations/linkedin/ exists) + manual entry.
Schema dependency:  Migration 032 (career_domain) applied — has some public tables. Schema
                    `career` does NOT exist; the deeper expansion (065_career_education_
                    expansion + 072_career_marketplace) was skipped.
Risk:               HIGH if shown.
Estimated effort:   6-12 h to build /api/career aggregator + honest empty state.
Recommended fix:    HIDE. Build career endpoint + landing in v1.1.
Implement now / defer / hide:   HIDE (already covered by P0-2)
```

## P1-2 · Education landing

```
Route:              /dashboard/education/page.tsx (119 lines)
Current behavior:   Landing renders; sub-pages overview + progress = <ComingSoon />.
                    Some endpoints exist (/api/education/courses, certifications,
                    records) — verify they return data on the linked DB.
Expected behavior:  Real education profile (courses, certs, learning paths).
Data dependency:    Credly integration + manual entry.
Schema dependency:  Migration 033 (education_domain) applied. Schema `education` does
                    NOT exist. Deeper expansion (065) skipped.
Risk:               HIGH if shown.
Estimated effort:   4-8 h to verify existing endpoints + replace stubs with empty states.
Recommended fix:    HIDE. Verify the 3 working endpoints. Replace stubs with honest
                    "Add your first <thing>" cards.
Implement now / defer / hide:   HIDE (covered by P0-2)
```

## P1-3 · Healthcare landing

```
Route:              /dashboard/healthcare/page.tsx (709 lines)
Current behavior:   Lots of polished UI. /api/healthcare 404s. /api/healthcare/
                    appointments 404. /api/healthcare/records 404. /api/documents 404.
                    Every backing endpoint missing.
Expected behavior:  Real health records, appointments, insurance, wellness.
Data dependency:    Manual entry + provider connections.
Schema dependency:  `health` schema does NOT exist. `health_meta` exists but its log
                    tables (workout/supplement/medication/health_profile) don't —
                    migration 069 skipped.
Risk:               VERY HIGH. The biggest "looks done, does nothing" surface in the app.
Estimated effort:   12-20 h to wire endpoints + decide sub-pages.
Recommended fix:    HIDE — strictly. v2 rebuild.
Implement now / defer / hide:   HIDE (covered by P0-2)
```

## P1-4 · Calendar landing

```
Route:              /dashboard/calendar/page.tsx (420 lines)
Current behavior:   /api/calendar/events 404. /api/calendar/sources 404. Empty.
Expected behavior:  Synced Google/Outlook events.
Data dependency:    OAuth (Google + Microsoft) + Supabase Edge Function calendar-sync
                    (v4 deployed on the project).
Schema dependency:  Migration 035 (calendar_email) applied — tables probably live in
                    public.* or core.*. Verify before building.
Risk:               MEDIUM.
Estimated effort:   8-16 h (needs OAuth Connect UI).
Recommended fix:    HIDE. Build with calendar OAuth + ICS view in v1.1.
Implement now / defer / hide:   HIDE (covered by P0-2)
```

## P1-5 · Roadmap landing

```
Route:              /dashboard/roadmap/page.tsx (106 lines = <ComingSoon />)
Current behavior:   Landing itself is a stub. Insights + comprehensive sub-pages also
                    stubs. roadmap/finance (508 lines) needs `public.life_scenarios`
                    table which doesn't exist (migration 071 skipped).
Expected behavior:  Long-horizon multi-axis trajectory visualization.
Data dependency:    Scenario lab + outcome attribution.
Schema dependency:  Migrations 071, 076, 080, 081, 082 all skipped.
Risk:               HIGH — landing is literally <ComingSoon />.
Estimated effort:   30+ h post v1.
Recommended fix:    HIDE.
Implement now / defer / hide:   HIDE (covered by P0-2)
```

## P1-6 · Finance sub-page empty states (the silent 404 pages)

```
Routes:             /dashboard/finance/budget, /investments, /risk, /tax, /retirement,
                    /assets (also /next-dollar-optimizer if not verified)
Current behavior:   Each calls one or more endpoints that don't exist. Pages render
                    a bare layout with empty data.
Expected behavior:  Honest empty state: "Connect your accounts (or activate a sample
                    persona) to see your <X>."
Data dependency:    Plaid sync coverage; investment + retirement tables.
Schema dependency:  Each needs its own (skipped 062 / 064 / 071 expansion).
Risk:               MEDIUM — reachable via Finance landing sidebar.
Estimated effort:   3 h total to add per-page empty-state guards.
Recommended fix:    For each: wrap the data fetch in a try/catch. On 404 or empty,
                    render an honest empty state card with the same persona-activation
                    or Plaid-Link CTA used on /dashboard.
Implement now / defer / hide:   IMPLEMENT NOW (during P0-2 rollback)
```

## P1-7 · Family page

```
Route:              /dashboard/family/page.tsx
Current behavior:   Calls /api/family/members + /api/family/pets — both 404. Not in
                    sidebar so not user-reachable today.
Expected behavior:  Family members + dependents profiles.
Data dependency:    Skipped migration 066 (family_lifestyle).
Schema dependency:  Tables not present.
Risk:               LOW (invisible).
Estimated effort:   4-8 h.
Recommended fix:    DEFER. Confirm no link routes there from any other page.
Implement now / defer / hide:   DEFER
```

---

# P2 — Polish

## P2-1 · ComingSoon stubs to delete or rebuild

```
Files:              finance/investment-calculator/page.tsx, education/overview,
                    education/progress, roadmap/insights, roadmap/comprehensive,
                    roadmap/page.tsx, components/onboarding/BasicProfileQuestionnaire,
                    components/conversation/DiscoveryChat (false positive — it ONLY
                    has "Coming Soon" in a label string)
Action:             After P0-2 (re-hide) most are unreachable. The finance/investment-
                    calculator is the one that remains user-reachable. Replace it with
                    a real calculator that mirrors retirement-calculator's pattern.
Recommendation:     DELETE roadmap stubs; REBUILD investment-calculator (low effort).
Implement now / defer / hide:   DEFER (no user impact post P0-2)
```

## P2-2 · DeviceMockup chrome shows `.ai` instead of `.tech`

```
Component:          components/brand/DeviceMockup.tsx (or wherever the browser chrome
                    label is set)
Action:             Search & replace 'lifenavigator.ai' → 'lifenavigator.tech'.
Impact:             Visible on the marketing site to every visitor.
Estimated effort:   5 min
Implement now / defer / hide:   DEFER (P2 batch)
```

## P2-3 · Sign-out redirect URL

```
Component:          components/layout/Header.tsx handleSignOut
Current:            router.push('/auth/login')
Expected:           router.push('/auth?mode=signin')  (the unified auth route)
Estimated effort:   5 min
Implement now / defer / hide:   DEFER (P2 batch)
```

## P2-4 · Empty display_name fallback to email local-part is ugly

```
Component:          Header.tsx (computed in the new useEffect from a047492)
Current:            "tim+test@gmail.com" → shows "tim+test" as the name
Expected:           Discovery conversation FIRST question asks "What should I call you?"
                    and stores result on profiles.display_name → Header reads it.
Estimated effort:   already covered by P0-3 (Discovery conversation)
Implement now / defer / hide:   DEFER (resolved by P0-3)
```

## P2-5 · Profile page is <ComingSoon />

```
Route:              /dashboard/profile/page.tsx
Action:             Build a small page that shows the same data Header reads (name,
                    initials, email, display_name editor) + save button.
Estimated effort:   2 h
Implement now / defer / hide:   DEFER (P2 batch)
```

## P2-6 · Verify Cypher → Neo4j → Personal context end-to-end

```
Component:          supabase/functions/graphrag-query/index.ts + Neo4j single-shared DB
Action:             Smoke test: activate a persona → ask "what's my checking balance"
                    in chat → verify the response cites the persona's actual balance.
                    If empty, the graph-promotion path is broken (queue → Neo4j) and
                    Cypher returns no rows.
Estimated effort:   30 min to test, multi-hour if broken.
Implement now / defer / hide:   IMPLEMENT NOW (Critical smoke test before opening cohort)
                                — promote to P0 if it fails.
```

## P2-7 · Recommendation engine + /api/financial share a single read module

```
Risk:               minor duplication; both read finance.* with similar logic
Action:             Extract a shared lib/finance/account-and-transaction-reader.ts
                    and call from both.
Estimated effort:   2 h
Implement now / defer / hide:   DEFER
```

## P2-8 · Server-side prior-message context (post-107)

```
Risk:               client sends previous_messages — an attacker could fake conversation
                    history to influence subsequent grounding.
Action:             After 107 lands + chat.messages persists, switch the Edge Function
                    to load prior turns from chat.messages on the server.
Estimated effort:   3 h
Implement now / defer / hide:   DEFER (post P0-1)
```

---

# Summary

The platform is genuinely close to a real 20-user beta. Two-layer GraphRAG, governance, character, the sample-persona flow, the unified auth experience, and the brand site are all live. The Finance dashboard renders real Plaid data (post `12ac619`).

The seven P0 items plus the planned six-step execution sequence get the experience to **9/10** — premium, intelligent, personal. Past that, every gain is months of disciplined per-domain build work. The right v1 target is 9/10 with an honest set of visible features.

See `EXECUTION_SEQUENCE.md` for the exact order.
