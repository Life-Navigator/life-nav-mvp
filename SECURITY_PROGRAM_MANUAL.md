# Security Program Manual

Sprint R deliverable.

Operator-facing guide to the LifeNavigator security program. Read
this before responding to a customer security questionnaire.

## 1. Program ownership

| Role                        | Responsibility                                                             |
| --------------------------- | -------------------------------------------------------------------------- |
| CTO                         | Accountable for the security program; signs off on annual reviews          |
| Security Lead               | Day-to-day program ownership; reviews access; signs off on vendor changes  |
| Engineering Manager         | Code-side controls; reviews CI gates; reviews change-management compliance |
| On-call Engineer (rotating) | Incident detection + first response                                        |
| Operations Lead             | Vendor relationships; access provisioning; business continuity             |

## 2. Policy set

Active policies, in this repository under `/security-policies/`:

| Policy                          | Cadence                       |
| ------------------------------- | ----------------------------- |
| `INCIDENT_RESPONSE_POLICY.md`   | Annual + after every SEV1     |
| `ACCESS_CONTROL_POLICY.md`      | Quarterly                     |
| `CHANGE_MANAGEMENT_POLICY.md`   | Annual                        |
| `DISASTER_RECOVERY_POLICY.md`   | Annual + after every DR drill |
| `BUSINESS_CONTINUITY_POLICY.md` | Annual                        |

All policies are version-controlled; PRs modify the policy and the
review cadence row in `enterprise.access_reviews` records the
acknowledgement.

## 3. Control inventory (one-page summary)

### Identity + Authentication

- Supabase auth for end users.
- GitHub SSO with mandatory MFA for engineering staff.
- Service-role keys via Google Cloud Secret Manager.

### Authorization

- RLS owner-read on every user-scoped table.
- `platform.is_tenant_member(tenant_id, user_id, role)` SECURITY
  DEFINER helper for cross-tenant boundaries.
- Operator endpoints gated by `ops.feature_flags.operator_dashboard.read`.

### Encryption

- TLS for all transit.
- Encryption-at-rest via Supabase + GCS.
- Secrets in Google Cloud Secret Manager.

### Audit

11 dedicated audit tables. See `SOC2_READINESS_REPORT.md` for the
list. Every privileged action also produces an
`enterprise.admin_audit_log` row.

### Monitoring + alerting

- Per-source `data_freshness` fields on the operator + economic +
  character analytics + readiness dashboards.
- Alert SQL templates documented in `INTERNAL_BETA_LAUNCH_RUNBOOK.md`
  §3 (governance bypass, malware detected, injection critical, cost
  spike, extractor failures).

### Vulnerability management

- `pnpm audit` + Dependabot in CI.
- `enterprise.vulnerabilities` for findings with status + due dates.
- High-severity findings have an SLA of 30 days; critical 7 days.

### Change management

- PR + code review + CI gates.
- Migration self-tests.
- Per-sprint test count tracked; regressions fail CI.

### Vendor management

- `enterprise.vendors` registry; 7 named vendors seeded by migration 103.
- Annual review per vendor; surfaced by
  `vendorsDueForReview` in the readiness dashboard.

### Incident response

- `INCIDENT_RESPONSE_POLICY.md` with SEV1-SEV4 SLAs.
- Postmortems within 5 business days of SEV1/SEV2 closure.

### Disaster recovery + business continuity

- RPO/RTO per system documented in `DISASTER_RECOVERY_POLICY.md`.
- `BUSINESS_CONTINUITY_POLICY.md` covers single-vendor +
  single-person failures.

## 4. Customer security questionnaire — common answers

### Do you have a SOC 2 report?

A Type I readiness assessment is in progress. Type II is the next
step; the evidence period is in flight.

### Where is data stored?

- Supabase (primary, AWS us-east).
- Supabase Storage (multimodal uploads).
- Neo4j Aura (graph projection; de-identified).
- Qdrant (vector embeddings).
- Google Cloud Secret Manager (secrets).
- Vendor systems for the integrations the customer enables (e.g.
  Plaid; only if the user connects an account).

### Is data encrypted at rest?

Yes, by every vendor we use.

### Do you use sub-processors?

Yes. The list is in `VENDOR_MANAGEMENT_PROGRAM.md` + the
`enterprise.vendors` table.

### Do you offer a DPA?

Yes; tenant-level DPAs are negotiated as part of the master service
agreement.

### Do you support BAA?

Yes, for tenants who require HIPAA via the BAA-eligible Gemini /
Azure OpenAI pathway. Sprint P's `models.tenant_model_overrides`
lets a healthcare tenant pin to BAA-bound providers.

### How do you handle PII / sensitive data?

- Owner-read RLS prevents cross-user access.
- Tenant-scoped RLS prevents cross-tenant access (Sprint P).
- PHI does NOT flow to providers without a BAA in place.
- The injection-defense layer prevents external content from
  triggering data exfiltration (Sprint N.2 addendum).
- The economic governance layer prevents cost-based DoS that could
  amplify a leak.

### How do you handle vendor risk?

Annual reviews per vendor (`enterprise.vendors.next_review_due`).
Risk tiered (`high` / `medium` / `low`) by data shared + criticality.
DPA / BAA status tracked per vendor row.

### What if you have a breach?

Per `INCIDENT_RESPONSE_POLICY.md` section 6:

- Affected users: email within 24 h.
- Tenant admins: email + dashboard within 24 h.
- Regulators: per Legal — typically 72 h under GDPR.

### How do you handle access reviews?

Quarterly per `ACCESS_CONTROL_POLICY.md` section 5. Five required
scopes; surfaced by `coverageReport` on the readiness dashboard.

## 5. Operator runbook references

| Situation                                | Document                                                              |
| ---------------------------------------- | --------------------------------------------------------------------- |
| Preparing for internal beta              | `INTERNAL_BETA_LAUNCH_RUNBOOK.md`                                     |
| Responding to a critical injection event | `INCIDENT_RESPONSE_POLICY.md` + `MULTIMODAL_SECURITY_VERIFICATION.md` |
| Rotating a secret                        | `DISASTER_RECOVERY_POLICY.md` §4.3                                    |
| Approving a tier-3 model                 | `MODEL_SELECTION_POLICY.md`                                           |
| Onboarding a new tenant                  | `ENTERPRISE_FOUNDATION_AND_API_PLATFORM.md`                           |
| Producing SOC 2 evidence                 | `SOC2_EVIDENCE_COLLECTION.md`                                         |
| Vendor review                            | `VENDOR_MANAGEMENT_PROGRAM.md`                                        |

## 6. Annual security program review

The CTO conducts an annual review covering:

1. Policy refresh (each of the 5 in `/security-policies/`).
2. Vendor risk re-assessment.
3. Single-person dependency review.
4. DR drill outcomes.
5. Incident summary + lessons learned.
6. Roadmap (MDM, pen test, Type II).

Outcome: an internal report + a refreshed
`SOC2_READINESS_REPORT.md`.

## 7. Acceptance

Operators acknowledge this manual at the quarterly access review.
Customers can request a copy under NDA.
