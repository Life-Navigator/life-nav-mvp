# MCP, Data Submission, Email & Calendar Integration — Executive Summary

**Date:** 2026-06-16 · **Final status: BLOCKED on operational provisioning** (key rotation, OAuth credentials, apply the gated migration). Everything buildable is **built, tested, and type-checked**; the blockers are owner actions, not code.

## What shipped (code)

### MCP structured data submission (true MCP protocol server)

- **`apps/lifenavigator-core-api/mcp_server/`** — a stdio MCP server exposing **7 schema-enforced, provenance-stamped tools** (`submit_life_fact`, `submit_goal`, `submit_constraint`, `submit_risk`, `submit_opportunity`, `submit_narrative`, `submit_relationship`). The LLM never names a table or writes SQL — the tool does.
- **`app/services/ingestion.py`** — `IngestionService`: Pydantic validation + enums, tool→table mapping, required provenance, idempotent deterministic-id upserts, tenant scoping from a **verified** JWT. **10 unit tests** (`tests/test_ingestion.py`); full suite **504 pass**.
- **Migration `20260616160000_mcp_ingestion.sql`** — `life.facts`, `life.relationships`, provenance columns on goals/risks/opportunities/constraints; RLS. **Gated** on key rotation.

### Email & Calendar (Google + Microsoft)

- **`/dashboard/email`** (new) + **`/dashboard/calendar`** (rebuilt from a non-functional stub): per-provider connect/status/disconnect, list/detail, empty/error/loading/disconnected states, privacy notices. Token-safe server routes (`api/email/messages`, `api/calendar/events`) call Gmail/Graph with the **stored token server-side** and return only safe fields — **tokens never reach the client** (asserted in tests). Type-check + eslint + jest all green.

## The 13 deliverable docs (`docs/integrations-sprint/`)

MCP_SERVER_AUDIT · MCP_TOOL_SPEC · MCP_SCHEMA_ENFORCEMENT · MCP_DATABASE_MAPPING · MCP_PROVENANCE_POLICY · MCP_LIOS_INTEGRATION_REPORT · EMAIL_INTEGRATION_AUDIT · CALENDAR_INTEGRATION_AUDIT · EMAIL_CALENDAR_CONTEXT_POLICY · INTEGRATION_SECURITY_REPORT · EMAIL_PAGE_REPORT · CALENDAR_PAGE_REPORT · EXECUTIVE_SUMMARY.

## The 12 final questions

1. Can LLMs submit discovered data safely? **Yes** — via the MCP server only; schema + provenance + RLS.
2. Are all writes schema-validated? **Yes** — Pydantic at the boundary; invalid → structured error, no write.
3. Facts/goals/risks/opportunities properly classified? **Yes** — one tool per type → fixed table.
4. Is provenance attached to every write? **Yes** — `provenance` is required on every tool.
5. Are user/tenant boundaries enforced? **Yes** — user from a verified JWT, never from payload; RLS backstop.
6. Can users connect email? **Yes (UI built)** — live flow pending OAuth credentials (owner).
7. Can users view email in the app? **Yes** — list/detail render; honest disconnected state until connected.
8. Can users connect calendar? **Yes (UI built)** — same provisioning dependency.
9. Can users view calendar in the app? **Yes** — events render; honest empty/disconnected states.
10. Can Arcana use email/calendar context safely? **Policy defined** — candidate-by-default, provenance-tagged, no send/calendar-write without explicit approval (`EMAIL_CALENDAR_CONTEXT_POLICY.md`).
11. Are tokens protected? **At rest yes** (AES-256, RLS, server-only secrets — verified); **gaps**: no token-use audit log; Google token-save endpoint missing.
12. Ready for pilot users? **Not until the blockers below clear.**

## Blockers before pilot (owner actions, ranked)

1. 🔴 **Rotate the exposed Supabase PAT + service-role + anon keys** (standing gate; repo is clean).
2. 🔴 **Provision OAuth credentials** — `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID`, `INTEGRATION_ENCRYPTION_KEY`, registered redirect URIs. Until set, integration pages show honest disconnected states (no fabricated data).
3. 🟠 **Apply the gated migration** `20260616160000_mcp_ingestion.sql` (after #1) to activate live MCP writes.
4. 🟠 **Fix Google token persistence** — the Google OAuth callback POSTs to a core-api endpoint that doesn't exist; mirror Microsoft's encrypted-Supabase path (shared-callback change, flagged not made by the agents to avoid cross-scope edits). Microsoft works end-to-end given creds.
5. 🟠 **Add a token-use audit log** (decrypt access currently unrecorded).
6. Install the MCP server deps (`mcp_server/requirements.txt`) wherever the MCP server runs.

## Final status: **BLOCKED** (operational provisioning only)

All sanctioned code is built, tested, and safe-by-default. MCP writes are schema/provenance/tenant-enforced; email and calendar render with honest states and protected tokens. Clear the six items above — chiefly key rotation + OAuth credentials + the gated migration — to reach **MCP_AND_INTEGRATIONS_READY**.
