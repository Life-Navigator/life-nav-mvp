# Pre-Migration Audit

**Date:** 2026-06-17 · No changes made. Read-only audit + a critical reconciliation.

## ⚠️ Two things to resolve before applying

### 1. No safe credential to apply migrations

The Supabase CLI is **not logged in** and there is **no `SUPABASE_ACCESS_TOKEN`** in the environment. The only PAT that ever appeared in this project is the **compromised** one (exposed in a prior session). The standing security gate (`docs/finish-line/SECURITY_CLEARANCE_REPORT.md`, `docs/integration-completion/OWNER_ACTIONS_REQUIRED.md`) requires **rotating that PAT + the service-role/anon keys BEFORE applying any migration**. → Apply is **BLOCKED** until a rotated credential is available (owner action).

### 2. Column-name reconciliation (important)

The sprint's Phase 1/5 expects **dedicated columns** on `analytics.pilot_feedback`: `narrative_accuracy`, `trust_score`, `recommendation_quality`, `insight_score`, `holy_shit_score`, `return_intent`, `nps`. The **actual** migration (`20260617130000_pilot_feedback_metrics.sql`) does NOT add per-instrument columns — by design it adds a **`metrics` JSONB** (+ `insight_detected`/`surprised` booleans + `kind`/`context`). The instruments are represented as JSONB keys, which the aggregation + dashboard already read. Mapping:

| Sprint's expected column | Actual storage                                                      |
| ------------------------ | ------------------------------------------------------------------- |
| narrative_accuracy       | `metrics->>'narrative_accuracy'` (0–10)                             |
| trust_score              | `metrics->>'trust'`                                                 |
| recommendation_quality   | `metrics->>'recommendation_quality'` (+ usefulness/actionability)   |
| insight_score            | `insight_detected` boolean → `insight_rate`                         |
| holy_shit_score          | `surprised` boolean → `holy_shit_rate`                              |
| return_intent            | `metrics->>'return_intent'`                                         |
| nps                      | dedicated `nps` column (already exists, migration `20260616120000`) |

Anyone running Phase-5 verification must look for the **JSONB keys**, not dedicated columns. This is intentional (0–10 scales + extensibility); it is internally consistent and tested.

## Migration history (from the repo; live-applied status to confirm with read access)

| Migration                                   | Adds                                                                                                                                            | Likely applied?                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `20260616120000_pilot_routing.sql`          | `analytics.pilot_feedback` (thumbs/trust/usefulness/recommendation_quality/nps/comment) + `pilot_feedback_summary` view + `model_usage`/routing | Created this arc; **confirm in prod**                                   |
| `20260616140000_discovery_intelligence.sql` | `life.life_objectives.confirmed` + `origin`                                                                                                     | **Applied** to prod (recorded during the discovery-intelligence deploy) |
| `20260616160000_mcp_ingestion.sql`          | `life.facts`, `life.relationships`, provenance cols                                                                                             | **PENDING** (this sprint)                                               |
| `20260617130000_pilot_feedback_metrics.sql` | `pilot_feedback.metrics/context/kind/insight_detected/surprised`                                                                                | **PENDING** (this sprint)                                               |

## Tables / columns to verify in prod (requires read access — not available without a credential)

- **life.facts**, **life.relationships** — expected ABSENT (created by the pending MCP migration).
- **analytics.pilot_feedback** — expected PRESENT (from `20260616120000`); the new `metrics`/`insight_detected`/`surprised` cols expected ABSENT until the pending migration.
- **analytics.model_usage** — referenced in `20260616120000`; confirm existence.
- **life.life_objectives.confirmed/origin** — expected PRESENT.
- Row counts / indexes / RLS — to be captured live post-credential.

## What I verified WITHOUT prod access

- Both pending migration files exist with the expected names (`_mcp_ingestion`, `_pilot_feedback_metrics`).
- Destructive-op scan of both: **NONE** (see `MIGRATION_RISK_ASSESSMENT.md`).
- Live read endpoints operational on v124 (see `POST_MIGRATION_SMOKE_TEST.md`).
- Ingestion + feedback + canonical-goal logic: **27 tests pass**.

## Verdict

Migrations are safe to apply (additive); the **only blocker is the credential + key-rotation gate**. No changes made in this phase.
