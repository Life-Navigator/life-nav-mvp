# SOC 2 Evidence Collection

Sprint R Phase 5 deliverable.

## Purpose

Map each SOC 2 Trust Services Criterion (Security category, the
baseline) to the evidence the platform produces. The intent: when an
auditor asks "show me the evidence for CC6.1", an operator can run
one query and produce it.

## How to read this document

Each row in the matrix has:

1. **Criterion** — the SOC 2 control reference.
2. **Statement** — what the criterion asks of us.
3. **How we implement** — the platform mechanism.
4. **Evidence source** — the table or document where the evidence
   lives, and an example query.

## Common Criteria — Control Environment (CC1)

### CC1.1 — Demonstrates commitment to integrity and ethical values

- Implementation: Sprint N.3 Character Layer + the 9 character
  principles seeded by migration 100.
- Evidence:
  ```sql
  SELECT entity_kind, slug, name, source
    FROM governance.constitutional_entities
   WHERE entity_kind = 'CharacterPrinciple'
     AND review_status = 'active';
  ```
  Plus `CHARACTER_PRINCIPLES.md` + the certification report
  `CONSTITUTIONAL_CHARACTER_CERTIFICATION.md`.

### CC1.2 — Board oversight

- Out of scope for the current evidence package; documented in the
  org governance handbook (not in repo).

### CC1.4 — Workforce competence

- Implementation: hiring rubric + quarterly access reviews require
  manager attestation of competence.
- Evidence: `enterprise.access_reviews` rows for the current period.

## CC2 — Communication & Information

### CC2.1 — Quality of internal information

- Implementation: operational + economic + character + readiness
  dashboards.
- Evidence: snapshots from
  `/api/ops/dashboard`, `/api/ops/economic-dashboard`,
  `/api/ops/character-analytics`, `/api/ops/readiness`.

### CC2.2 — Internal communication

- Implementation: incident channel (Slack #incidents); runbooks
  under `/security-policies/`.

### CC2.3 — External communication

- Implementation: status page + email notification per the Incident
  Response Policy section 6.

## CC3 — Risk Assessment

### CC3.1 — Specifies suitable objectives

- Implementation: this document + the security policy set under
  `/security-policies/`.

### CC3.2 — Identifies and assesses risk

- Implementation: vendor risk tiers in `enterprise.vendors.risk_tier`;
  vulnerability tracker in `enterprise.vulnerabilities`.
- Evidence:
  ```sql
  SELECT risk_tier, COUNT(*)
    FROM enterprise.vendors
   WHERE status = 'active'
   GROUP BY risk_tier;
  SELECT severity, COUNT(*)
    FROM enterprise.vulnerabilities
   WHERE status IN ('open','accepted')
   GROUP BY severity;
  ```

### CC3.3 — Assesses fraud risk

- Implementation: economic.abuse_events from Sprint O.0.2.
- Evidence:
  ```sql
  SELECT kind, severity, COUNT(*)
    FROM economic.abuse_events
   WHERE created_at > NOW() - INTERVAL '90 days'
   GROUP BY kind, severity;
  ```

## CC4 — Monitoring

### CC4.1 — Ongoing monitoring

- Implementation: operational dashboards + alert rules documented
  in `INTERNAL_BETA_LAUNCH_RUNBOOK.md` §3.

### CC4.2 — Evaluation of deficiencies

- Implementation: postmortems on every SEV1/SEV2 incident
  (`enterprise.incidents.postmortem_ref`).

## CC5 — Control Activities

### CC5.1 — Selects + develops control activities

- Implementation: this evidence package + the policy set.

### CC5.2 — Technology controls

- Implementation: see CC6._ and CC7._ below.

### CC5.3 — Deploys through policies + procedures

- Implementation: `/security-policies/*` + Change Management Policy.

## CC6 — Logical and Physical Access

### CC6.1 — Logical access provisioning

- Implementation: Access Control Policy + RLS on every user-scoped
  table.
- Evidence:
  ```sql
  -- RLS coverage proof on a sample table:
  SELECT relname, relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname IN ('governance','ingestion','security','outcome','economic','enterprise');
  -- Every row should show relrowsecurity = TRUE.
  ```

### CC6.2 — Removes access when no longer needed

- Implementation: 24-hour deprovisioning SLA per Access Control
  Policy section 4.
- Evidence:
  ```sql
  SELECT * FROM enterprise.admin_audit_log
   WHERE action IN ('role.revoke','tenant_user.remove','secret.rotate_compromised')
   ORDER BY created_at DESC LIMIT 100;
  ```

### CC6.3 — Reviews access periodically

- Implementation: Quarterly access reviews per
  `enterprise.access_reviews`.
- Evidence:
  ```sql
  SELECT review_period, scope, status, subjects_total, subjects_revoked, completed_at
    FROM enterprise.access_reviews
   ORDER BY review_period DESC, scope ASC;
  ```

### CC6.6 — Logical access boundaries (privileged accounts)

- Implementation: service-role policies on every sensitive table;
  privileged actions audited in `enterprise.admin_audit_log`.
- Evidence:
  ```sql
  SELECT actor_role, action, COUNT(*)
    FROM enterprise.admin_audit_log
   WHERE created_at > NOW() - INTERVAL '90 days'
   GROUP BY actor_role, action
   ORDER BY 3 DESC;
  ```

### CC6.7 — Restricts unauthorized software

- Implementation: Vercel + Supabase + GCP are managed environments;
  no ad-hoc software installation is possible.

### CC6.8 — Network protection

- Implementation: Vercel provides DDoS protection at the edge;
  Supabase provides connection-pooling + IP allowlist for admin
  console; all inter-service traffic uses TLS.

## CC7 — System Operations

### CC7.1 — Detects anomalies

- Implementation: Sprint N.2 injection events + Sprint O.0.2 abuse
  events + Sprint N.3 character analytics.
- Evidence:
  ```sql
  SELECT severity, COUNT(*) FROM security.prompt_injection_events
   WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY severity;
  ```

### CC7.2 — Monitors system components

- Implementation: operational readiness dashboard
  (`/api/ops/readiness`).

### CC7.3 — Evaluates anomalies (incident response)

- Implementation: Incident Response Policy + `enterprise.incidents`.
- Evidence:
  ```sql
  SELECT severity, status, COUNT(*) FROM enterprise.incidents
   WHERE detected_at > NOW() - INTERVAL '180 days'
   GROUP BY severity, status;
  ```

### CC7.4 — Responds to incidents

- Implementation: Incident Response Policy sections 5 + 6.
- Evidence: incident records with `mitigated_at` / `resolved_at` +
  postmortem refs.

### CC7.5 — Recovers from incidents

- Implementation: Disaster Recovery Policy + Sprint R DR drills.

## CC8 — Change Management

### CC8.1 — Authorizes + implements changes

- Implementation: Change Management Policy + PR review + CI gates +
  migration self-tests.
- Evidence:
  - GitHub PR audit log (external).
  - `scripts/validation/check_governed_prompt_enforcement.sh` output
    in CI.
  - Migration self-tests visible in `supabase db push` logs.

## CC9 — Risk Mitigation

### CC9.1 — Mitigates risks

- Implementation: vulnerability tracker + circuit breakers +
  rate limiting + economic governance.

### CC9.2 — Vendor management

- Implementation: `enterprise.vendors` + `VENDOR_MANAGEMENT_PROGRAM.md`.
- Evidence:
  ```sql
  SELECT vendor_key, risk_tier, status, last_reviewed_at, next_review_due
    FROM enterprise.vendors
   ORDER BY risk_tier DESC, next_review_due ASC;
  ```

## Evidence collection workflow (auditor-facing)

When an auditor requests evidence, the operator:

1. Identifies the criterion (e.g. CC6.3 — periodic access reviews).
2. Runs the SQL query in this document.
3. Exports the result with the date-range header to an evidence
   bucket.
4. Attaches the policy document(s) cross-referenced above.
5. Cross-references the corresponding row in
   `SOC2_READINESS_REPORT.md` to show audit trail.

## Cadence

- CC1, CC3, CC9 — annual evidence refresh.
- CC2, CC4, CC5, CC8 — quarterly.
- CC6, CC7 — continuous; evidence collected per incident or per
  review cycle.

## Gaps + residual risks

Documented transparently — the auditor will ask:

1. **MDM / endpoint compliance** — not yet implemented. Engineering
   staff use personal devices; required to enable full-disk
   encryption and MFA but not enforced by MDM. Mitigation: workforce
   continuity + DR cover separation.
2. **Independent penetration test** — not yet performed. Planned for
   pre-GA.
3. **External SOC 2 Type I report** — this document supports an
   internal readiness assessment; engagement of an external auditor
   is the next step.
4. **Sub-processor change notifications** — vendor changes are
   currently tracked manually; automated notification on
   `vendors.updated_at` is a Sprint R+ task.
5. **Quarterly DR drill cadence** — DR Policy commits to drills,
   but the cadence will only be proven over time. The first PITR
   drill is documented in `enterprise.incidents` as a SEV4.
