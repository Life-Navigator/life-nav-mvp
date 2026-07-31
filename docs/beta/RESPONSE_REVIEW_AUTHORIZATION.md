# Response Review Authorization — `advisor_response_reviewer`

**B-23. Implemented and automated-test verified. Deployed/live authorization verification pending.**

## Model

```
platform admin
    └── inherits advisor_response_reviewer   (explicit, in PlatformAccess)

advisor_response_reviewer
    └── response-review permissions ONLY
```

The inheritance is written in **one place** — `PlatformAccess.can_review_advisor_responses` — so it
is visible and testable rather than implied by scattered admin checks. **The converse does not
hold:** a reviewer is never an admin, and every other admin endpoint still calls `is_admin`, so
review access cannot widen into administration. A test asserts
`can_review(reviewer) is True and is_admin(reviewer) is False`.

## Mechanism — extension, not a second framework

The existing system supports only admins, via a normalized email set from config. The narrowest
consistent extension mirrors it exactly:

|             | Admin               | Reviewer                              |
| ----------- | ------------------- | ------------------------------------- |
| Config      | `ADMIN_EMAILS`      | `RESPONSE_REVIEWER_EMAILS`            |
| Set builder | `admin_email_set()` | `response_reviewer_email_set()`       |
| Check       | `is_admin(email)`   | `can_review_advisor_responses(email)` |
| Audit       | `log_admin_access`  | **same** `log_admin_access`           |

**Exact, normalized, lowercase matching only.** No domain rule, no substring, no frontend claim — a
domain rule would silently grant review access to every future account on that domain.

## Grant / revoke

**Grant:** add the exact email to `RESPONSE_REVIEWER_EMAILS` (comma-separated) and restart/redeploy
core-api. **Revoke:** remove it and restart. Revocation takes effect through the same authoritative
set — a test proves a removed reviewer is denied.

No production emails are hardcoded anywhere; tests use `*@lifenav.test` fixtures.

**Operational dependency:** setting `RESPONSE_REVIEWER_EMAILS` on Fly is an owner action, and
restart-to-revoke is a real limitation of config-based access.

## Audit

Every attempt — **granted and denied** — writes to `platform.admin_access_log` via the existing
`log_admin_access`. Denials matter most: a denied attempt is the earliest signal that someone is
probing an endpoint they should not know about.

## Post-beta improvement (recorded, not built)

A DB-backed capability table would remove the restart-to-revoke limitation and allow per-user grants
without redeploy. Out of scope for a controlled beta cohort; recorded as **B-26**.
