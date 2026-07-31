# R-3 Slice 2 — UI and Review Workflow

**Status: BLOCKED-THEN-UNBLOCKED, then stopped short. Read §1 before §3.**

## 1. The finding that changed the plan

**`turn_id` never reached the browser.** It is generated at `advisor_orchestrator.py:519` for
telemetry only, appears in no API response, and **zero web files referenced `turn_id` or `turnId`**.

B-22 was therefore not a UI task — it was blocked on a **response-contract change**. Per the brief
(_"If `turn_id` is not available to the rendered response, extend the established response contract
minimally. Do not generate identifiers in the browser."_), that contract change was the correct
first move, and it is what this slice delivers.

## 2. Contract extension (implemented)

`_finish()` is the **single return path** for every `converse()` branch — discovery, disabled, and
LLM-enhanced. Stamping `turn_id` there makes **every** advisor turn reportable, or none:

```python
base["turn_id"] = tr.get("turn_id", "")
```

**Why exposing it is safe.** It is an opaque handle. `POST /v1/analytics/advisor/response-report`
re-resolves ownership and every evidence field server-side from `analytics.advisor_turns`, and a
caller holding another user's `turn_id` receives an identical 404 to a nonexistent one. Possessing
the id grants no read access to anything.

Two tests pin this: the contract stamp itself, and that no web file mints a `turn_id` client-side.

## 3. What was NOT built — and why

| Item                                                   | Status          |
| ------------------------------------------------------ | --------------- |
| Typed API client                                       | **Not started** |
| `Report this response` action + dialog                 | **Not started** |
| Accessibility (focus trap, announcements, restoration) | **Not started** |
| Reviewer API + UI (B-23)                               | **Not started** |
| Component / browser tests                              | **Not started** |
| The 5 UI mutations                                     | **Not started** |

This is a scope-honesty stop, not a claim of completion. The remaining work is a multi-file UI
feature plus a reviewer surface; starting it without room to finish and test would leave
half-built, unverified UI in the tree — the outcome the audit posture exists to prevent.

**`turn_id` propagation was the load-bearing prerequisite.** With it committed, the UI work is now
unblocked and can be picked up cleanly.

## 4. Policy dependency for B-23 (recorded, not invented)

An admin authorization pattern **does** exist — `PlatformAccess.is_admin(user.email)` with
`log_admin_access(...)` granted/denied, used by `/v1/admin/advisor-metrics`. That is a viable basis
for a reviewer surface.

**But there is no distinct _reviewer_ role** — only admin. Whether report review should require full
admin, or a narrower least-privilege reviewer role, is a **policy decision, not an implementation
choice**. Per the brief, that portion is stopped and the dependency recorded rather than invented.

## 5. Status

- **B-22** — `Contract prerequisite implemented` · `Tests passed` · **UI not started** · deployment verification pending
- **B-23** — **Policy-blocked** (no reviewer role; admin-only exists) · deployment verification pending
- **R-3** — **not operationally complete**
- **Beta decision — NO-GO, unchanged**
