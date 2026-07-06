# Conversational Onboarding, Root-Goal Discovery, Estate Planning, Consent Architecture — Implementation Notes

This change delivers the conversational layer of the LifeNavigator
onboarding system on top of the structured intake landed in
`COMPLETE_INTAKE_USER_GRAPH_IMPLEMENTATION.md`.

The user can now talk to a specialist persona (Financial Advisor,
Physician Intake, Career Coach, Education Counselor, Benefits Navigator,
or Estate Planner) and be drilled through **stated goal → need behind
need → root goal → dominant driver → success definition → consequence of
inaction → urgency** before any goal is saved. The discovery transcript
is persisted; the resulting `public.goals` row carries the driver scores
and confidence; the GraphRAG queue is notified.

Every existing flow still works. The conversational layer is additive.

---

## What changed

### 1. Migration 068 — `supabase/migrations/068_root_goal_discovery_and_estate.sql`

Adds:

- **`public.goals`** extensions (additive `ADD COLUMN IF NOT EXISTS`):
  `stated_goal`, `need_behind_need`, `root_goal`, `success_definition`,
  `consequence_of_inaction`, `urgency` (low|medium|high|critical),
  `financial_security_score` `image_score` `performance_score` (each 0..1),
  `dominant_driver` + `secondary_driver` (one of financial_security |
  image | performance), `root_goal_confidence_score`,
  `discovery_completed_at`.
- **`public.goal_discovery_turns`** — audit log of the drill-down
  conversation. Replayable; the engine can re-run on a new model
  version and rewrite the goal row.
- **`public.estate_planning_profile`** (singleton per user) — will,
  living trust, financial POA, healthcare POA, healthcare directive,
  living will, HIPAA release, guardianship, charitable intent,
  business continuity, digital-asset inventory.
- **`public.estate_beneficiaries`** — per-asset-class beneficiary list
  with `allocation_percent` and `is_contingent`.
- **`core.consent_records`** extended with `purpose`, `scope JSONB`,
  `expires_at`, plus explicit owner UPDATE / DELETE policies.
- **`core.user_integration_consents`** — per-integration consent grant
  (Plaid, Google Drive, Gmail, Microsoft, document_upload,
  arcana_lead_sharing, advisor_access, wearable_health_connect, etc.)
  keyed by `(user_id, integration, purpose)`, with scope JSONB,
  revocation timestamp, expiry, version, IP, UA.
- **`core.record_integration_consent(...)`** / **`core.revoke_integration_consent(...)`**
  SECURITY DEFINER RPCs, granted to `authenticated, service_role`.
  Both stamp `core.security_audit_log` atomically.
- GraphRAG sync triggers for `goal_discovery_turns`,
  `estate_planning_profile`, and `estate_beneficiaries` so the
  Personalized GraphRAG ingestion queue picks them up.

All new tables follow the project conventions (uuid PK, `user_id`
ON DELETE CASCADE, `core.set_updated_at` triggers, `source TEXT`,
`metadata JSONB DEFAULT '{}'`, owner + service_role RLS, sensible
indexes).

### 2. Discovery engine library — `apps/web/src/lib/discovery/`

Three pure-TS modules, all LLM-agnostic so they run today against the
deterministic engine and can be swapped to an LLM call without changing
any caller.

- **`scoring.ts`** — word-boundary keyword bank for the three drivers
  (financial_security / image / performance) + a strong-signal regex
  table (e.g. `\bbeat\s+my\s+pr\b` → performance +2; `\bmy\s+kids\b` →
  financial_security +2). Exports `scoreAnswer`, `accumulateScores`
  (recency-weighted), `dominantDrivers`, `driverConfidence` (magnitude
  - gap + turns-collected).
- **`engine.ts`** — state machine. `startSession({ stated_goal,
agent_persona })` records the user's first answer, then `nextPrompt`
  decides what to ask next (what → why → success → consequence →
  urgency) and `recordAnswer` updates the running session. Stops when
  the confidence threshold (`0.7`) is reached AND
  `success_definition` + `consequence_of_inaction` are both set, or at
  the hard cap of 6 drill turns. `summarize` returns the confirmation
  card payload.
- **`prompts.ts`** — the reusable **`ROOT_GOAL_DISCOVERY_SYSTEM_PROMPT`**
  (this is the foundational system prompt every domain agent should
  inherit) plus per-persona headers and a canned prompt library used by
  the deterministic engine when no LLM is wired up.

### 3. API routes — `apps/web/src/app/api/onboarding/`

- **`goal-discovery/route.ts`**
  - `POST` — upserts `public.goals` from the discovery summary and
    rewrites the transcript for the session_id in
    `goal_discovery_turns`. Validates with Zod. Stamps
    `discovery_completed_at` when `finalize: true`.
  - `GET ?goal_id=… | ?session_id=…` — read back the goal + ordered
    turns for the user.
- **`consents/route.ts`**
  - `POST` body discriminated union: `kind: 'policy'` writes
    `core.consent_records`; `kind: 'integration'` calls
    `core.record_integration_consent(...)`. Server stamps IP + UA
    (never trusted from the body).
  - `DELETE ?kind=integration&integration=…&purpose=…` revokes via
    `core.revoke_integration_consent(...)`.
  - `GET` — returns both `policies[]` and `integrations[]`.
- **`estate/route.ts`** — `PUT` upserts `estate_planning_profile` +
  optional bulk-insert `estate_beneficiaries` (with
  `replace_beneficiaries: true` to wipe prior onboarding rows). `GET`
  returns the snapshot.
- **`profile-summary/route.ts`** — `GET` builds the **LifeNavigator
  Profile Summary** the Final Review screen renders. Aggregates from
  profiles, vision, goals (incl. driver scores), constraints,
  capabilities, risk, decision prefs, commitment, motivations,
  `finance.user_financial_profile`, `finance.debts`, insurance plans,
  and onboarding section status. Computes the average per-driver mix
  across goals, surfaces simple opportunity rules (emergency-fund
  shortfall, credit-card debt, no medical plan, no vision captured)
  and a missing-information checklist.

All four routes use `createServerSupabaseClient()` so RLS does the
permission work — `auth.uid()` is the only identity ever trusted.

### 4. Conversational onboarding UI

- **`/onboarding/converse`** (`apps/web/src/app/onboarding/converse/page.tsx`)
  — persona picker. Each preset opens a `<ConversationalShell>` with
  the right system prompt, opening line, and goal category.
- **`ConversationalShell`** (`apps/web/src/components/onboarding/ConversationalShell.tsx`)
  — chat-style turn UI driven by `lib/discovery/engine`. Renders agent
  - user messages, shows a live confidence indicator, and surfaces the
    **Goal Confirmation card** once the engine reports `done`. The card
    reads back:

  ```
  You stated:           ...
  Underlying goal:      ...
  Primary motivation:   Financial Security | Image | Performance
  (Secondary motivation)
  Success would look like: ...
  Urgency: ...
  ```

  with `Yes, that's right` / `Not quite — let me adjust` controls.
  Confirmation calls `/api/onboarding/goal-discovery` with
  `finalize: true`.

- **`/onboarding/review`** — Final-review page. Reads
  `/api/onboarding/profile-summary` and renders Life Vision, Root
  Goals & Drivers, Average Dominant-Driver Mix, Major Constraints,
  Risk Profile, Decision Preferences, Capabilities, Initial
  Opportunities, and Missing Information, each with an "Edit" link
  back into the appropriate onboarding section.

- The **`/onboarding/hub`** page gains two prominent CTAs at the top:
  "Have a conversation with a specialist →" and "Review my profile".

### 5. Foundational system prompt for every downstream agent

`apps/web/src/lib/discovery/prompts.ts` exports
**`ROOT_GOAL_DISCOVERY_SYSTEM_PROMPT`** plus
`systemPromptFor(persona)`. Every future domain agent — financial,
health, career, education, estate, benefits, simulation,
recommendation — should compose its persona-specific instructions on
top of this base, so the entire platform inherits the discovery
methodology, the driver classification, the confirmation contract, and
the guardrails ("never give legal/medical/tax advice without
disclaimers", "never assume the user has a partner / kids unless
they told you").

### 6. TypeScript types

- **`apps/web/src/types/discovery.ts`** — `Driver`, `Urgency`,
  `AgentPersona`, `PromptKind`, `DriverScores`, `DiscoveryTurn`,
  `DiscoverySessionState`, `NextPromptResult`, `DiscoverySummary`,
  and `UserGraphProfileSummary` (the Final Review payload).
- **`apps/web/src/lib/supabase/types.ts`** — `Row/Insert/Update`
  shapes for `goal_discovery_turns`, `estate_planning_profile`, and
  `estate_beneficiaries`, plus per-table type aliases.

### 7. Tests + validation

**Jest**:

- `apps/web/src/lib/discovery/__tests__/scoring.test.ts` — 13 tests
  covering scoreAnswer (empty input, FS/Image/Performance discrimination,
  top-score normalization), accumulateScores (recency weighting, empty
  input), dominantDrivers (null when no signal, dominant + secondary
  selection, trivial-secondary dropping), and driverConfidence
  (no-signal zero, clear-winner rise, more-turns rise, ≤1 cap).
- `apps/web/src/lib/discovery/__tests__/engine.test.ts` — 6 tests
  covering session bootstrap, drill ordering, never-repeat-a-kind,
  MAX_DRILL_TURNS hard cap, financial-security summarize, and the
  threshold gate.
- Existing 13 tests (`save-user-graph`, `onboarding`, `sections`) still
  pass. Total: **35 passed, 0 failed**.

**SQL validation** — `scripts/validation/068_root_goal_discovery_rls.sql`:

Single transactional script that ROLLBACKs at end:

1. Seeds two synthetic users.
2. Inserts a discovered goal + transcript + estate profile + estate
   beneficiaries for User A.
3. Switches role to User A and asserts they read every new table.
4. Asserts cross-user INSERT is blocked by RLS WITH CHECK.
5. Round-trips `core.record_integration_consent` and
   `core.revoke_integration_consent`; asserts the rows flip and the
   `security_audit_log` events land.
6. Switches role to User B and asserts they see zero rows of User A's.
7. Resets role and asserts `graphrag.sync_queue` has at least one entry
   for the new entity types (`goal_discovery_turn`, `estate_profile`,
   `estate_beneficiary`).
8. Prints `ALL ASSERTIONS PASSED` on success; raises on failure.

Run:

```bash
psql "$DATABASE_URL" -f scripts/validation/068_root_goal_discovery_rls.sql
```

### 8. Verification

- `tsc --noEmit -p tsconfig.json` → **clean**
- `eslint` over every new/modified file → **clean**
- `jest` (discovery, sections, onboarding, save-user-graph) → **35 passed**

---

## How to deploy

1. Run the migration:
   ```bash
   supabase db push
   ```
2. Validate the new RLS + RPCs:
   ```bash
   psql "$DATABASE_URL" -f scripts/validation/068_root_goal_discovery_rls.sql
   ```
3. Confirm `app.settings.encryption_key` is still set (insurance encryption
   from 064 continues to require it; nothing in 068 needs it).
4. Smoke-test end-to-end:
   1. Visit `/onboarding/hub` → click **Have a conversation with a
      specialist →**.
   2. Pick "Financial Advisor" → answer the drill prompts → confirm the
      summary → expect a `goals` row written with
      `dominant_driver = financial_security`,
      `root_goal_confidence_score >= 0.5`, plus 5–6 rows in
      `goal_discovery_turns`.
   3. Visit `/onboarding/review` → expect the goal under "Root Goals &
      Drivers" with the right driver badge and the Initial Opportunities
      block populated based on intake gaps.

---

## Conversational ↔ LLM adapter point

The state machine in `engine.ts` is intentionally LLM-agnostic. The two
adapter points are:

1. **`pickPromptText(persona, kind)`** in `engine.ts` (currently picks
   from `PROMPT_LIBRARY` in `prompts.ts`). To plug in an LLM, replace
   this with a call that takes the `systemPromptFor(persona)` +
   transcript and asks the model for the next question of `kind`.
2. **`inferRootGoal({ stated_goal, need_behind_need, why })`** in
   `engine.ts` (currently a string concatenation). Replace with a
   structured rewrite call (`returnFormat: { root_goal: string }`) and
   the engine stays the same.

Driver scoring (`scoring.ts`) can stay deterministic — it's the
auditable, replayable layer — or be augmented with model-side scoring
appended to the same `detected_drivers` field.

---

## Consent contract

The system honours the contract from the prompt:

| Requirement                                       | How it lands                                                                                                                                                                                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit consent before any integration or upload | `POST /api/onboarding/consents { kind: 'integration', ... }` is required by every flow that touches `core.user_integration_consents`-gated paths (Plaid link, document upload, Arcana lead sharing, advisor access, wearable Health Connect). |
| Consent purpose                                   | `purpose TEXT NOT NULL` on `user_integration_consents`; `purpose TEXT` on `consent_records`.                                                                                                                                                  |
| Consent scope                                     | `scope JSONB NOT NULL DEFAULT '{}'`; the route's discriminated-union schema validates per-kind shape.                                                                                                                                         |
| Timestamp                                         | `granted_at`, `revoked_at`, `expires_at`.                                                                                                                                                                                                     |
| Revocation                                        | `DELETE /api/onboarding/consents?kind=integration&integration=…&purpose=…` calls `core.revoke_integration_consent`.                                                                                                                           |
| IP / UA                                           | The route extracts both from request headers; the body never carries them. Both stamps land in `core.security_audit_log`.                                                                                                                     |

---

## Intentionally deferred

- **LLM integration of the chat shell.** The deterministic engine is
  production-ready for capturing structured drill-downs. Wiring Gemini /
  Anthropic / OpenAI through the two adapter points above is a follow-up
  PR; the data model and persistence path are stable.
- **Plaid Link inside the conversational flow.** The existing
  `/api/integrations/plaid/*` routes (link-token / exchange / accounts /
  transactions / disconnect) are unchanged. Wire them into the
  Financial Advisor persona by prompting the user to grant
  `record_integration_consent('plaid', 'transaction_sync', { products: [...] })`
  before invoking Plaid Link. This is a small UI add, not a schema change.
- **Document upload + OCR queue integration.** Tables already exist
  (`core.upload_documents`, `core.ingestion_jobs`, `insurance_documents`,
  `insurance_extracted_facts`). The conversational shell can offer
  uploads after recording a `record_integration_consent('document_upload',
'insurance_card_extraction', { domain: 'insurance' })` grant.
- **Estate planning conversational UI variant.** The estate persona
  works today through `/onboarding/converse`; a richer estate-specific
  visualisation (beneficiary table, allocation pie chart) is a Phase-2
  ergonomics item.

---

## File map

```
supabase/migrations/
  068_root_goal_discovery_and_estate.sql                                  NEW

scripts/validation/
  068_root_goal_discovery_rls.sql                                          NEW

apps/web/src/app/api/onboarding/
  goal-discovery/route.ts                                                  NEW
  consents/route.ts                                                        NEW
  estate/route.ts                                                          NEW
  profile-summary/route.ts                                                 NEW

apps/web/src/app/onboarding/
  converse/page.tsx                                                        NEW
  review/page.tsx                                                          NEW
  hub/page.tsx                                                             MODIFIED (CTA links to converse + review)

apps/web/src/components/onboarding/
  ConversationalShell.tsx                                                  NEW

apps/web/src/lib/discovery/
  scoring.ts                                                               NEW
  engine.ts                                                                NEW
  prompts.ts                                                               NEW
  __tests__/scoring.test.ts                                                NEW
  __tests__/engine.test.ts                                                 NEW

apps/web/src/types/
  discovery.ts                                                             NEW

apps/web/src/lib/supabase/types.ts                                         MODIFIED
```
