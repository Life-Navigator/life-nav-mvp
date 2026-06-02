# Disaster Recovery Policy

Owner: Platform Team
Version: 1.0
Effective: 2026-06-01
Review cadence: annual + after every DR drill

## 1. Purpose

Establish recovery objectives, backup procedures, and recovery
procedures for the LifeNavigator platform.

## 2. Recovery objectives

| System                              | RPO                       | RTO        |
| ----------------------------------- | ------------------------- | ---------- |
| Supabase (production database)      | 1 hour                    | 4 hours    |
| Supabase Storage (ingestion bucket) | 24 hours                  | 24 hours   |
| Vercel (frontend + API routes)      | 0 (stateless)             | 30 minutes |
| Fly.io workers                      | 4 hours (idempotent jobs) | 1 hour     |
| Neo4j Aura (graph projection)       | 24 hours                  | 4 hours    |
| Qdrant (vector embeddings)          | 24 hours                  | 4 hours    |
| Google Cloud Secret Manager         | 1 hour                    | 1 hour     |

RPO = how much data we can lose. RTO = how long the service can be
down. Numbers reflect internal-beta targets; production targets
will be tightened for general availability.

## 3. Backups

| Source                     | Frequency               | Retention  | Where                         |
| -------------------------- | ----------------------- | ---------- | ----------------------------- |
| Supabase PITR              | Continuous (5 min lag)  | 7 days     | Supabase platform             |
| Supabase nightly snapshot  | Daily 02:00 UTC         | 30 days    | Supabase platform             |
| Supabase weekly export     | Weekly Sunday 03:00 UTC | 90 days    | Encrypted S3 bucket (offsite) |
| Supabase Storage (objects) | Continuous replication  | Indefinite | Supabase storage              |
| Source code                | Push-based              | Indefinite | GitHub (private repo)         |
| Secrets                    | Versioned               | 90 days    | Google Cloud Secret Manager   |
| Vendor contracts           | On change               | Indefinite | Compliance bucket             |

The `enterprise.assets` row for `supabase.postgres` carries
`metadata.last_backup_at` that the operational readiness dashboard
surfaces.

## 4. Recovery procedures

### 4.1 Supabase point-in-time restore

1. Engineering manager + Security Lead approve.
2. Supabase dashboard → "Restore from PITR" → choose timestamp.
3. Restore lands in a fresh project; cutover via DNS + env var.
4. Run the verifier scripts under `scripts/validation/verify_*.sql`
   against the restored DB.
5. Record outcome in `enterprise.admin_audit_log` and on the
   originating incident.

### 4.2 Vercel rollback

1. Vercel dashboard → "Deployments" → "Promote to Production" on a
   prior green deployment.
2. Record in `enterprise.admin_audit_log`.

### 4.3 Secret rotation under compromise

1. Mark secret as compromised in
   `enterprise.secret_rotation_schedule.metadata.compromised_at`.
2. Generate new value via Google Cloud Secret Manager.
3. Update Vercel + Fly.io envs.
4. Verify production traffic uses the new value (e.g. successful
   provider call hits `economic.usage_events` within minutes).
5. Update `last_rotated_at` + `next_due_at`.
6. Record in `enterprise.admin_audit_log`.

## 5. Drills

| Drill                                                     | Cadence                                   | Owner               |
| --------------------------------------------------------- | ----------------------------------------- | ------------------- |
| Supabase PITR to staging                                  | Quarterly                                 | Platform team       |
| Vercel rollback                                           | Semiannual                                | Engineering manager |
| Secret rotation                                           | Per the rotation schedule (90 / 180 days) | Owner team          |
| Vendor unavailability simulation (one of the 7 at a time) | Annual                                    | Security Lead       |
| Full DR tabletop                                          | Annual                                    | Security Lead + CTO |

Drill outcomes are recorded as SEV4 incidents
(`enterprise.incidents`) so they appear in the dashboard rollup.

## 6. Communication during recovery

The Incident Response Policy covers communication. DR-specific notes:

- If the recovery requires downtime > 1 hour, status page is updated
  at the 1-hour mark with an ETA.
- Tenants whose data is potentially affected receive direct
  communication within 24 hours of detection.

## 7. Acceptance

This policy is reviewed annually and after every DR drill. Drill
results inform RPO / RTO targets for the following year.
