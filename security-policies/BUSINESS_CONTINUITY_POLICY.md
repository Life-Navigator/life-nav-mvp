# Business Continuity Policy

Owner: CTO + Operations Lead
Version: 1.0
Effective: 2026-06-01
Review cadence: annual

## 1. Purpose

Ensure the business continues to serve users when a critical
component, vendor, or person is unavailable.

## 2. Scope

The 7 named vendors (Gemini, Supabase, Fly.io, Neo4j, Qdrant,
Plaid, Vercel) plus the internal team.

## 3. Single-vendor unavailability

| Vendor down | What still works                                                                  | Mitigation in flight                                                         |
| ----------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Gemini      | Recommendation generation pauses (DEGRADE via CircuitBreaker)                     | Sprint Q+: alternative provider as Tier 2 default                            |
| Supabase    | Platform is unavailable (single point of failure)                                 | Sprint Q+: multi-region PITR; Sprint R: monthly DR drill confirms PITR works |
| Fly.io      | Multimodal ingestion + ingestion sync queue pauses; recommendations continue      | Workloads are stateless; restart on alternative provider in < 4 h            |
| Neo4j Aura  | Graph projection stops updating; recommendations continue (use cached projection) | Sprint Q+: secondary projection target                                       |
| Qdrant      | Constitutional retrieval falls back to deterministic engine (Sprint L2 design)    | None required — graceful degradation built-in                                |
| Plaid       | Bank integration unavailable; rest of platform continues                          | None required — narrow scope                                                 |
| Vercel      | Platform is unavailable                                                           | Multi-region deploys configured; Vercel has multiple ingress points          |

## 4. Single-person dependencies

Identified single-person knowledge holders and the mitigations:

| Knowledge area                  | Holder            | Mitigation                                                                                                                                         |
| ------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint L + L2 governance engine | Engineering Lead  | Code is documented (`/CONSTITUTIONAL_CHARACTER_ARCHITECTURE.md`, etc.); engineering manager + 1 other engineer review the documentation quarterly. |
| Plaid integration               | Integrations Lead | Pair-programming on all changes; runbook in `/security-policies/`.                                                                                 |
| Production secrets              | Security Lead     | Backup access via emergency-access procedure; recovery codes stored in physical safe.                                                              |
| Vendor relationships            | CEO + CTO         | Each vendor relationship has a primary + secondary owner.                                                                                          |

## 5. Workforce continuity

- Documented on-call rotation: primary + backup per week.
- Documented escalation: on-call → engineering manager → CTO →
  CEO → board.
- Vacation: planned vacations require a documented owner for each
  critical area before approval.
- Emergency separation: if a critical-area owner separates
  unexpectedly, secrets they could access are rotated within 24 hours
  (per `enterprise.secret_rotation_schedule` rotation_method) and
  access reviews flag their accounts for revocation.

## 6. Customer continuity

- Status page during outages.
- Email notifications to tenants for SEV1/SEV2 affecting their
  cohort.
- Refund / credit policy per the master service agreement.

## 7. Workspace continuity

- All-remote organization. No physical office required for
  operations.
- Engineering tools are SaaS — no on-premises infrastructure.
- Personal-device security: required full-disk encryption + MFA;
  hardware enrolled in MDM (Sprint R+: not yet implemented; documented
  as a residual risk).

## 8. Annual review

- DR drill outcomes (per the Disaster Recovery Policy).
- Vendor risk re-assessment (per `enterprise.vendors.next_review_due`).
- Single-person dependency review with rotation if any has not
  changed in 12 months.
- Workforce continuity update.

## 9. Acceptance

This policy is reviewed annually by CTO + Operations Lead.
Acknowledged by every engineer at the quarterly access review.
