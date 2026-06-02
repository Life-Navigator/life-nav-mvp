# Access Control Policy

Owner: Security Team
Version: 1.0
Effective: 2026-06-01
Review cadence: quarterly

## 1. Purpose

Define who may access which systems, how privileges are granted,
revoked, and reviewed.

## 2. Identity

- End users authenticate via Supabase auth (email + password OR
  OAuth via supported providers).
- Engineering staff authenticate to internal systems via GitHub SSO
  (mandatory MFA).
- Service accounts (cron jobs, background workers) authenticate via
  service-role keys stored in `enterprise.secret_rotation_schedule`.

## 3. Roles

| Role             | Granted to                                                 | What they can do                                            |
| ---------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| `end_user`       | Authenticated users                                        | Their own data only (RLS owner-read)                        |
| `tenant_viewer`  | Sprint P tenant_users members                              | Read tenant aggregates                                      |
| `tenant_owner`   | Sprint P tenant owners                                     | Manage tenant API keys + see usage                          |
| `platform_admin` | Operators with `ops.feature_flags.operator_dashboard.read` | Operator + economic + character + readiness dashboards      |
| `db_admin`       | Engineering manager + Security Lead                        | Direct Supabase access; production DDL                      |
| `service_role`   | Server-side Supabase clients only                          | Bypass RLS for application logic; never exposed to clients  |
| `security_team`  | Designated reviewers                                       | Read `governance.*`, `security.*`, `enterprise.*` for audit |

Cross-cutting: principle of least privilege. Roles do not stack
unless explicitly required for the task.

## 4. Provisioning + deprovisioning

### Provisioning

1. Engineering manager requests via ticket.
2. Security Lead approves.
3. Identity provider (GitHub / Supabase) grants.
4. Action is recorded in `enterprise.admin_audit_log` with
   `actor_role + action + target_id`.

### Deprovisioning

1. Same channel.
2. Within 24 hours of role change OR separation.
3. Secrets rotated if the leaving party had access to them
   (see `enterprise.secret_rotation_schedule.rotation_method`).

## 5. Quarterly access reviews

`enterprise.access_reviews` tracks reviews per (period, scope). The
five required scopes (per `REQUIRED_SCOPES`):

- `platform_admin`
- `tenant_owner`
- `service_role`
- `db_admin`
- `security_team`

For each scope:

1. Reviewer (Security Lead) lists current holders.
2. Each holder is confirmed by their manager OR revoked.
3. Outcome counts (`subjects_total`, `subjects_revoked`,
   `subjects_modified`) are written to the review row.
4. Reviewer signs off (sets `status = 'completed'` + `completed_at`).

A missing review for the current period is surfaced by
`coverageReport` in the readiness dashboard.

## 6. Privileged action audit

Every action taken under `platform_admin`, `db_admin`, `service_role`,
or `security_team` writes a row to `enterprise.admin_audit_log` with:

- `actor_user_id`
- `actor_role`
- `action` (e.g. `override.user_budget`, `reset.password`,
  `force_open.circuit_breaker`)
- `target_kind` + `target_id`
- `before_state` + `after_state` JSON snapshots
- `reason` (mandatory)

The audit log is append-only at the application layer; service-role
only.

## 7. Multi-factor authentication

MFA is mandatory for:

- GitHub (engineering staff)
- Supabase (admin console)
- Google Cloud (secrets store)
- Vercel (deploy console)
- Plaid (production dashboard)

MFA is recommended for end users; not mandatory in the internal beta
phase. To become mandatory for general availability.

## 8. Session management

- Web sessions: Supabase default (1 hour access token + refresh).
- Engineering staff sessions: GitHub SSO default + per-organization
  SSO enforcement.
- Operator dashboard: same as web session; gated by the per-user
  feature flag.

## 9. Acceptance

Reviewed quarterly during the access-review cycle.
