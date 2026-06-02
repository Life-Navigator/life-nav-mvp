# Incident Response Policy

Owner: Security Team
Version: 1.0
Effective: 2026-06-01
Review cadence: annual + after every SEV1

## 1. Purpose

Establish the process by which LifeNavigator detects, classifies,
responds to, communicates about, and learns from security and
operational incidents.

## 2. Scope

All production systems listed in `enterprise.assets` with
`soc2_in_scope = TRUE`. All vendors listed in `enterprise.vendors`
with `status = 'active'`.

## 3. Severity classification

| Severity | Definition                                                                                                               | Response time                           | Approver            |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------- |
| SEV1     | User-data exfiltration, governance bypass under active exploitation, total platform outage, suspected criminal access    | Immediate (≤ 15 minutes to acknowledge) | CTO + Security Lead |
| SEV2     | Single-component outage with user impact, security finding without known exploitation, provider provider outage > 15 min | ≤ 30 minutes                            | On-call lead        |
| SEV3     | Internal-only outage, security finding without user impact, ops degradation                                              | ≤ 4 hours                               | On-call engineer    |
| SEV4     | Informational, near-miss, drill                                                                                          | Next business day                       | Engineering manager |

## 4. Detection

Incidents are detected via:

- `security.prompt_injection_events` alerts (Sprint N.2 addendum)
- `ingestion.malware_scans.status = 'infected'` alerts (Sprint N.2)
- `decision_governance_audit.constitutional_verdict IS NULL` alerts (Sprint N.2)
- `economic.platform_budget.status = 'EMERGENCY' / 'HARD_STOP'` (Sprint O.0.2)
- `enterprise.circuit_breakers.state = 'OPEN'` (Sprint O.0.2)
- External vendor incident notifications (Gemini, Supabase, Plaid, etc.)
- User reports
- Vulnerability scanner findings (Dependabot, Sentry, internal scans)

## 5. Response phases

### 5.1 Identify

- On-call acknowledges the page within the response-time SLA.
- On-call opens an `INC-YYYY-NNNN` record in `enterprise.incidents`
  with the initial severity classification.

### 5.2 Contain

- Disable the offending feature flag if a kill switch exists.
- Open circuit breakers (`forceOpen(feature, reason, action)`).
- Revoke compromised credentials (rotate via Phase 6 framework).
- Isolate affected user accounts (set `ops.beta_invites.status = 'paused'`
  cohort-wide if scope is unclear).

### 5.3 Eradicate

- Patch / deploy the fix. All fixes go through normal change-management
  (see `CHANGE_MANAGEMENT_POLICY.md`); emergency-change fast-track is
  documented inline on the incident record.

### 5.4 Recover

- Reset circuit breakers (`resetBreaker`).
- Re-enable feature flags.
- Verify the issue does not reappear over the recovery window.

### 5.5 Learn

- Postmortem within 5 business days of SEV1/SEV2 closure.
- `enterprise.incidents.postmortem_ref` set to the postmortem doc id.
- Action items tracked in the engineering backlog with named owners.

## 6. Communication

| Audience       | When                                        | How                                              |
| -------------- | ------------------------------------------- | ------------------------------------------------ |
| Affected users | SEV1 + SEV2 with user-data impact           | Email within 24 h; status-page update within 1 h |
| Tenant admins  | SEV1 + SEV2 affecting their tenant          | Email + dashboard notice                         |
| Regulators     | Any breach reportable under GDPR/CCPA/HIPAA | Per Legal: 72 h for GDPR                         |
| Internal staff | All SEV1/SEV2                               | #incidents Slack channel                         |
| Public         | Major outage only                           | Status page                                      |

## 7. Evidence preservation

For SEV1/SEV2 the on-call snapshots:

- Relevant rows from `governance.decision_governance_audit`,
  `security.prompt_injection_events`, `ingestion.malware_scans`,
  `economic.usage_events`, `ops.llm_usage_meter`.
- Vercel logs for the incident window.
- Sentry events.
- Supabase audit logs (via `enterprise.admin_audit_log` from this
  sprint).

Snapshots are written to a write-once compliance bucket separate
from the operational database.

## 8. Tabletop exercises

Annual SEV1 tabletop using a mock prompt-injection scenario or a
mock vendor breach. Findings flow into `enterprise.access_reviews`
or directly into the engineering backlog.

## 9. Acceptance

This policy is reviewed annually and after every SEV1. Acknowledgement
of the current revision is required of every engineer on quarterly
access review (see `ACCESS_CONTROL_POLICY.md`).
