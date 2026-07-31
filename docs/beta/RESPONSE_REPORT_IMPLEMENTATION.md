# R-3 · Categorized Advisor-Response Reporting — implementation

**Status: `Implemented` · `Automated tests passed` · `Deployment pending` ·
`Live-store verification pending` · `Beta gate unresolved`.**

**The NO-GO decision from audit `4416211f` is unchanged.** No live-behaviour claim is made.

---

## 1. Evidence contract (confirmed before building)

| Question                          | Finding                                                                                                                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is `advisor_turns` immutable?     | **No.** RLS + FORCE RLS, but a single `service_role` policy with `ALL` (`160_advisor_turns.sql:49-57`). Service-role writes can mutate it                                                                                                |
| Who can read it?                  | service_role **only** — no `authenticated` policy. Users cannot read their own turns directly                                                                                                                                            |
| Authoritative user→tenant mapping | **There is none as a separate concept.** `AuthenticatedUser` carries `user_id`, `email`, `role` — no tenant. Tenancy resolves as **`tenant_id = user_id`** (`advisor_orchestrator.py:998`; `traversal.py` binds `{tenant_id: $user_id}`) |
| How identity reaches the API      | Verified Supabase JWT → `AuthenticatedUser` via `Depends(authenticated)`                                                                                                                                                                 |
| Existing pattern to reuse         | `analytics.py:35-42` `submit_feedback` — _"user_id is stamped from the JWT, never the body"_                                                                                                                                             |

**Consequence of the immutability finding:** the report stores its own `question_snapshot` and
`response_snapshot`. If the turn is later mutated, the report still means what the reporter saw.

**`llm_response_raw` is never read into the report path.** It is excluded from
`_TURN_SNAPSHOT_COLUMNS` and a test asserts it stays excluded.

## 2. Schema

`supabase/migrations/20260731000000_advisor_response_reports.sql` →
`feedback.advisor_response_reports`. Service-role-only RLS, matching `advisor_turns`.

Seven categories enforced by CHECK constraint. Partial unique index on
`(user_id, turn_id, category) WHERE review_status IN ('new','investigating')` — so re-reporting the
same problem is a duplicate, but a **materially different category is a new report**.

Triage columns: `severity`, `review_status`, `assigned_to`, `duplicate_of`, `resolution_notes`,
`reviewed_at`, `resolved_at`. Index on `(deployment_version, prompt_version, model_name)` for
repeated-failure detection by release.

**`advisor_turns` was NOT given a `tenant_id` column.** That is a separate data-contract decision and
is deliberately not made here.

## 3. API contract

`POST /v1/analytics/advisor/response-report` → **201**

Request body carries **exactly three fields**: `turn_id`, `category`, `explanation` (optional).
Response: `{report_id, duplicate, status}`.

| Case                                         | Status              |
| -------------------------------------------- | ------------------- |
| Success                                      | 201                 |
| Invalid category / overlong explanation      | 400                 |
| Turn absent **or belonging to another user** | **404 — identical** |

## 4. Ownership enforcement

Both filters are applied **in the query**:

```python
filters={"turn_id": f"eq.{turn_id}", "user_id": f"eq.{user_id}"}
```

A foreign turn is therefore indistinguishable from a missing one **by construction**, not by a
later `if`. There is no enumeration oracle over advisor conversations.

Tenant is resolved server-side as the authenticated user. `submit()` accepts no identity, tenant,
model, deployment, evidence or policy parameter — a test pins the signature so adding one requires
deleting an assertion.

## 5. Metadata: available vs unavailable

**Resolved server-side and stored:** turn_id, conversation_id, user_id, tenant_id, category,
explanation, created_at, question/response snapshot, prompt_version, retrieval channels
(`relationships_referenced`), citation refs (`sources`), deployment_version (env), model_provider,
model_name, severity, review_status.

**NULL by design — the observability gap, recorded rather than fabricated:**

| Field                | Why unavailable                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `routing_result`     | model-routing decision is not persisted per turn                                                                         |
| `policy_outcomes`    | validator result exists on the turn but is not exposed as a policy record                                                |
| `feature_flags`      | `ops.feature_flags` exists but no per-turn snapshot is written                                                           |
| `deployment_version` | depends on `RELEASE_SHA`/`GIT_COMMIT_SHA`/`FLY_MACHINE_VERSION` being set in the deployed env — **currently unverified** |

Closing these is a telemetry change to the advisor turn writer, not to this module.

## 6. What was NOT built

- **UI component** — `Report this response` action, dialog, pending/success/retry states, keyboard
  and screen-reader behaviour. Not built: it cannot be verified without a running app, and shipping
  unverifiable UI is the "code exists therefore it works" inference the audit forbids.
- **Review-queue surface** — the schema supports filter/assign/status/resolution and an admin
  pattern exists (`/admin/pilot-analytics` with `PlatformAccess.is_admin` + `log_admin_access`), but
  no reviewer UI was added.

Both remain open under R-3. **R-3 is not operationally complete.**

## 7. Real vs faked boundaries

| Boundary                                                                              | State                                                                             |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Ownership predicate, trust boundary, category set, duplicate handling, snapshot shape | **Contract-verified** against a fake that honours filters                         |
| Migration applied                                                                     | ❌ never run — the local Supabase stack is blocked by a separate migration defect |
| Endpoint served                                                                       | ❌ never called over HTTP                                                         |
| Cross-tenant behaviour on the deployment                                              | ❌ unverified                                                                     |

The fake honours `filters`, so an ownership bug surfaces — a fake returning canned rows would make
every ownership test tautological.
