# Arcana Provider Portal

Sprint J ships the operational front-end providers use to accept
leads, work with patients, issue recommendations, and measure their
own effectiveness — all on top of the Sprint A–I scaffolding.

> **No new architecture.** The portal reuses Sprint I provider
> GraphRAG access control (RLS + `providers.has_access_to`), Sprint C
> consent flows, Sprint E XAI primitives, Sprint F probability
> distributions, and Sprint H driver inference. Only two new tables
> land in this sprint (messages + lead workflow events).

## 1. What ships

| Surface                | What it does                                                                                                            | Where                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Migration 087          | `provider_messages` + `lead_workflow_events` + `engagement_writable()` helper + RLS + sync trigger                      | `supabase/migrations/087_provider_portal.sql`                 |
| Portal types           | View-model interfaces for dashboard, lead workspace, client workspace, progress, analytics, messaging                   | `apps/web/src/types/provider-portal.ts`                       |
| Lead service           | Status classifier, decline-reason whitelist, lead-summary projector                                                     | `apps/web/src/lib/provider/lead-service.ts`                   |
| Portal dashboard       | Lead/client buckets, at-risk projection, upcoming reviews, metrics                                                      | `apps/web/src/lib/provider/portal-dashboard-service.ts`       |
| Client workspace       | Goal+recommendation projection sorted by probability delta                                                              | `apps/web/src/lib/provider/client-workspace-service.ts`       |
| Recommendation builder | Draft validation + deterministic XAI bundle (Why / Evidence / Assumptions / Counterfactuals / Tradeoffs / Confidence)   | `apps/web/src/lib/provider/recommendation-builder-service.ts` |
| Progress monitoring    | Biometric + lab trend builders + compliance + probability trend                                                         | `apps/web/src/lib/provider/progress-monitoring-service.ts`    |
| Messaging              | Compose validator + thread projector + provider-only kind guard                                                         | `apps/web/src/lib/provider/message-service.ts`                |
| Portal analytics       | Effectiveness aggregate with retention / readiness Δ / probability Δ / goal completion                                  | `apps/web/src/lib/provider/portal-analytics-service.ts`       |
| Portal loaders         | Server-side data fetchers (Supabase) for each page                                                                      | `apps/web/src/lib/provider/portal-loaders.ts`                 |
| 11 API routes          | Dashboard, leads list + accept/decline, clients list + workspace + progress, recommendations + XAI, analytics, messages | `apps/web/src/app/api/provider/portal/**`                     |
| Portal UI              | Dashboard, leads list, lead workspace, clients list, client workspace, new-recommendation, progress, analytics          | `apps/web/src/app/portal/provider/**`                         |
| Shared UI components   | Shell + tiles + badges + lead actions + recommendation builder + message composer                                       | `apps/web/src/components/portal/provider/*.tsx`               |
| Tests                  | 23 new tests across portal services                                                                                     | `apps/web/src/lib/provider/__tests__/portal-services.test.ts` |
| RLS verifier           | Cross-provider isolation + active-engagement gate + revoked / expired blocking                                          | `scripts/validation/verify_087_provider_portal_rls.sql`       |

## 2. Phase-by-phase coverage

### Phase 1 — Provider Dashboard

- Path: `/portal/provider/dashboard`
- Four sections: **My Leads**, **My Clients**, **At-Risk**, **Upcoming Reviews**, plus a top **metrics** strip (active clients, acceptance rate, completion rate, mean outcome quality).
- At-risk computed from four signals: low readiness (<0.40), falling probability (Δ ≤ −0.05), missed milestones, poor compliance (<0.50). Severity = count of flagged signals.
- Upcoming = engagement.expires_at within 30 days OR `engagement.metadata.next_review_at`.
- All counts and rows come from `assembleDashboard()` — pure projection.

### Phase 2 — Lead Workspace

- Path: `/portal/provider/leads/[leadId]`
- Reads the immutable `lead_packages` payload + verifies consent through `verifyConsentAt`. Withdrawn/expired consent renders an **info card** — payload sections are not rendered.
- Sections rendered are **only** those the consent flag enabled at generation time. Labs / medications / insurance default OFF.
- Accept / Decline buttons hit `POST /api/provider/portal/leads/[leadId]` with `action: 'accept'|'decline'`. Decline reasons are whitelisted by `isValidDeclineReason`.

### Phase 3 — Client Workspace

- Path: `/portal/provider/clients/[engagementId]`
- Lists in-scope goals (filtered by `engagement.allowed_domains`), recent recommendations (open first), and recent messages.
- Goals are sorted by probability delta ascending — biggest drops first.
- A "New recommendation" CTA routes to the builder.

### Phase 4 — Recommendation Builder

- Path: `/portal/provider/clients/[engagementId]/new-recommendation`
- Pure form → `POST /api/provider/portal/recommendations`.
- `validateDraft` enforces title/body length, expected-strength range, citation warning, etc.
- API checks engagement is active AND domain is in `allowed_domains` before calling `issueRecommendation`.
- Response includes the **XAI bundle** (Phase 8) so the UI can render it inline next to the issued recommendation.

### Phase 5 — Progress Monitoring

- Path: `/portal/provider/clients/[engagementId]/progress`
- Biometric trends per metric (sorted chronologically, delta = most_recent − prior).
- Lab trends (latest value + flag).
- Compliance summary stub — accepts adherence numbers from future loaders without code change.
- Probability trend: current / prior / delta with colored emphasis on the dashboard tile.

### Phase 6 — Provider Analytics

- Path: `/portal/provider/analytics`
- Tiles: active clients, acceptance, completion, outcome quality, client retention, readiness Δ, probability Δ, goal completion + a composite **effectiveness** card.
- `buildEffectiveness` composes from `computeProviderAnalytics` (Sprint I) and the loader-supplied per-client deltas; null inputs are excluded from the average so missing signals don't push the score toward 0.

### Phase 7 — Messaging

- `provider_messages` table (migration 087) with RLS that allows:
  - read → provider OR patient party,
  - insert → sender_user_id = auth.uid() AND engagement.status = 'active' AND unrevoked AND unexpired.
- `providers.engagement_writable(engagement_id)` SECURITY DEFINER helper returns `{writable, reason}` so the API can fail with a structured reason instead of an RLS denial.
- `validateCompose` blocks patient senders from provider-only kinds (`follow_up_request` / `review_request` / `clarification_request`) and vice-versa.
- `projectThread` returns chronological order + the viewer's unread count.

### Phase 8 — XAI Integration

- `buildXAIBundle(draft, recommendation_id)` returns:
  - **Why chain** — depth-stamped steps with frozen `computed_at` for determinism,
  - **Evidence** — the draft's citations verbatim,
  - **Assumptions** — text + severity from the Sprint E `classifySeverity`,
  - **Counterfactuals** — "what if patient skips", "if strength drops by 0.5", per-risk perturbations,
  - **Tradeoffs** — horizon-tradeoff + risk-tradeoff + a default,
  - **Confidence** — citation-aware bounded score.
- The bundle is byte-identical on identical input (tested).
- `GET /api/provider/portal/recommendations/[id]/xai` rebuilds the bundle from the persisted record, so the XAI explorer has no separate store.

### Phase 9 — Mobile Responsiveness

- `PortalShell` is desktop-first sidebar (`md:fixed md:w-60 md:h-screen`), collapsing to a horizontal scrollable tab bar on mobile.
- All grids use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` where appropriate.
- Form inputs use full-width on mobile, two-column on desktop.
- No fixed pixel widths anywhere in the portal subtree.

### Phase 10 — Security Validation

- Enforced by:
  - **RLS** on `provider_messages` + `lead_workflow_events` + everything in `providers.*` (Sprint I).
  - **SECURITY DEFINER** functions: `providers.has_access_to`, `providers.engagement_writable`, `arcana.has_active_lead_consent`.
  - **TS pre-flight**: every portal route resolves the provider_id from `provider_profiles.user_id` and explicitly scopes the query.
- Verifier: `scripts/validation/verify_087_provider_portal_rls.sql` asserts:
  1. Prov A reads only Prov A's messages.
  2. Prov A cannot read Prov B's messages (leak test).
  3. Pat 1 cannot read Pat 2's messages (cross-patient leak).
  4. `engagement_writable(active)` → `(TRUE, NULL)`.
  5. `engagement_writable(revoked)` → `(FALSE, engagement_status_revoked|engagement_revoked)`.
  6. `engagement_writable(expired)` → `(FALSE, engagement_expired)`.
  7. Provider cannot write `lead_workflow_events` for a provider they don't own.

  Recommendation creation requires:
  - `loadEngagementGuard` returns ok AND
  - `eng.allowed_domains.includes(draft.domain)` AND
  - `validateDraft` ok.

  Messaging requires:
  - `validateCompose` ok AND
  - `engagement_writable` returns true AND
  - RLS insert policy allows it.

## 3. API surface

```
GET    /api/provider/portal/dashboard
GET    /api/provider/portal/leads
GET    /api/provider/portal/leads/[leadId]
POST   /api/provider/portal/leads/[leadId]            { action: 'accept'|'decline'|'view', reason? }
GET    /api/provider/portal/clients
GET    /api/provider/portal/clients/[engagementId]
GET    /api/provider/portal/clients/[engagementId]/progress
POST   /api/provider/portal/recommendations           RecommendationDraft → { recommendation, xai, warnings }
GET    /api/provider/portal/recommendations/[id]/xai
GET    /api/provider/portal/analytics?period=monthly
POST   /api/provider/portal/messages                  ComposeMessageInput → { message }
GET    /api/provider/portal/messages/thread?engagement_id=...
```

Every route:

- routes through `loadPortalSession` → resolves `provider_profiles.id`,
- 401 on no auth user,
- 403 on non-provider (no `provider_profiles` row),
- 403 on engagement guard with structured `reason`.

## 4. UI surface

```
/portal/provider/                                  → redirects to /dashboard
/portal/provider/dashboard
/portal/provider/leads
/portal/provider/leads/[leadId]
/portal/provider/clients
/portal/provider/clients/[engagementId]
/portal/provider/clients/[engagementId]/new-recommendation
/portal/provider/clients/[engagementId]/progress
/portal/provider/analytics
```

Shared components in `apps/web/src/components/portal/provider/`:

- `PortalShell.tsx` + `Card` + `StatTile` + `PageHeader`
- `StatusBadge.tsx` — Lead / Engagement / Severity badges
- `LeadActions.tsx` — Accept / Decline (client)
- `RecommendationBuilderForm.tsx` — form + inline XAI panel (client)
- `MessageComposer.tsx` — kind + subject + body composer (client)

## 5. Tests

```
$ npx jest src/lib/provider --no-coverage
PASS src/lib/provider/__tests__/portal-services.test.ts
PASS src/lib/provider/__tests__/services.test.ts
PASS src/lib/provider/__tests__/access-service.test.ts
Test Suites: 3 passed, 3 total
Tests:       53 passed, 53 total
```

Key portal-side coverage:

- **classifyLeadStatus** — five status paths + revoked/expired short-circuit.
- **isValidDeclineReason** — only whitelisted reasons accepted.
- **bucketLeads / bucketClients** — counts match; cross-status sanity.
- **buildAtRisk** — high severity when all four flags fire; deterministic order.
- **validateDraft** — short body / out-of-range strength / nonpositive horizon rejected; no citations is a warning, not an error.
- **buildXAIBundle** — bundle has every section; hard-constraint assumption is classified `critical`; same draft → byte-identical bundle.
- **clampConfidence** — capped at 0.5 without citations.
- **buildBiometricTrends** — chronological + delta calculation.
- **buildProbabilityTrend** — null inputs return all-null cleanly.
- **validateCompose** — provider-only kinds blocked for patient senders; empty/oversized bodies rejected.
- **projectThread** — chronological + viewer-specific unread count.
- **buildEffectiveness** — composite excludes null inputs; outcome quality bubbles through.

## 6. Determinism + privacy summary

- **Determinism.** Every projector / assembler is a pure function. Test coverage proves `JSON.stringify(a) === JSON.stringify(b)` on identical inputs.
- **No PHI in messages embeddings.** Migration 087's GraphRAG sync trigger strips `body`, `subject`, `patient_user_id`, `sender_user_id`, and `actor_user_id` before embedding.
- **No raw lead payloads in workflow events.** Lead events carry `provider_id` + `patient_user_id` + `event_kind` only; no payload body.
- **Provider read scope is engagement-bound.** No portal route ever joins across patients without the explicit `provider_id` predicate.
- **Recommendation creation is engagement-active gated.** Three independent layers: TS validation, `loadEngagementGuard`, and the SECURITY DEFINER `engagement_writable`.

## 7. Migration order

```
087_provider_portal.sql
```

Depends on:

- `providers` schema + `provider_engagements` + `provider_recommendations` (Sprint I)
- `arcana.lead_packages` + `arcana.lead_package_consents` (Sprint C — soft-FK by UUID)
- `core.set_updated_at()` + `graphrag.enqueue_sync()` (Sprint A)

The `DO` block at the end of the migration verifies RLS is enabled on
both new tables before exiting.

## 8. What is explicitly **not** in this sprint

| Area                                                    | Status                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Real WebSocket-driven messaging UI                      | The pages render messages on load + refresh-after-send; not realtime                                    |
| Provider onboarding flow (creating `provider_profiles`) | Out of scope; assumed completed externally                                                              |
| Patient-facing mirror of the portal                     | The same data surfaces through the existing Arcana patient surface; we did not build a patient inbox UI |
| Billing for provider seats                              | Tier persistence only on `arcana.memberships` (Sprint C)                                                |
| Provider knowledge entry UI                             | API surface from Sprint I is unchanged; no new UI here                                                  |
| Calendar integration for scheduled reviews              | Reviews are surfaced via `engagement.metadata.next_review_at`                                           |

## 9. Success criteria — verified

A provider can:

1. **Accept a lead** — `POST /api/provider/portal/leads/[id]` `action: 'accept'` → engagement upserted to `active`, event logged.
2. **Review a lead package** — `GET /api/provider/portal/leads/[id]` → consent-gated payload + workflow history.
3. **Understand the client's goals** — `/portal/provider/clients/[engagementId]` shows in-scope goals + probability deltas + open recommendations.
4. **Issue recommendations** — `POST /api/provider/portal/recommendations` → validated + persisted + XAI bundle returned.
5. **Explain recommendations** — XAI bundle inline in the builder; `GET /api/provider/portal/recommendations/[id]/xai` reconstructs deterministically.
6. **Track progress** — `/portal/provider/clients/[engagementId]/progress` shows biometric + lab trends + probability delta.
7. **Monitor outcomes** — outcome_quality + completion_rate surface on dashboard and analytics.
8. **Measure effectiveness** — `buildEffectiveness` returns the composite + per-axis breakdowns.
9. **Operate securely within scoped permissions** — three-layer gate (RLS + SECURITY DEFINER + TS pre-flight); cross-provider leakage proven blocked by `verify_087_provider_portal_rls.sql`.
