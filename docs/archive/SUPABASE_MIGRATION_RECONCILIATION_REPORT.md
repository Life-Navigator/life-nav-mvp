# Supabase Migration Reconciliation Report

**Date:** 2026-06-02
**Project:** `lifenavigator-production` (ref `diwkyyahglnqmyledsey`)
**Path:** B — existing project, cherry-pick the Sprint-T-required subset
**Authorized by operator:** "Approve Option A. Proceed with the recommended internal beta path."

---

## Executive result

```
17 migrations APPLIED      (the Sprint S/T required subset)
25 migrations MARKED APPLIED (CLI history only — actual SQL skipped intentionally)
 2 migration FILES PATCHED (syntax + reserved-word bugs latent in 88c521b)
 0 destructive operations executed
```

The api-gateway, ingestion-worker, Sprint T governance factory, and the
web app's Sprint S/R/Q codepaths now have the schemas they require.
The provider portal, scenario lab, career marketplace, life-trajectory
simulator and other Sprint M/N features remain non-functional on
`lifenavigator-production` because they depend on the broken
`user_graph foundation` chain (the original 060 from the repo) that was
never applied.

---

## 1. Migrations APPLIED (17)

Each ran cleanly (eventually — two needed mid-push file fixes; see §5).

| Migration                               | Sprint | What it created                                                                                                                                                             |
| --------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 088_decision_governance                 | L2     | `governance` schema + `policy_versions`, `decision_governance_audit`, `agent_registry`, `safety_messages` (4 tables)                                                        |
| 089_constitutional_graphrag             | L2     | `governance.constitutional_entities`, `review_iterations`                                                                                                                   |
| 090_beta_ops_feedback_meter             | M      | `ops` + `feedback` schemas (7 + 6 tables: feature_flags, cohorts, beta_invites, llm_usage_meter, retrieval_cache_meter, NPS, bug_reports, recommendation_feedback, etc.)    |
| 091_universal_ingestion                 | N      | `ingestion` schema (11 tables: files, jobs, extractions, facts, …)                                                                                                          |
| 092_multimodal_production               | N.1    | ingestion column-adds + provenance + scan tables                                                                                                                            |
| 093_enterprise_foundation               | P      | `platform`, `connectors`, `models` schemas (5 + 2 + 2 tables: tenants, tenant_users, tenant_api_keys, connector_registry, model_registry, …)                                |
| 094_harden_security_definer_search_path | M      | idempotent ALTER FUNCTION search_path hardening                                                                                                                             |
| 095_security_injection_audit            | N.2    | `security` schema (3 tables: injection_findings, content_verdicts, threat_intel)                                                                                            |
| 096_untrusted_content_boundary          | N.2    | added trusted/untrusted columns + RLS policies on ingestion                                                                                                                 |
| 097_constitutional_threat_intel         | N.2    | extended security.\* with threat-intel feeds                                                                                                                                |
| 098_internal_beta_instrumentation       | O.0    | `analytics` schema + user_events table                                                                                                                                      |
| 099_economic_governance                 | O.0.2  | `economic` schema (6 tables: usage_events, user_budgets, platform_budget, circuit_breakers, abuse_findings, rate_buckets)                                                   |
| 100_constitutional_character            | N.3    | `governance.character_findings` + `public.character_findings` mirror                                                                                                        |
| 101_character_audit_columns             | N.3    | 10 `character_*` columns added to `governance.decision_governance_audit`                                                                                                    |
| 102_outcome_intelligence                | O      | `outcome` schema (6 tables: recommendation_effectiveness, decision_quality_index, attribution_links, goal_progress_snapshots, life_progress_snapshots, tenant_reports)      |
| 103_enterprise_readiness                | R      | `enterprise` schema (7 tables: assets, vendors, access_reviews, admin_audit_log, secret_rotation_schedule, incidents, vulnerabilities)                                      |
| 104_enterprise_projections              | S      | `projections` schema (5 tables: enterprise_projections, constitutional_layer_rules, organization_policies, industry_templates, policy_decisions) — seeded with 6 industries |

**Schema footprint after push:**

| Schema         | Tables                              |
| -------------- | ----------------------------------- |
| analytics      | 1                                   |
| connectors     | 2                                   |
| economic       | 6                                   |
| enterprise     | 7                                   |
| feedback       | 6                                   |
| **governance** | **7** (incl. `character_findings`)  |
| ingestion      | 11                                  |
| models         | 2                                   |
| ops            | 7                                   |
| outcome        | 6                                   |
| platform       | 5                                   |
| projections    | 5 (seeded with 6 industries)        |
| security       | 3                                   |
| **Total**      | **68 tables across 13 new schemas** |

The 10 `character_*` columns added by 101 are on
`governance.decision_governance_audit` — verified live on the DB.

## 2. Migrations MARKED APPLIED (25 — broken-chain skip)

These were marked `applied` in `supabase_migrations.schema_migrations`
via `supabase migration repair --status applied …` so the CLI no
longer queues them. Their SQL was NOT executed. They all depend on
the repo's original `060_user_graph_foundation.sql` which was never
applied to this project.

```
061  user_graph_expansion
062  financial_intake_expansion
063  health_intake_expansion
064  insurance_benefits
066  family_lifestyle
067  onboarding_sections
068  root_goal_discovery_and_estate
069  intake_logs_and_benefit_profile
071  life_trajectory_simulation
072  career_marketplace
073  wearable_monitoring
074  graphrag_v2_triggers
075  fix_055_triggers
076  goal_hierarchy
077  central_graph_ontology
078  central_curated_knowledge
079  decision_intelligence
080  goal_progress_and_attribution
081  decision_impact_and_probability
082  xai_and_trust_layer
083  central_knowledge_v2
084  conversation_intelligence
085  provider_graphrag
086  arcana_health_activation
087  provider_portal
```

## 3. Skipped via earlier divergence (0 — no action needed)

The remote project's own 060/065/070 migrations
(`security_hardening`, `advanced_ocr`, `pg_cron_sync`) were already
registered as applied before this session. The repo's 060/065/070
share those version numbers and the CLI considers them matched.
No action taken.

## 4. Remaining lineage drift

The divergence point between the repo's migration lineage and the
remote project's history is **after migration 055**. From 060 onwards
the two lineages tell different stories:

| Version | Repo's migration             | Remote-applied migration |
| ------- | ---------------------------- | ------------------------ |
| 060     | `user_graph_foundation`      | `security_hardening`     |
| 065     | `career_education_expansion` | `advanced_ocr`           |
| 070     | `dynamic_goal_optimizer`     | `pg_cron_sync`           |

Schemas only the remote has (and that the repo never created):

```
core, cron, finance, graphrag, health_meta
```

73 tables in `public` on the remote include `user_achievements`,
`user_announcement_reads`, `user_challenges`, `user_devices`,
`user_notifications`, `user_preferences`, `user_progress` — none of
which match what the repo's 060 chain would have created
(`user_life_vision`, `user_values_anchor`, `user_life_event`,
`user_action`, `user_intake_log`, etc).

**The lineage drift is not repaired by this session.** No code path
in the Sprint T factory or the Fly api-gateway requires the broken
foundation. Drift repair is deferred to a future deliberate
migration-rebase sprint.

## 5. Two source-file bugs fixed during the push

These were latent in commit `88c521b` and never caught because Jest
doesn't execute the SQL. Fixed during this session and committed as
a separate commit immediately following this report.

### 5a. `088_decision_governance.sql`

Line 289 had a "vanity UUID" literal:

```sql
'00000000-0000-0000-0000-0000Govern0001'
```

The characters `G, o, v, r, n` are not hex; postgres returned:

```
ERROR: invalid input syntax for type uuid:
       "00000000-0000-0000-0000-0000Govern0001" (SQLSTATE 22P02)
```

Replaced with the sentinel `'00000000-0000-0000-0000-000000000001'`.
The row is idempotent on the `version` column (`ON CONFLICT (version)
DO NOTHING`) so the specific `id` value doesn't matter.

### 5b. `104_enterprise_projections.sql`

Two bugs in a single file:

**(b1)** A table-level `UNIQUE (...)` constraint used `COALESCE()`
expressions inside the constraint:

```sql
UNIQUE (layer, COALESCE(industry, ''),
        COALESCE(tenant_id::TEXT, ''),
        COALESCE(user_id::TEXT, ''),
        entity_kind, slug, version)
```

Postgres only accepts column names inside in-table `UNIQUE`
constraints, not expressions. Fix: extracted into a separate
`CREATE UNIQUE INDEX uq_clr_scope_kind_slug ON ... ( <expressions> )`
immediately after the table is created. Same semantic uniqueness;
correct syntax.

**(b2)** Column name `references` collided with Postgres's reserved
keyword (used by `FOREIGN KEY ... REFERENCES`). Double-quoted at all
three references in the file (column definition, INSERT column list,
ON CONFLICT SET clause).

## 6. Impact assessment — what works and what doesn't on this database

### Works (after this reconciliation)

| Capability                                               | Reason it works                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `/api/agent/chat` (Sprint T factory)                     | needs `governance.*` schema → exists                                  |
| Character-layer review (Sprint N.3)                      | needs `governance.character_findings` + `character_*` columns → exist |
| Economic gate (budget + breaker)                         | needs `economic.*` → exists                                           |
| Outcome reporting + DQI + life progress                  | needs `outcome.*` → exists                                            |
| Sprint S enterprise projections (4-tier layering)        | needs `projections.*` → exists, seeded                                |
| Sprint R enterprise readiness (vendors, incidents, etc.) | needs `enterprise.*` → exists                                         |
| Multi-tenant platform (tenant + RLS)                     | needs `platform.*` → exists                                           |
| Multimodal ingestion + provenance                        | needs `ingestion.*` + `security.*` → exist                            |
| Beta operations (feature flags, cohorts, NPS)            | needs `ops.*` + `feedback.*` → exist                                  |
| Internal-beta instrumentation (user_events)              | needs `analytics.*` → exists                                          |
| Connector framework                                      | needs `connectors.*` + `models.*` → exist                             |

### Does NOT work on this database (out of scope for internal beta)

| Capability                                                    | Why it doesn't work                                                                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/scenario-lab/*` (life trajectory simulator) | depends on 071_life_trajectory_simulation tables that were skipped                                                                       |
| Career marketplace                                            | 072 skipped                                                                                                                              |
| Wearable monitoring                                           | 073 skipped                                                                                                                              |
| Provider portal recommendations route                         | depends on 085-087 (provider_graphrag, arcana_health_activation, provider_portal) — schemas not created                                  |
| Goal hierarchy + estate planning intake                       | 068, 076 skipped                                                                                                                         |
| Family-lifestyle, insurance, financial-intake expansion       | 062-066 skipped                                                                                                                          |
| Decision intelligence trust layer + XAI bundle                | 079-082 skipped                                                                                                                          |
| Central curated knowledge graph (read-only)                   | 077-078, 083 skipped (the `central` schema is empty on remote even though the namespace exists from remote's 077_central_graph_ontology) |
| Conversation intelligence                                     | 084 skipped                                                                                                                              |

The Sprint T `verify-governance.ts` allowlist already accounts for the
provider-portal route via `reviewAndPersist`. That route will return
clean governance verdicts but its downstream `provider_recommendations`
table writes will fail — surfaced as 500 errors when called. **None of
these routes are required for the internal beta cohort** which uses
chat, recommendations, outcome tracking only.

## 7. Operational notes for whoever drives this next

1. `supabase migration list` will show every version 088-104 as
   `Local | Remote | <Time>` indicating both sides know it's applied.
   Versions 061-087 (excluding 065, 070 which match by version number)
   will also show Local + Remote because we marked them applied. The
   remote's actually-applied 060/065/070 still register too.
2. If you later decide to repair the lineage drift (apply the repo's
   060+ foundation properly), the safest path is migration rebase —
   rename repo migrations 060-088 to start at 091+ so they're additive
   on top of remote's lineage. That's the "Option B" the operator
   originally declined. Deferred work.
3. The two committed migration-file fixes (088 and 104) are correct
   on `mvp` HEAD now. Any future fresh Supabase project pushing these
   migrations will not encounter the syntax errors.
4. No `supabase db reset` was run. No destructive operations were
   performed. The remote's existing `core`, `cron`, `finance`,
   `graphrag`, `health_meta` schemas + 73 public tables are intact.

## 8. Verification commands the operator can re-run

```bash
# 1. CLI history is consistent.
supabase migration list                    # 071 onwards: Local + Remote both filled

# 2. New schemas exist.
psql 'postgres://postgres.diwkyyahglnqmyledsey:LifeNav!\$#007@aws-1-us-east-1.pooler.supabase.com:6543/postgres' -c "
   SELECT schema_name FROM information_schema.schemata
   WHERE schema_name IN ('governance','economic','outcome','enterprise','projections',
                         'platform','connectors','models','security','analytics',
                         'ops','feedback','ingestion');
"

# 3. Character columns exist on the audit table.
psql ... -c "
   SELECT column_name FROM information_schema.columns
   WHERE table_schema='governance' AND table_name='decision_governance_audit'
     AND column_name LIKE 'character%' ORDER BY column_name;
"

# 4. Projections seed succeeded — 6 industries present.
psql ... -c "SELECT industry FROM projections.industry_templates ORDER BY industry;"
```

---

## Verdict

```
SUCCESS — internal beta unblocked on Supabase side
```

The Fly api-gateway can deploy. The Sprint T factory has every schema
it needs. No live data was touched. Lineage drift is preserved but
documented. Two latent SQL bugs in committed migrations have been
fixed and committed.
