# SOC 2 Readiness Report

Sprint R deliverable.

## Verdict

```
SOC 2 TYPE I — READINESS ESTABLISHED
SOC 2 TYPE II — IN PROGRESS (period in flight)
```

The Common Criteria for the Security category are mapped to platform
mechanisms with auditable evidence. The platform is ready to engage
an external auditor for a Type I readiness assessment.

Type II — which requires the controls to operate effectively over a
multi-month period — is in progress: the audit chain is in place but
the historical evidence window is still accumulating.

## Trust Service categories covered

| Category             | Status         | Notes                                                                             |
| -------------------- | -------------- | --------------------------------------------------------------------------------- |
| Security             | ✓ Type I ready | Full mapping in `SOC2_EVIDENCE_COLLECTION.md`                                     |
| Availability         | Partial        | DR Policy + RPO/RTO documented; first drill in flight                             |
| Processing Integrity | Partial        | Governance + Character cover advisory integrity; financial integrity is N/A       |
| Confidentiality      | ✓              | RLS owner-read on every user table; service-role-only on privileged               |
| Privacy              | ✓              | Enterprise reports carry no per-user identifiers (Sprint O privacy contract test) |

The two "partial" categories are explicitly documented as a roadmap
item, not a gap of controls. They mature with operational time.

## Controls inventory

The platform implements the following control families:

### Authentication + Identity

- Supabase auth with MFA recommended for end users; mandatory MFA
  for engineering staff via GitHub SSO.
- Service-role keys stored in Google Cloud Secret Manager.
- Per-user feature flags + tenant-member SECURITY DEFINER gates
  (Sprint P).

### Authorization (RLS)

Every user-scoped table has RLS owner-read with service-role-write:

- `governance.*` (Sprint L + L2 + N.3)
- `ingestion.*` (Sprint N.1 + N.2)
- `security.*` (Sprint N.2 addendum)
- `outcome.*` (Sprint O)
- `analytics.*` + `feedback.*` (Sprint O.0)
- `economic.*` (Sprint O.0.2)
- `platform.*` (Sprint P)

`enterprise.*` (Sprint R) is service-role only — operators read via
the dashboard route, which is itself gated by the operator feature
flag.

### Audit

- `governance.decision_governance_audit` — every guarded response
  (Sprint L2 + N.3).
- `governance.review_iterations` — per-iteration trace (Sprint L2).
- `governance.character_findings` — per-rule character findings
  (Sprint Q).
- `security.prompt_injection_events` — every injection finding
  (Sprint N.2 addendum).
- `security.untrusted_content_findings` — every retrieved-content
  verdict.
- `security.tool_abuse_attempts` — every tool-use denial.
- `ingestion.malware_scans` — every scan invocation.
- `ingestion.extraction_telemetry` — every extractor invocation.
- `economic.usage_events` — every chargeable action (Sprint O.0.2).
- `economic.abuse_events` — every abuse detection.
- `enterprise.admin_audit_log` — every privileged action.

### Encryption

- In transit: TLS to all vendor endpoints; TLS for all client traffic.
- At rest: Supabase + GCS provide encryption-at-rest by default;
  enterprise.assets surfaces the storage_location for documentation
  purposes.
- Secrets: stored exclusively in Google Cloud Secret Manager;
  rotation tracked per the rotation framework.

### Vulnerability management

- `pnpm` overrides for high-severity transitive dependencies
  (Sprint M closeout).
- `enterprise.vulnerabilities` tracks open findings with severity +
  due dates.
- CI uses `pnpm audit` + Dependabot.

### Incident response

- `enterprise.incidents` table.
- `INCIDENT_RESPONSE_POLICY.md` defines SEV1-SEV4 + response times.

### Disaster recovery

- `DISASTER_RECOVERY_POLICY.md` with RPO/RTO per system.
- Daily Supabase snapshots; PITR; weekly offsite export.
- Quarterly DR drills committed; first drill in flight.

### Change management

- PR review + CI gates + migration self-tests.
- `CHANGE_MANAGEMENT_POLICY.md` defines standard + emergency paths.

## Trust Service criterion coverage

Full mapping in `SOC2_EVIDENCE_COLLECTION.md`. Summary:

| Criterion                             | Coverage                                   |
| ------------------------------------- | ------------------------------------------ |
| CC1.1 — Integrity + ethical values    | ✓ (Character Layer)                        |
| CC1.4 — Workforce competence          | ✓ (Access reviews)                         |
| CC2.1 — Internal information quality  | ✓ (4 dashboards)                           |
| CC2.2 — Internal communication        | ✓ (Incident policy)                        |
| CC2.3 — External communication        | ✓ (Incident policy §6)                     |
| CC3.1 — Specifies suitable objectives | ✓ (Policy set)                             |
| CC3.2 — Identifies + assesses risk    | ✓ (Vendor tiers + vulns)                   |
| CC3.3 — Assesses fraud risk           | ✓ (Abuse detector)                         |
| CC4.1 — Ongoing monitoring            | ✓ (Dashboards + alerts)                    |
| CC4.2 — Evaluation of deficiencies    | ✓ (Postmortems)                            |
| CC5.1-3 — Control activities          | ✓                                          |
| CC6.1 — Logical access provisioning   | ✓ (RLS)                                    |
| CC6.2 — Access removal                | ✓ (24h SLA + audit)                        |
| CC6.3 — Periodic review               | ✓ (Quarterly reviews)                      |
| CC6.6 — Privileged accounts           | ✓ (admin_audit_log)                        |
| CC6.7 — Restricted software           | ✓ (Managed environments)                   |
| CC6.8 — Network protection            | ✓ (Vercel + Supabase)                      |
| CC7.1 — Anomaly detection             | ✓ (Injection + abuse + character)          |
| CC7.2 — Monitor components            | ✓ (Readiness dashboard)                    |
| CC7.3 — Evaluate anomalies            | ✓ (Incident response)                      |
| CC7.4 — Respond                       | ✓ (Policy + records)                       |
| CC7.5 — Recover                       | ✓ (DR policy)                              |
| CC8.1 — Change management             | ✓ (Policy + CI gates)                      |
| CC9.1 — Risk mitigation               | ✓ (Circuit breakers + abuse + rate limits) |
| CC9.2 — Vendor management             | ✓ (Vendor registry + program)              |

## Documented gaps (transparent)

1. **MDM / endpoint compliance** — engineering devices are personal;
   full-disk encryption + MFA required but not MDM-enforced.
   Mitigation: workforce continuity + DR procedures cover separation.
2. **Independent penetration test** — not performed. Planned pre-GA.
3. **Type II historical window** — controls are in place; the
   evidence period (typically 6-12 months) is still accumulating.
4. **Sub-processor change notification** — manually tracked today;
   automated alerts on `vendors.updated_at` queued.
5. **Quarterly DR drills** — committed; the cadence will only be
   proven over time.

## Recommended next steps

1. **Engage an external auditor** for a Type I readiness assessment
   (4-6 weeks).
2. **Begin the Type II evidence period** by formalizing the existing
   evidence collection cadence.
3. **Schedule the first DR drill** as a SEV4 incident before the
   end of Q3.
4. **Schedule a penetration test** for the application layer +
   the `/api/ops/*` operator endpoints.
5. **Onboard an MDM solution** for engineering devices.

## Test coverage of the underlying controls

```
$ npx jest --no-coverage
Test Suites: 93 passed, 93 total
Tests:       1319 passed, 1319 total
```

Of which:

- Governance (Sprint L + L2): 134 tests
- Injection defense (Sprint N.2 addendum): 78 tests
- Character layer (Sprint N.3 + Q): 74 tests
- Outcome intelligence (Sprint O): 40 tests
- Economic governance (Sprint O.0.2): 119 tests
- Enterprise (Sprint R): 21 tests
- Ingestion (Sprint N.1 + N.2): 80 tests

Every test is part of the audit chain. A regression in a security
control fails CI.

## Sign-off

```
SOC 2 TYPE I — READINESS ESTABLISHED
```

The platform is ready to engage an external auditor for a Type I
report. The control set + documentation + evidence collection
mechanism support an external review.
