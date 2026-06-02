# Vendor Management Program

Sprint R deliverable.

## Purpose

Define how LifeNavigator selects, monitors, and reviews the
third-party vendors that compose its production stack. The named
vendors are the Sprint R Phase 3 set: Gemini, Supabase, Fly.io,
Neo4j, Qdrant, Plaid, Vercel.

## Program ownership

- **Primary**: Security Lead.
- **Secondary**: Operations Lead.
- **Vendor-specific owner**: documented per vendor in
  `enterprise.vendors.metadata.vendor_owner`.

## Vendor inventory

The authoritative inventory lives in `enterprise.vendors`. Migration
103 seeded the 7 named vendors with risk tier, data shared,
subprocessors, certifications, DPA / BAA status, and review dates.

### The 7 named vendors

| Vendor                    | Risk tier | Data shared                            | DPA | BAA                      | Certifications                             | Review cadence |
| ------------------------- | --------- | -------------------------------------- | --- | ------------------------ | ------------------------------------------ | -------------- |
| Google Gemini (Vertex AI) | high      | Prompts; no PHI without BAA            | ✓   | (via Vertex AI BAA path) | SOC 2, ISO 27001, HIPAA-eligible           | 365 days       |
| Supabase                  | high      | All application data                   | ✓   | (via BAA on request)     | SOC 2, HIPAA via BAA                       | 365 days       |
| Fly.io                    | medium    | Workers / background jobs              | —   | —                        | SOC 2 (in progress)                        | 180 days       |
| Neo4j Aura                | medium    | Graph projection (de-identified)       | ✓   | —                        | SOC 2, ISO 27001                           | 365 days       |
| Qdrant Cloud              | medium    | Vector embeddings                      | —   | —                        | SOC 2 (in progress)                        | 180 days       |
| Plaid                     | high      | Financial account / institution tokens | ✓   | —                        | SOC 2, ISO 27001, PCI DSS Service Provider | 365 days       |
| Vercel                    | medium    | Application runtime + logs             | ✓   | —                        | SOC 2, ISO 27001                           | 365 days       |

### Risk tier definition

| Tier     | Definition                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| `high`   | Vendor holds production user data OR is on the critical hot path AND a compromise would directly affect users |
| `medium` | Vendor supports the platform but is partially substitutable / does not directly hold user data                |
| `low`    | Vendor provides developer or operational tooling that does not interact with user data                        |

## Selection process

When adding a new vendor:

1. Engineering manager files a vendor-onboarding ticket.
2. Security Lead reviews:
   - What data the vendor will receive.
   - Risk tier classification.
   - Required compliance posture (SOC 2 minimum; HIPAA if PHI is
     in scope; PCI if cardholder data is in scope).
   - Subprocessors disclosed.
3. Legal reviews:
   - DPA + applicable annexes (SCCs for international transfers).
   - BAA if PHI is in scope.
4. CTO sign-off on `high` tier vendors.
5. Vendor added to `enterprise.vendors` with full metadata.
6. Asset(s) using the vendor added to `enterprise.assets` with
   `vendor_id` set.

## Annual review process

For each `active` vendor:

1. Security Lead requests current SOC 2 / ISO 27001 / penetration
   test attestations.
2. Confirms subprocessor list is unchanged.
3. Reviews any incidents at the vendor over the past year.
4. Confirms DPA / BAA are still in force.
5. Updates `last_reviewed_at` + `next_review_due`.
6. If vendor cannot meet the review, status flips to
   `pending_review`; if cannot meet review for 60 days, flips to
   `deprecated` and the engineering team plans replacement.

Vendors with `next_review_due` within 30 days are surfaced by
`vendorsDueForReview` on the operational readiness dashboard.

## Continuous monitoring

- Vendor incident notifications routed to `#incidents` Slack.
- SEV1/SEV2 vendor incidents create an `enterprise.incidents` row
  with `affected_assets` set to every internal asset that depends on
  the vendor.
- Status page subscriptions for each vendor maintained by Operations.

## Sub-processor changes

When a vendor adds or removes a sub-processor:

1. The Security Lead receives the notification (subscription
   per-vendor).
2. The change is recorded in `enterprise.vendors.subprocessors`.
3. If the new sub-processor is in a region or category that triggers
   compliance review (e.g. a non-EU processor for a tenant under
   GDPR), the change is flagged for legal review.
4. Affected tenants are notified per their contract.

Today: notification handling is manual. Automated detection on
`vendors.updated_at` change is queued for Sprint R+.

## Vendor offboarding

When a vendor is replaced or removed:

1. Migration plan with cutover date.
2. Data migration + verification per the new vendor's onboarding.
3. Decommission the prior vendor: revoke credentials, rotate any
   secrets the prior vendor saw, delete data per the prior contract.
4. Update `enterprise.vendors.status = 'offboarded'`.
5. Update affected `enterprise.assets` rows.
6. Record in `enterprise.admin_audit_log`.

## Vendor-specific notes

### Gemini

- Path for clinical / regulated tenants: BAA via Vertex AI.
- Sprint P `models.tenant_model_overrides` lets a tenant pin to
  the BAA-bound deployment.

### Supabase

- Single point of failure for the application.
- RPO 1 hour / RTO 4 hours via PITR.
- BAA available on request for healthcare tenants.

### Fly.io

- Hosts background workers; stateless and idempotent.
- SOC 2 not yet completed — flagged in the readiness report.

### Neo4j Aura

- Graph projection is de-identified before insert (the projection
  layer queued for Sprint Q+ is what carries this guarantee).

### Qdrant Cloud

- Vector embeddings; SOC 2 in progress.
- Embeddings carry no PII by design (we vectorize de-identified
  text).

### Plaid

- Highest single-vendor risk due to financial-account access.
- PCI DSS Service Provider certified.
- Disconnect flow audited in `enterprise.admin_audit_log`.

### Vercel

- Edge + serverless runtime.
- Multi-region by default.
- No customer data persisted in Vercel beyond logs (retained 30
  days).

## Operational readiness alerts

The readiness dashboard surfaces:

- `vendors.reviews_overdue` — flagged if > 0.
- `vendors.due_for_review` — count of vendors needing review in the
  next 30 days.
- `vendors.pending_review` — vendors in `pending_review` status.
- `vendors.dpa_signed_pct` — should approach 1.0; non-DPA vendors
  are documented exceptions.

## Acceptance

Reviewed annually by Security Lead + Operations Lead +
Engineering Manager. Customers can request a redacted vendor
register under NDA.
