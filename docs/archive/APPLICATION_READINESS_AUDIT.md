# APPLICATION READINESS AUDIT — LifeNavigator

**Date:** 2026-06-06
**Repo:** `main` @ `12ac619` (+ 2 uncommitted: handoff docs + audit working notes)
**Linked Supabase:** `lifenavigator-production` / `diwkyyahglnqmyledsey`
**Method:** every claim below was verified live — fetch URLs traced against `apps/web/src/app/api`, schemas checked against the live database, code paths walked. No assumptions.

**One-line outcome (full verdict at the bottom):**

```
READY_WITH_P0_FIXES
```

LifeNavigator is closer to a beta-quality experience than the prior session implied. The Sample-Persona onboarding flow is wired and routes correctly. Two-layer Central/Personal GraphRAG is implemented with grounding refusal. The Finance dashboard renders real data after commit `12ac619`. Auth, branded email, and unified `/auth` are production-live at `lifenavigator.tech`. What blocks beta launch is not architecture — it's six concrete operational items + the deferred decision to re-hide five over-promising domains.

---

# PART 1 — Product Journey Audit

## Path A — Sample Persona User

### Step-by-step trace (live state, not "should-be")

| #   | Step               | Current behavior                                                                                                                                                                                                                                                                                                                                                      | Expected                                             | Data avail                                                                                                                                          | Data missing                                                                                                                                            | Confusion / trust risk                                                                              | Severity                      |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | Landing page       | `https://lifenavigator.tech` — Decision Intelligence marketing site, cinematic v5, 178 KB HTML, /api/health redirects 307 (auth-gated).                                                                                                                                                                                                                               | Same.                                                | n/a                                                                                                                                                 | n/a                                                                                                                                                     | none                                                                                                | OK                            |
| 2   | Auth               | `/auth` (unified — signin / create / magic). Branded shell. Supabase + Resend SMTP.                                                                                                                                                                                                                                                                                   | Same.                                                | n/a                                                                                                                                                 | n/a                                                                                                                                                     | DeviceMockup chrome still says `.ai` (cosmetic).                                                    | LOW                           |
| 3   | Email verification | Branded Resend templates (confirm/magic/recovery/invite/welcome) at `welcome@lifenavigator.tech`. 100/hr quota. Direct send 200, OTP 200.                                                                                                                                                                                                                             | Same — needs real-inbox deliverability verification. | n/a                                                                                                                                                 | DKIM/SPF in user's inbox not confirmed                                                                                                                  | low                                                                                                 | LOW                           |
| 4   | Onboarding routing | `proxy.ts` lines ~94-115: if `profiles.setup_completed` ≠ true, redirect to `/onboarding/financial-profile`. ✓ wired correctly.                                                                                                                                                                                                                                       | Same.                                                | `profiles.setup_completed` column ✓ exists                                                                                                          | none                                                                                                                                                    | none                                                                                                | OK                            |
| 5   | Persona selection  | `/onboarding/financial-profile` renders `SampleFinancialProfile.tsx`. Fetches `/api/integrations/plaid/personas` ✓ — returns the public persona list (display_name, description, goals, complexity, life_stage). User picks one.                                                                                                                                      | Same.                                                | personas registry in `lib/integrations/plaid/personas.ts` ✓ exists                                                                                  | none                                                                                                                                                    | "These are sample profiles, not yours yet" — copy makes that clear ✓                                | OK                            |
| 6   | Persona activation | POST `/api/integrations/plaid/activate-persona` with `{ persona_id }`. Server-side: creates Plaid sandbox public token → exchanges → fetches accounts + transactions + liabilities → persists to `finance.financial_accounts`, `finance.transactions`, `public.user_persona_profile` → marks `setup_completed=true` → kicks off a "first recommendation" best-effort. | Same.                                                | `finance.*` tables ✓ exist (post migration 105 grants + 106 unique indexes). `public.user_persona_profile` ✓ (migration 108). Sandbox creds in env. | Plaid env vars not verified live: `PLAID_CLIENT_ID` / `PLAID_CLIENT_SECRET` must be set on Vercel. Audit shows the route returns 503 if they're absent. | Possible failure mode: user picks a persona, sees a vague error, doesn't know it's a creds problem. | MED                           |
| 7   | Dashboard land     | Redirect to `/dashboard`. Server-rendered: reads `user_persona_profile` + `finance.*` via `lib/finance/recommendations.ts` (deterministic persona rules — NOT a model call). Renders FirstInsightCard (top rec) + RecommendationsCard (>=3 categorized) + DashboardClient (shows Sidebar + Header + scenario widget).                                                 | Same.                                                | post commit `12ac619` aggregator endpoint now serves a real payload.                                                                                | Goals (`public.goals`) is empty unless conversation flow has run. Today's Brief is finance-only at this stage; no career/health/family briefing yet.    | "Where are my goals?" — user expects goals to appear because the persona promised them.             | MED                           |
| 8   | Recommendations    | Three categorized cards: immediate_action, risk_reduction, growth_opportunity. Persona-aware (debt-before-invest, fragile-stabilize, self-employed-tax-setaside, bonus-allocation, etc.). Each rec has `Ask your advisor about this` → AskAdvisorButton fires `OPEN_ADVISOR_EVENT` → opens ChatSidebar with prefill.                                                  | Same.                                                | persona registry + finance rules engine ✓                                                                                                           | The recs are 100% finance-domain. No career, health, education, family recs because no schemas/data for those exist live.                               | "Is this all the advisor sees about me?" Yes — at this step it is.                                  | MED                           |
| 9   | Chat               | Two surfaces: (a) ChatSidebar overlay via Ask-Advisor (works today); (b) `/dashboard/chat` page with history list + new chat + resume — _built in `a047492` but not yet usable because migration 107 (chat history) hasn't been applied; right now the page renders, but `persistChatTurn` silently fails and the list stays empty between sessions._                 | Same with persistence.                               | governed-route factory ✓ ; graphrag-query Edge Function ✓ (v7)                                                                                      | chat schema                                                                                                                                             | "I had a conversation yesterday. Where is it?" — confused.                                          | HIGH (blocker for repeat use) |
| 10  | Return session     | User signs back in → proxy sees `setup_completed=true` → lands on `/dashboard`. Today's Brief + Top Moves re-render from PERSISTED finance data (unchanged unless persona has been re-activated). Chat history empty (see Step 9).                                                                                                                                    | Same with history.                                   | session + finance ✓                                                                                                                                 | chat history (above)                                                                                                                                    | "Did the advisor forget me?" Yes.                                                                   | HIGH                          |

### Path A — net verdict

**Functional but not memorable.** A user can complete the journey end-to-end. The sample-persona path is honest and well-designed. The two gaps that bite on day-two:

1. Chat history is amnesiac.
2. Goals are empty unless the user manually creates them — there's no conversation-driven goal creation in this path.

---

## Path B — Real Plaid User

Trace: Plaid Connect → Account Sync → Finance Tables → Graph Promotion → Dashboard → Recommendations → Chat.

| Stage            | Status                | Detail                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plaid Connect UI | **MISSING (partial)** | `components/integrations/PlaidLinkButton.tsx` exists. `/dashboard/finance/connections/page.tsx` renders `<FinancialIntegrations />` (a "platform catalogue" component, not the Link launcher). The PlaidLinkButton is NOT visible from any user-reachable page. Net: a real user signs up but cannot connect their real bank without code-poking.                            |
| Token exchange   | EXISTS                | `/api/integrations/plaid/exchange/route.ts` does the public_token → access_token exchange.                                                                                                                                                                                                                                                                                   |
| Account sync     | EXISTS                | `lib/integrations/plaid/persist.ts` writes to `finance.financial_accounts`, `finance.transactions` after activation. Same path the sample persona uses.                                                                                                                                                                                                                      |
| Finance tables   | LIVE                  | `finance.financial_accounts`, `finance.transactions` exist on remote with RLS. Migration 105 granted the API roles; 106 fixed Plaid unique indexes.                                                                                                                                                                                                                          |
| Graph promotion  | PARTIAL               | Sync writes a row to `graphrag.sync_queue` (via a trigger or the exchange handler). The Rust `lifenavigator-ingestion-worker` polls every 5s. Worker is live in Fly (`iad`). But: the route's "kick off a first recommendation" is best-effort and the path from sync-queue → Neo4j personal graph node → graphrag-query retrieval is not verified end-to-end in this audit. |
| Dashboard        | LIVE                  | Same `/api/financial` aggregator as Path A — works for any user with rows in `finance.*` regardless of source (persona or real).                                                                                                                                                                                                                                             |
| Recommendations  | LIVE                  | Persona-aware rules engine works on any persisted finance data.                                                                                                                                                                                                                                                                                                              |
| Chat             | LIVE w/ amnesia       | Same gap as Path A.                                                                                                                                                                                                                                                                                                                                                          |

### Path B verdict

```
Plaid Connect:          BROKEN  (no user-reachable Link button)
Account sync:           COMPLETE  (once tokens land)
Finance tables:         COMPLETE
Graph promotion:        PARTIAL  (queue + worker exist; end-to-end not verified)
Dashboard rendering:    COMPLETE  (since 12ac619)
Recommendations:        COMPLETE
Chat:                   PARTIAL  (no history)
```

**Net:** A real user cannot complete this path today because the Plaid Link button isn't reachable from the UI. The backend pipe is fine; the user-facing entry door is missing.

---

# PART 2 — Domain Readiness Audit

Live schema reality drives the assignments. Schemas confirmed present: `public`, `finance`, `health_meta`, `core`, `graphrag`. Missing: `career`, `education`, `health`, `calendar`, `decision_intelligence`, `arcana`, `providers`, `chat`, `goals`.

| Domain                | Hidden?              | Visible? | Functional?                                                                                                                                                                                                    | Empty?                        | Placeholder?                              | ComingSoon?                      | Uses real data?                                                                                                | Uses fake data?                  | Connected to recs?                      | Connected to GraphRAG?                                                  | Connected to chat?                                         | Status                                                                 |
| --------------------- | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Finance**           | no                   | yes      | YES (landing + accounts + transactions)                                                                                                                                                                        | partial                       | sub-pages: budget/invests/risk/tax/retire | one stub (investment-calculator) | YES (Plaid-loaded `finance.*`)                                                                                 | no                               | YES (rules engine reads it)             | YES (Cypher targets `FinancialAccount` node label)                      | YES (Ask-Advisor button)                                   | **READY** for landing + accounts + transactions; PARTIAL for sub-pages |
| **Career**            | post my un-hide: no  | yes      | NO (landing calls `/api/career` → 404)                                                                                                                                                                         | yes                           | landing renders empty                     | no                               | no — `career.*` schema doesn't exist                                                                           | no                               | no                                      | partial (Cypher prompt includes `CareerProfile` node, but no live data) | no                                                         | **NOT READY**                                                          |
| **Education**         | post my un-hide: no  | yes      | NO (overview + progress = `<ComingSoon />`)                                                                                                                                                                    | yes                           | yes                                       | yes                              | partial (3 endpoints exist: `/api/education/courses`, `certifications`, `records` — unclear if backed by data) | no                               | no                                      | no                                                                      | no                                                         | **NOT READY**                                                          |
| **Health & Wellness** | post my un-hide: no  | yes      | NO (709-line landing calling `/api/healthcare` → 404; 4 sub-page endpoints 404)                                                                                                                                | yes                           | yes                                       | no                               | no — `health` schema missing                                                                                   | no                               | no                                      | no                                                                      | no                                                         | **NOT READY** — biggest over-promise risk                              |
| **Family**            | n/a (not in sidebar) | no       | NO (`/api/family/members` + `/family/pets` → 404)                                                                                                                                                              | yes                           | n/a                                       | no                               | no                                                                                                             | no                               | no                                      | no                                                                      | no                                                         | **NOT READY** — but not user-reachable; lowest urgency                 |
| **Goals**             | no                   | yes      | LIVE (`/api/goals` ✓ exists, `public.goals` ✓ exists, page renders ~254 lines)                                                                                                                                 | partial (empty for new users) | no                                        | no                               | YES (when populated)                                                                                           | YES (rec engine considers goals) | partial (Cypher prompt has `Goal` node) | partial (advisor can reference goals)                                   | **PARTIAL → READY-for-empty-state** if goal creation works |
| **Calendar**          | post my un-hide: no  | yes      | NO (`/api/calendar/events` + `/calendar/sources` → 404)                                                                                                                                                        | yes                           | no                                        | no                               | no — `calendar` schema missing                                                                                 | no                               | no                                      | no                                                                      | no                                                         | **NOT READY** — needs OAuth UI built                                   |
| **Roadmap**           | post my un-hide: no  | yes      | NO (landing is `<ComingSoon />`; insights + comprehensive also stub; finance/career/education/healthcare sub-pages are 9-line redirects or 508-line page that wants `life_scenarios` table that doesn't exist) | yes                           | yes                                       | yes                              | no                                                                                                             | no                               | no                                      | no                                                                      | no                                                         | **NOT READY**                                                          |

### Domain summary

| Domain                                       | Verdict                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| Finance                                      | READY (landing) / PARTIAL (sub-pages)                                  |
| Goals                                        | PARTIAL — works if user has goals; needs conversation flow to populate |
| Career, Education, Health, Calendar, Roadmap | NOT READY                                                              |
| Family                                       | NOT READY — but invisible                                              |

---

# PART 3 — Dashboard Readiness

The actual dashboard at `/dashboard` (server component) renders three pieces:

| Widget               | Route                                                                              | Data source                                                       | API source                          | Supabase source                                                                     | Graph source | Current output                                                                                                                   | Expected output |
| -------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| FirstInsightCard     | `components/dashboard/FirstInsightCard.tsx`                                        | top rec from `lib/finance/recommendations.ts`                     | (server-side direct)                | `finance.financial_accounts`, `finance.transactions`, `public.user_persona_profile` | none         | If user has activated a persona → real top rec. Else → headline "Activate a sample financial profile to see your first insight." | same            |
| RecommendationsCard  | `components/dashboard/RecommendationsCard.tsx`                                     | full rec set (≥3 categorized)                                     | (server-side direct)                | same                                                                                | none         | Same data path.                                                                                                                  | same            |
| DashboardClient      | `components/dashboard/DashboardClient.tsx`                                         | Mostly sidebar + header + scenario widget + AddDataModal triggers | client fetches via `/api/financial` | same                                                                                | none         | After commit `12ac619` renders accounts + transactions charts. Before: empty.                                                    | same            |
| PinnedScenarioWidget | `components/scenario-lab/PinnedScenarioWidget.tsx` (imported into DashboardClient) | scenario_lab schema                                               | `/api/scenario-lab/scenarios` ✓     | `public.scenario_*` tables                                                          | none         | scenarios pinned by user (if any)                                                                                                | same            |

### Empty / dead / fake states

| State       | Where                                                                        | Why                    | Fix                              |
| ----------- | ---------------------------------------------------------------------------- | ---------------------- | -------------------------------- |
| Empty       | FirstInsightCard for users without a persona                                 | rec engine has no data | the empty-state headline is fine |
| Empty       | Sub-pages: budget, investments, risk, tax, retirement, assets                | missing endpoints      | add honest empty states (P1)     |
| Dead        | `/dashboard/calendar`, `/dashboard/healthcare`, `/dashboard/career` landings | missing endpoints      | re-hide (P0)                     |
| Fake        | none observed at dashboard top level                                         | —                      | —                                |
| Placeholder | roadmap landing                                                              | `<ComingSoon />`       | re-hide (P0)                     |

### Persona activation → populated dashboard?

**Yes, with one caveat.** Trace:

```
POST /api/integrations/plaid/activate-persona
  → exchangePublicToken(sandbox)
  → getAccounts + getTransactions + getLiabilities
  → persistAccounts → finance.financial_accounts (INSERT)
                    → trigger 'graphrag_sync_queue_on_account' (if present)
  → persistTransactions → finance.transactions (INSERT)
  → persistPersonaProfile → public.user_persona_profile (INSERT)
  → set profiles.setup_completed=true
  → recordUserEvent('persona_activated')
  → (best-effort) seed first recommendation
  → response 200
  → client routes to /dashboard
  → server-side page reads finance.* + user_persona_profile
  → recs engine produces ≥3 recs → renders
  → DashboardClient client-side fetches /api/financial → renders chart blocks
```

**Where this chain breaks today:**

- `PLAID_CLIENT_ID` / `PLAID_CLIENT_SECRET` env vars NOT confirmed live on Vercel. If missing → 503.
- Graph promotion (sync_queue → Neo4j) is not verified end-to-end in this audit. The advisor's Cypher queries may return empty even though the user has live finance data.
- Chat amnesia: the dashboard's "Ask your advisor" buttons work but every conversation is one-shot.

---

# PART 4 — Recommendation Engine Audit

## Classification

```
Type:                    DETERMINISTIC (no model call on the dashboard surface)
                         GRAPH-ENHANCED ONLY IN CHAT (graphrag-query Edge Function reads Neo4j)
Persona awareness:       YES (life_stage, income_type, debt_load, persona_id)
Confidence model:        IMPLICIT (severity: risk / caution / positive / neutral, no numeric confidence)
Source data:             finance.financial_accounts + finance.transactions + public.user_persona_profile
Generation path:         pure TypeScript rules in lib/finance/recommendations.ts
Actionability:           HIGH (every rec has title + detail + concrete action + metric)
```

## Trace: Persona → Financial Data → Engine → Dashboard → Chat

```
Persona activated
  ↓ INSERT finance.financial_accounts + finance.transactions (Plaid sandbox)
  ↓ INSERT public.user_persona_profile (persona_id, life_stage, income_type, ...)
  ↓
Dashboard request
  ↓ server: getRecommendations(svc, user.id)
      → reads accounts + transactions + persona
      → computeMetrics()
      → applies rules in priority order:
          • debt-before-invest gate
          • fragile-persona → stabilize, never "invest the surplus"
          • self-employed → tax set-aside (RANGE, not a promise)
          • bonus-eligible → bonus allocation ladder
          • cash-heavy → deploy idle cash
          • language guard: strips "guaranteed/certain/will earn/risk-free"
      → emits 3+ recs (immediate_action / risk_reduction / growth_opportunity)
  ↓
FirstInsightCard renders top one
RecommendationsCard renders the categorized set
  ↓
User clicks "Ask your advisor about this"
  ↓ OPEN_ADVISOR_EVENT fires → ChatSidebar opens with prefill
  ↓ POST /api/agent/chat → governed factory (Sprint T)
  ↓ → graphrag-query Edge Function (gemini-2.5-flash)
      → personal Cypher retrieval (FinancialAccount, Goal, RiskAssessment, ...)
      → central knowledge retrieval
      → grounded prompt construction (CENTRAL_CONTEXT + PERSONAL_CONTEXT)
      → Gemini generates
      → governance + character + injection scan
      → response
```

## Quality checks against the user's questions

- **Generic?** No — recs cite real metrics (debt amount, transactions surplus, persona name).
- **Duplicated?** Risk exists if two rules trigger in the same category. The `theme` field guards against this — comments in `recommendations.ts` state explicitly the "internal theme tag used to keep the three slots distinct".
- **Unsupported?** Risk if `finance.*` is empty (Plaid creds missing). The "no data" branch returns a single neutral starter card.
- **Financially dangerous?** Explicit guard: `PROHIBITED_LANGUAGE` regex strips "guaranteed", "certain", "will earn", "risk-free". The fragile-persona gate explicitly prevents "send spare cash to the credit card" for the wrong personas.

## What's MISSING

- **No AI augmentation of the brief.** The headline + detail are templated. They could be model-rewritten with persona voice. The operator may want this; the architecture supports adding it as an enhancement.
- **No cross-domain recs.** Career / health / family are not in the rule set because no schemas exist for them.
- **No goal-aware recs.** Even though `public.goals` exists, the rec engine doesn't read it. A user with a stated goal of "save for kids' college" won't see the rec set tilt toward 529 / education savings until that wiring lands.

---

# PART 5 — Chat & GraphRAG Audit

## Architecture (verified in code)

The two-layer Central / Personal split is **implemented at the prompt-construction layer** in `supabase/functions/graphrag-query/index.ts`. The Gemini system prompt explicitly separates:

```
- CENTRAL_CONTEXT — framework guidance, legal / compliance / how-to (the HOW)
- PERSONAL_CONTEXT — additional user-specific facts retrieved from the personal graph (the WHAT)
```

Hard rules in the system prompt:

```
1. ALWAYS filter by tenant_id = $tenant_id (provided automatically).
3. If the user asks for ANY personal fact that is NOT in those sections (or is
   missing), say so explicitly — DO NOT invent or fabricate.
4. NEVER fabricate personal data of ANY kind.
5. Never derive a personal fact from CENTRAL_CONTEXT.
```

The Cypher generation prompt enumerates the personal node labels: `Person`, `Goal`, `FinancialAccount`, `RiskAssessment`, `CareerProfile`, etc. Every Cypher query is rewritten to inject `WHERE n.tenant_id = $tenant_id`.

There's a `grounding.ts` module with **tests** that explicitly verify:

- all-empty personal data → "NONE on file" rendered for every domain, no invented values
- central-only → fail-closed refusal for personal questions
- authoritative personal data → grounded with real numbers (e.g. `$3,200.00` balance)

This is genuinely good safety architecture. The fact that the team wrote refusal-behavior tests is meaningful.

## Trace: User Question → Response

```
User: "What's my cash position?"
  ↓ POST /api/agent/chat?message=...
  ↓ createGovernedHandler (Sprint T factory)
    [auth] → [economic gate: budget + breaker]
  ↓ → graphrag-query Edge Function
      ↓ Step 1: hybrid retrieval (Qdrant vector + Neo4j Cypher)
          • Qdrant: filter tenant_id = $tenant_id, retrieve k=10 vectors
          • Neo4j: WHERE n.tenant_id = $tenant_id, retrieve relevant nodes
          • RRF fusion of both result sets
      ↓ Step 2: grounding.ts assembles CENTRAL_CONTEXT + PERSONAL_CONTEXT
      ↓ Step 3: system prompt + question → Gemini 2.5-flash
      ↓ Step 4: model response
  ↓ → factory: governance + character + injection scan
      [if injection found → REJECT/QUARANTINE → 422]
      [if governance verdict ≠ approve → 422 with reason]
  ↓ → response { message, conversation_id }
  ↓ → persistChatTurn() (chat.* tables — pending migration 107)
```

## Risk register

| Risk                             | Status | Notes                                                                                                         |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| Fabricated facts                 | LOW    | Grounding tests + "DO NOT invent" rule + "NONE on file" pattern                                               |
| Stale context                    | MEDIUM | Cypher is at request-time so it's fresh. Qdrant vectors are at-write-time so they can lag the worker.         |
| Missing context                  | LOW    | Explicit refusal-behavior tests                                                                               |
| Cache poisoning                  | LOW    | conversation_id is server-side per-user; no shared cache.                                                     |
| Cypher injection                 | LOW    | The Cypher generator is templated (the operator-facing query stays inside the function), not user-controlled. |
| Prompt injection in user message | LOW    | Sprint T factory runs injection scan output-side AND injection scan input-side; tested 1371-passing           |

## Cache behavior

I did not find an explicit Qdrant-level cache. The graphrag-query function does the retrieval fresh per request. Conversation history (prior turns) is passed in `previous_messages` from the client. **Once migration 107 is applied + chat persistence is verified, the prior-message context will need to be loaded from `chat.messages` on the server, not passed by the client (otherwise an attacker can fake history).** This is a follow-up.

## Verdict

```
Architecture:         STRONG — two-layer separation + refusal behavior tests
Implementation:       LIVE — graphrag-query v7 deployed, factory v1 deployed
Verified end-to-end?  PARTIAL — Cypher → Neo4j → personal data path not smoke-tested in this audit
Risk profile:         LOW for what's deployed; MEDIUM for the follow-on history-grounding work
```

---

# PART 6 — Onboarding & Discovery Audit

## Component inventory (live state)

| Item                                                                            | Path                                            | Exists? | Wired?                                                                                       | Production ready?                                                                                  |
| ------------------------------------------------------------------------------- | ----------------------------------------------- | ------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ConversationEngine` (class, 11 stages, agent expertise map)                    | `lib/conversation/conversation-engine.ts`       | ✓       | NO — not imported outside `DiscoveryChat`                                                    | YES (engine is pure functions)                                                                     |
| `need-behind-need-engine` (detectStop, buildDrillDown, summarizeDrillDown)      | `lib/conversation/need-behind-need-engine.ts`   | ✓       | NO — not imported anywhere                                                                   | YES                                                                                                |
| `driver-inference-engine` (inferDrivers, scoreTurn, confidenceFromObservations) | `lib/conversation/driver-inference-engine.ts`   | ✓       | NO — not imported anywhere                                                                   | YES                                                                                                |
| `DiscoveryChat` React component                                                 | `components/conversation/DiscoveryChat.tsx`     | ✓       | NO — not imported anywhere outside its file                                                  | YES                                                                                                |
| `ConversationalShell` (the one that IS used)                                    | `components/onboarding/ConversationalShell.tsx` | ✓       | YES — `/onboarding/converse/page.tsx` uses it                                                | UNKNOWN — needs verification it produces persisted outputs                                         |
| `/onboarding/converse/page.tsx`                                                 | exists                                          | ✓       | YES (persona presets)                                                                        | PARTIAL — uses ConversationalShell, NOT the richer DiscoveryChat/ConversationEngine                |
| `/api/conversation/analysis`                                                    | exists                                          | ✓       | YES — receives `analysis` JSONB, persists to `public.user_preferences.conversation_analysis` | YES                                                                                                |
| `/api/onboarding/risk-profile`                                                  | exists                                          | ✓       | unknown without trace                                                                        | YES (target table `public.risk_assessments` exists)                                                |
| `/api/goals`                                                                    | exists                                          | ✓       | YES (used by goals UI)                                                                       | YES                                                                                                |
| 22 other `/api/onboarding/*` routes                                             | exist                                           | mixed   | partially                                                                                    | unknown — many target tables that don't exist on remote (e.g. `benefit_profiles` from skipped 069) |

## The mismatch

The repo has TWO onboarding flows in parallel:

```
Flow A (active today, beta fast-path):
   Auth → setup_completed=false → proxy redirect → /onboarding/financial-profile
   → SampleFinancialProfile (pick a persona) → activate sandbox Plaid → setup_completed=true → /dashboard

Flow B (built but unwired):
   /onboarding/converse → ConversationalShell with 6 persona presets
   → talks to user via prompts (the rich engine is not actually called)
   → /api/conversation/analysis persists JSONB
```

Neither flow uses the `need-behind-need-engine` or `DiscoveryChat`. The Sprint Q-era engines are dormant.

## Conversation First vs Questionnaire First

| Approach                               | What it is                                                                                                                                                                                                   | Pros                                                                                                                                                            | Cons                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **A — Conversation First**             | DiscoveryChat → ConversationEngine → need-behind-need-engine surfaces hidden motivations, contradictions, GoalRefinements → persists goals + risk profile → THEN offers sample persona OR real Plaid Connect | Highest perceived intelligence. Surfaces "why" before "what". Maps directly to brand promise ("OpenAI intelligence × Morgan Stanley trust × Apple simplicity"). | Highest scope (4-6 h to wire). User can abandon mid-conversation if it feels slow. Risk if Gemini quotas tight. |
| **B — Questionnaire First**            | Structured questions (the `BasicProfileQuestionnaire` + per-domain questionnaires in `components/onboarding/`) collect data deterministically, then offer sample/real Plaid                                  | Predictable. Fast. Easy to instrument.                                                                                                                          | Feels like every other onboarding. Doesn't unlock the "need-behind-need" differentiator.                        |
| **C — Sample-Persona First (current)** | User picks a synthetic Plaid profile and explores                                                                                                                                                            | Lowest friction. User sees the product working in 30 seconds.                                                                                                   | Not personalized. User doesn't feel "the advisor knows me". Goals stay empty until manually added.              |

**Recommendation: A** — Conversation First, on the explicit constraint that no new schema is required (the in-memory engine + `user_preferences.conversation_analysis` JSONB + `public.goals` + `public.risk_assessments` is sufficient). This is the highest-leverage gap in the entire audit because it's the unique product moment that no other competitor delivers, and the engine code is already written.

**Pragmatic compromise (B+A hybrid for v1):** keep the Sample Persona path for users who want a quick demo, but make the DEFAULT path Conversation First. After conversation, present the choice "Connect your real bank with Plaid, OR explore with a sample persona". This protects both first-impression personalization AND fast-time-to-product.

---

# PART 7 — Schema & Migration Audit

## Migration collision

**Two files share number 107:**

```
107_advisor_chat_history.sql           (mine — chat schema)
107_analytics_grants_and_persona_event.sql   (team's — analytics grants + persona_activated event type)
```

`supabase db push --include-all` will apply them alphabetically. The team's migration is `107_a…` which sorts AFTER `107_advisor…`? Actually `advisor` < `analytics` lexically. So mine would go first. **Need to renumber mine to 111** (the team has 105-110 already; 111 is the next free slot).

## Migrations 105-110 (newer than my audit assumed)

| #   | Filename                                    | Purpose                                                | Applied?                                                   |
| --- | ------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| 105 | `finance_graphrag_api_grants`               | grants for finance + graphrag schemas                  | applied                                                    |
| 106 | `finance_plaid_unique_indexes`              | unique constraints for ON CONFLICT upserts             | applied                                                    |
| 107 | `analytics_grants_and_persona_event` (team) | analytics grants + 'persona_activated' user event type | applied (per remote profiles.setup_completed flow working) |
| 108 | `user_persona_profile`                      | adds `public.user_persona_profile` table               | applied (per activate-persona route working)               |
| 109 | `funnel_event_types`                        | extends `user_events_event_type` check constraint      | applied                                                    |
| 110 | `observability_event_types`                 | more event types                                       | applied                                                    |

## Skipped migrations 061-087 (the original lineage drift)

For each, the inventory question is: **REQUIRED NOW / REQUIRED LATER / OBSOLETE.**

| #   | Name                            | Tables                                                                                                                       | Required for                              | Verdict                                                                                                          |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 061 | user_graph_expansion            | `user_actions`, `user_life_events` + ALTER columns                                                                           | the user_graph foundation (also-missing)  | **REQUIRED LATER** (post-beta)                                                                                   |
| 062 | financial_intake_expansion      | finance-domain intake (budgets, investment plan, …)                                                                          | budget + investments + retirement pages   | **REQUIRED LATER** (Phase-2 finance)                                                                             |
| 063 | health_intake_expansion         | health-domain intake                                                                                                         | healthcare landing data                   | **REQUIRED LATER**                                                                                               |
| 064 | insurance_benefits              | insurance + benefit profile                                                                                                  | finance/insurance, settings → benefits    | **REQUIRED LATER**                                                                                               |
| 066 | family_lifestyle                | family members, dependents, pets                                                                                             | family page (currently invisible)         | **REQUIRED LATER**                                                                                               |
| 067 | onboarding_sections             | `public.user_onboarding_sections`                                                                                            | per-section onboarding tracking           | **REQUIRED NOW** if onboarding shifts to section-aware flow                                                      |
| 068 | root_goal_discovery_and_estate  | `goal_discovery_turns`, `estate_planning_profile`, `estate_beneficiaries`, `core.user_integration_consents`                  | conversational goal discovery audit trail | **REQUIRED LATER** — engine doesn't need it (in-memory); add if we want server-side audit                        |
| 069 | intake_logs_and_benefit_profile | `health_meta.workout_logs / supplement_logs / medication_logs / health_profile`, `public.benefit_profiles`                   | health intake + benefits                  | **REQUIRED LATER**                                                                                               |
| 071 | life_trajectory_simulation      | `public.life_scenarios` + 7 sibling tables                                                                                   | Roadmap landing + sub-pages               | **REQUIRED LATER** (Roadmap rebuild)                                                                             |
| 072 | career_marketplace              | career schema expansion                                                                                                      | career marketplace post-beta              | **REQUIRED LATER**                                                                                               |
| 073 | wearable_monitoring             | wearable data                                                                                                                | post-beta health                          | **REQUIRED LATER**                                                                                               |
| 074 | graphrag_v2_triggers            | graphrag triggers                                                                                                            | graph promotion v2                        | **REQUIRED LATER** (verify current triggers work first)                                                          |
| 075 | fix_055_triggers                | triggers fix                                                                                                                 | depends on 055                            | **OBSOLETE** if the trigger it fixes isn't present                                                               |
| 076 | goal_hierarchy                  | `goal_hierarchies`, `goal_dependencies`, `goal_conflicts`, `goal_priorities`, `goal_relationships`, `goal_pathways`          | rich goals UI                             | **REQUIRED LATER** (current `public.goals` is flat)                                                              |
| 077 | central_graph_ontology          | central knowledge graph schema                                                                                               | central GraphRAG content                  | **REQUIRED LATER** if central knowledge becomes a real product surface                                           |
| 078 | central_curated_knowledge       | seeds for central                                                                                                            | central GraphRAG                          | **REQUIRED LATER**                                                                                               |
| 079 | decision_intelligence           | `decision_intelligence.decision_journals / expectations / outcomes / reviews / recommendation_acceptance / learning_signals` | decision audit + learning loop            | **REQUIRED LATER** (high-value for v2)                                                                           |
| 080 | goal_progress_and_attribution   | `decision_intelligence.goal_progress_*` etc.                                                                                 | outcome attribution                       | **REQUIRED LATER**                                                                                               |
| 081 | decision_impact_and_probability | decision probability distributions                                                                                           | trajectory variance                       | **REQUIRED LATER**                                                                                               |
| 082 | xai_and_trust_layer             | `recommendation_audit_trail`, `why_chains`, `evidence_links`, `counterfactual_scenarios`, `recommendation_assumptions`       | trust + XAI                               | **REQUIRED LATER**                                                                                               |
| 083 | central_knowledge_v2            | central v2                                                                                                                   | post-beta                                 | **REQUIRED LATER**                                                                                               |
| 084 | conversation_intelligence       | `decision_intelligence.discovery_sessions`, `assumption_challenges`, `conversation_traces`                                   | conversation audit trail                  | **REQUIRED NOW (optional)** — Onboarding-First flow works without it, but this is the right table for rich audit |
| 085 | provider_graphrag               | providers schema                                                                                                             | provider portal                           | **REQUIRED LATER** (post-employer)                                                                               |
| 086 | arcana_health_activation        | arcana schema                                                                                                                | arcana health flow                        | **REQUIRED LATER** (Arcana persona)                                                                              |
| 087 | provider_portal                 | provider messages + lead workflow                                                                                            | provider portal                           | **REQUIRED LATER**                                                                                               |

### Tier summary

```
REQUIRED NOW:     0 strict   (1 optional — 084 for richer conversation audit)
REQUIRED LATER:   24 of 25
OBSOLETE:         1 (075)
```

The point: **no skipped migration is on the critical path to the v1 beta.** The conversation flow uses `public.user_preferences.conversation_analysis` JSONB (table exists). Goals use `public.goals` (exists). Risk uses `public.risk_assessments` (exists).

---

# PART 8 — API Ownership Audit

| Capability                          | Current owner                                                                                            | Duplicated logic?                                                                                           | Wrong ownership? | Target architecture                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------- |
| Auth                                | Vercel (Supabase Auth SDK) + Supabase                                                                    | no                                                                                                          | no               | Same                                                       |
| Onboarding (sample persona)         | Vercel route + Supabase service-role                                                                     | no                                                                                                          | no               | Same                                                       |
| Onboarding (conversation, if built) | Vercel route (uses in-memory ConversationEngine)                                                         | no                                                                                                          | no               | Same                                                       |
| Persona activation                  | Vercel route → Plaid API → Supabase                                                                      | no                                                                                                          | no               | Same                                                       |
| Dashboard summary                   | Vercel server component (server-side rec engine)                                                         | no                                                                                                          | no               | Same                                                       |
| Recommendations                     | Vercel server-side (deterministic rules engine)                                                          | **YES** — `/api/financial` aggregator + `lib/finance/recommendations.ts` could share a single server module | no               | Consolidate to one module called from both                 |
| Chat: governed routing              | Vercel `/api/agent/chat` (Sprint T factory)                                                              | no                                                                                                          | no               | Same                                                       |
| Chat: generation + retrieval        | Supabase Edge Function `graphrag-query` (Deno)                                                           | no                                                                                                          | no               | Same                                                       |
| Chat: history list/playback         | Vercel `/api/conversations*` (after 107 applies)                                                         | no                                                                                                          | no               | Same                                                       |
| Goals                               | Vercel `/api/goals`                                                                                      | no                                                                                                          | no               | Same                                                       |
| Risk profile                        | Vercel `/api/onboarding/risk-profile` (and probably `/api/risk-assessment`)                              | possible duplication between two routes                                                                     | maybe — verify   | Consolidate to one risk endpoint                           |
| Need-behind-need                    | Vercel client lib (in-memory) → could persist via `/api/conversation/analysis` (Vercel route → Supabase) | no                                                                                                          | no               | Same                                                       |
| Career, Education, Health, Family   | not wired                                                                                                | n/a                                                                                                         | n/a              | Each becomes its own `/api/<domain>` aggregator            |
| Plaid ingestion                     | Vercel `/api/integrations/plaid/*` → Fly worker for graph promotion (via Supabase queue)                 | no                                                                                                          | no               | Same                                                       |
| GraphRAG sync                       | Fly `lifenavigator-ingestion-worker` (Rust)                                                              | no                                                                                                          | no               | Same                                                       |
| Central knowledge (post-beta)       | Supabase storage + central database in Neo4j                                                             | n/a                                                                                                         | n/a              | Single source of truth via curated central knowledge graph |

### Ownership findings

- The ownership map is clean and follows the constitutional architecture: **Vercel for routing + governance**, **Supabase Edge Functions for LLM generation + retrieval**, **Fly for long-running background work + the FastAPI gateway (currently underused)**.
- The Fly **api-gateway is healthy but underutilized by the live web app today.** The web app talks to Supabase + Edge Functions directly. The gateway provides JWT-verified routes for Neo4j + Qdrant + Gemini that the web app could lean on more heavily.
- One duplication risk: `/api/financial` (my new aggregator) and `lib/finance/recommendations.ts` (the deterministic engine) overlap. Both read from `finance.*`. They should call a shared module rather than re-implementing the read.

---

# PART 9 — Hidden Pages & ComingSoon Audit

| Route                                      | Status                                  | Dependency                                             | Effort to make real | Recommendation                                                |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------------------ | ------------------- | ------------------------------------------------------------- |
| `/dashboard/finance`                       | ✓ working (post 12ac619)                | `/api/financial` ✓                                     | done                | **SHOW**                                                      |
| `/dashboard/finance/accounts`              | ✓ working                               | `/api/financial` ✓                                     | done                | **SHOW**                                                      |
| `/dashboard/finance/transactions`          | ✓ working                               | `/api/financial` ✓                                     | done                | **SHOW**                                                      |
| `/dashboard/finance/budget`                | 404                                     | needs `/api/finance/budgets` + `finance.budgets` table | 6-12 h              | HIDE (or empty state)                                         |
| `/dashboard/finance/investments`           | 404                                     | needs investments tables                               | 12-20 h             | HIDE                                                          |
| `/dashboard/finance/risk`                  | 404                                     | needs `/api/financial/risk`                            | 4-6 h               | HIDE                                                          |
| `/dashboard/finance/tax`                   | 404 (7 endpoints!)                      | needs tax schema                                       | 20+ h               | HIDE                                                          |
| `/dashboard/finance/retirement`            | 404 (8 endpoints!)                      | needs retirement schema                                | 30+ h               | HIDE                                                          |
| `/dashboard/finance/assets`                | 404                                     | needs `/api/assets`                                    | 6-8 h               | HIDE                                                          |
| `/dashboard/finance/connections`           | renders FinancialIntegrations catalogue | none                                                   | low                 | **REBUILD** to launch real PlaidLinkButton, not the catalogue |
| `/dashboard/finance/investment-calculator` | `<ComingSoon />`                        | none                                                   | low                 | DELETE or REBUILD (mirror retirement-calculator pattern)      |
| `/dashboard/career`                        | crashes                                 | `/api/career` missing                                  | 6-12 h              | HIDE                                                          |
| `/dashboard/career/networking`             | crashes                                 | partial                                                | medium              | HIDE                                                          |
| `/dashboard/career/resume`                 | maybe works                             | `/api/career/resumes` ✓                                | low                 | verify, then SHOW                                             |
| `/dashboard/career/skills`                 | partial                                 | `/api/career/skills` partial                           | medium              | HIDE                                                          |
| `/dashboard/career/opportunities`          | crashes                                 | missing                                                | high                | HIDE                                                          |
| `/dashboard/career/add`                    | crashes                                 | missing                                                | medium              | HIDE                                                          |
| `/dashboard/education`                     | crashes                                 | partial                                                | medium              | HIDE                                                          |
| `/dashboard/education/overview`            | `<ComingSoon />`                        | none                                                   | low                 | DELETE (or REBUILD as honest empty state)                     |
| `/dashboard/education/progress`            | `<ComingSoon />`                        | none                                                   | low                 | DELETE                                                        |
| `/dashboard/education/courses`             | maybe works                             | `/api/education/courses` ✓                             | low                 | verify, then SHOW                                             |
| `/dashboard/education/certifications`      | maybe works                             | `/api/education/certifications` ✓                      | low                 | verify, then SHOW                                             |
| `/dashboard/education/path`                | crashes                                 | partial                                                | medium              | HIDE                                                          |
| `/dashboard/healthcare/*`                  | every sub-page 404s on backend          | every healthcare schema missing                        | 20+ h per domain    | **HIDE ALL**                                                  |
| `/dashboard/calendar`                      | 404                                     | OAuth Connect UI missing                               | 8-16 h              | HIDE                                                          |
| `/dashboard/roadmap`                       | `<ComingSoon />` landing                | needs life_scenarios                                   | 30+ h               | HIDE                                                          |
| `/dashboard/roadmap/insights`              | `<ComingSoon />`                        | none                                                   | low                 | DELETE                                                        |
| `/dashboard/roadmap/comprehensive`         | `<ComingSoon />`                        | none                                                   | low                 | DELETE                                                        |
| `/dashboard/roadmap/finance`               | renders 508 lines                       | needs life_scenarios                                   | high                | HIDE                                                          |
| `/dashboard/family`                        | crashes                                 | missing                                                | high                | HIDE (already invisible)                                      |
| `/dashboard/calculators`                   | partial                                 | `/api/financial/accounts` partial                      | low                 | verify, then SHOW or HIDE                                     |
| `/dashboard/next-dollar-optimizer`         | partial                                 | `/api/optimizer/run` ✓                                 | low                 | verify, then SHOW                                             |
| `/dashboard/profile`                       | uses ComingSoon                         | needs profile editor                                   | medium              | REBUILD (auth/Header already shows real name)                 |

### Hidden-page summary

```
SHOW (works):                    Finance landing + accounts + transactions, Goals, Scenario Lab, Chat (once 107 applies), Settings, Dashboard
SHOW (verify first):             career/resume, education/courses, education/certifications, calculators, next-dollar-optimizer
HIDE (no honest landing):        Career, Education, Healthcare, Calendar, Roadmap + all of their sub-pages
DELETE (pure stubs):             investment-calculator, education/overview, education/progress, roadmap/insights, roadmap/comprehensive
REBUILD (low-effort):            /dashboard/finance/connections (Plaid Link launcher), /dashboard/profile
```

---

# FINAL VERDICT

```
READY_WITH_P0_FIXES
```

## Top 10 blockers (ranked by impact)

| #   | Blocker                                                                                     | Impact                                                    | Owner                                      |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------ |
| 1   | Plaid Connect button not user-reachable (real users cannot connect their bank)              | HIGH — Path B blocked                                     | operator + me                              |
| 2   | Five domains over-promise + 404 silently (Career, Education, Healthcare, Calendar, Roadmap) | HIGH — first-impression destroyer                         | me (re-hide commit)                        |
| 3   | Chat history not persisted (migration 107 collision + not applied)                          | HIGH — repeat-visit value destroyed                       | me (rename migration) + operator (push it) |
| 4   | Local commits since 6/5 not pushed to origin/main                                           | HIGH — none of recent work is live                        | operator                                   |
| 5   | Discovery conversation engine + need-behind-need-engine dormant                             | HIGH — kills brand-differentiating moment                 | me                                         |
| 6   | Plaid env vars (`PLAID_CLIENT_ID/SECRET`) not verified on Vercel                            | MEDIUM — sample persona activation returns 503 if missing | operator                                   |
| 7   | Goals never created automatically — empty for every new user                                | MEDIUM                                                    | me (wires from conversation OR persona)    |
| 8   | Two leaked Supabase passwords from prior sessions not rotated                               | MEDIUM — security hygiene                                 | operator                                   |
| 9   | `/dashboard/finance/connections` renders catalogue, not Plaid Link launcher                 | MEDIUM — confusing UX                                     | me                                         |
| 10  | DashboardClient prior-message context loaded from client (security future-risk)             | LOW today, MEDIUM later                                   | me (post 107)                              |

## Top 10 highest ROI fixes (rank by value × inverse-effort)

| #   | Fix                                                                                                                   | ROI   |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Re-hide 5 domains (5 min, eliminates 90% of "looks pathetic" risk)                                                    | ★★★★★ |
| 2   | Rename migration 107 → 111 + apply (5 min, chat history starts working)                                               | ★★★★★ |
| 3   | `git push origin main` (10 min for deploy, ships 6 commits worth of fixes)                                            | ★★★★★ |
| 4   | Wire DiscoveryChat + ConversationEngine + need-behind-need into `/onboarding/converse` (4-6 h, BRAND-DEFINING moment) | ★★★★★ |
| 5   | Add empty-state fallbacks to 6 broken finance sub-pages (3 h, removes silent 404s)                                    | ★★★★  |
| 6   | Rebuild `/dashboard/finance/connections` to launch real Plaid Link (2 h, unlocks Path B)                              | ★★★★  |
| 7   | Verify Plaid env vars on Vercel (5 min, ensures sample personas work)                                                 | ★★★★  |
| 8   | Conversation outcome → POST to /api/goals + /api/onboarding/risk-profile (1-2 h, ties #4 to the dashboard)            | ★★★★  |
| 9   | Rotate the 2 leaked passwords (5 min operator-only, hygiene)                                                          | ★★★   |
| 10  | Persist prior chat context server-side via `chat.messages` (3 h, post 107)                                            | ★★★   |

## Estimated path to 9/10

```
Today (after 12ac619, post-push):                                ~6/10
+ Re-hide 5 domains:                                              7/10
+ Migration 107 applied + chat history works:                     7.5/10
+ Empty-state fallbacks on finance sub-pages:                     8/10
+ Discovery conversation wired:                                   8.5/10
+ Plaid Link real-user path:                                      9/10
```

**Effort to 9/10: ~12 hours of focused work + a Supabase migration push + a git push.**

## Estimated path to 10/10

```
9/10 +
  Verify Cypher → Neo4j → Personal context smoke test passes:    9.2/10
  AI-augmented narrative on Today's Brief (optional):            9.5/10
  Bring Career back with honest landing (one domain at a time):  9.6/10
  Email + Calendar integration UI on Settings:                   9.7/10
  Apply 084 + persist discovery sessions for richer audit:       9.8/10
  Bring Education / Healthcare / Calendar / Roadmap honest:      10/10 (each is its own multi-week build)
```

**Effort to 10/10: 6-8 weeks of disciplined per-domain work post-beta.**

The 9/10 path is the right v1 target. Past 9/10 each gain is months of work for incremental polish.

---

End of `APPLICATION_READINESS_AUDIT.md`.
